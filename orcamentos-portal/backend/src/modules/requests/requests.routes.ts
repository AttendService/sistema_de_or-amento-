// ============================================================
// Módulo Solicitações — CRUD + Máquina de estados
// ============================================================
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import prisma from '../../infrastructure/database/prisma.js'
import {
  NotFoundError, ForbiddenError, InvalidTransitionError, ValidationError,
} from '../../shared/errors/index.js'
import {
  parsePagination, buildPaginatedResult, logAudit,
} from '../../shared/utils/index.js'
import { assertClientAccess } from '../../shared/middleware/auth.js'
import {
  REQUEST_TRANSITIONS, CLIENT_ALLOWED_STATUS, STATUS_REQUIRES_REASON,
  type RequestStatus, type JwtPayload,
} from '../../shared/types/index.js'

const IdSchema = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  'ID inválido.',
)

// ── Schemas ───────────────────────────────────────────────
const CreateRequestSchema = z.object({
  clientId:            IdSchema,
  requesterName:       z.string().min(2).max(255),
  requesterEmail:      z.string().email(),
  requesterPhone:      z.string().max(20).optional().nullable(),
  finalClientName:     z.string().min(2).max(255),
  finalClientCompany:  z.string().max(255).optional().nullable(),
  finalClientDocument: z.string().max(18).optional().nullable(),
  finalClientContact:  z.string().max(255).optional().nullable(),
  finalClientPhone:    z.string().max(20).optional().nullable(),
  zipCode:             z.string().max(10).optional().nullable(),
  street:              z.string().max(255).optional().nullable(),
  streetNumber:        z.string().max(20).optional().nullable(),
  complement:          z.string().max(100).optional().nullable(),
  neighborhood:        z.string().max(100).optional().nullable(),
  city:                z.string().max(100).optional().nullable(),
  state:               z.string().length(2).optional().nullable(),
  reference:           z.string().optional().nullable(),
  latitude:            z.number().optional().nullable(),
  longitude:           z.number().optional().nullable(),
  description:         z.string().optional().nullable(),
  observations:        z.string().optional().nullable(),
  requestedDate:       z.string().date().optional().nullable(),
  isUrgent:            z.boolean().default(false),
  serviceTypeIds:      z.array(IdSchema).min(1, 'Selecione pelo menos um tipo de serviço.'),
})

const UpdateRequestSchema = CreateRequestSchema
  .omit({ clientId: true, serviceTypeIds: true })
  .partial()
  .extend({ serviceTypeIds: z.array(IdSchema).min(1).optional() })

const ChangeStatusSchema = z.object({
  status:       z.enum(['REQUESTED','IN_ANALYSIS','QUOTE_IN_PROGRESS','QUOTE_SENT','APPROVED','REJECTED','ON_HOLD','CANCELLED']),
  observations: z.string().optional().nullable(),
  estimatedDate: z.string().date().optional().nullable(),
})

const ParamsSchema = z.object({ id: IdSchema })
const AddInternalNoteSchema = z.object({
  note: z.string().trim().min(1, 'Nota não pode ser vazia.').max(2000),
})

const QuerySchema = z.object({
  page:          z.coerce.number().optional(),
  limit:         z.coerce.number().optional(),
  status:        z.string().optional(),
  clientId:      IdSchema.optional(),
  isUrgent:      z.coerce.boolean().optional(),
  serviceTypeId: IdSchema.optional(),
  assignedTo:    IdSchema.optional(),
  q:             z.string().optional(),
  from:          z.string().date().optional(),
  to:            z.string().date().optional(),
  sort:          z.enum(['createdAt','requestedDate','isUrgent']).optional().default('createdAt'),
  order:         z.enum(['asc','desc']).optional().default('desc'),
})

const FinalClientsQuerySchema = z.object({
  clientId: IdSchema.optional(),
  q: z.string().optional(),
})

// ── Routes ────────────────────────────────────────────────
export async function requestRoutes(app: FastifyInstance) {

  // GET /requests/final-clients — sugestões por conta vinculada
  app.get('/requests/final-clients', { preHandler: [app.authenticate] }, async (req, reply) => {
    const query = FinalClientsQuerySchema.parse(req.query)
    const requester = req.user as JwtPayload

    let clientId = query.clientId ?? undefined
    if (requester.role === 'CLIENT') {
      clientId = clientId && requester.clientIds.includes(clientId)
        ? clientId
        : (requester.defaultClientId ?? requester.clientIds[0])
    }

    if (!clientId) {
      return reply.send([])
    }

    if (requester.role === 'CLIENT' && !requester.clientIds.includes(clientId)) {
      throw new ForbiddenError('Acesso negado a este cliente.')
    }

    const rows = await prisma.request.findMany({
      where: {
        deletedAt: null,
        clientId,
        ...(query.q
          ? { finalClientName: { contains: query.q, mode: 'insensitive' as const } }
          : {}),
      },
      select: {
        finalClientName: true,
        finalClientCompany: true,
        finalClientDocument: true,
        finalClientContact: true,
        finalClientPhone: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    const unique = new Map<string, (typeof rows)[number]>()
    for (const row of rows) {
      const key = `${row.finalClientName}::${row.finalClientDocument ?? ''}`.toLowerCase()
      if (!unique.has(key)) unique.set(key, row)
    }

    return reply.send(Array.from(unique.values()))
  })

  // GET /requests — fila com filtros
  app.get('/requests', { preHandler: [app.authenticate] }, async (req, reply) => {
    const query     = QuerySchema.parse(req.query)
    const requester = req.user as JwtPayload
    const { page, limit, skip } = parsePagination(query)

    // Cliente só vê seus próprios registros
    let clientIdFilter: string[] | undefined
    if (requester.role === 'CLIENT') {
      clientIdFilter = requester.clientIds
      if (query.clientId && !requester.clientIds.includes(query.clientId)) {
        throw new ForbiddenError('Acesso negado a este cliente.')
      }
    }

    const where: Record<string, unknown> = {
      deletedAt: null,
      ...(clientIdFilter          && { clientId: { in: clientIdFilter } }),
      ...(query.clientId && !clientIdFilter && { clientId: query.clientId }),
      ...(query.status            && { status: query.status }),
      ...(query.isUrgent !== undefined && { isUrgent: query.isUrgent }),
      ...(query.serviceTypeId     && { serviceTypes: { some: { serviceTypeId: query.serviceTypeId } } }),
      ...(query.assignedTo        && { assignedTo: query.assignedTo }),
      ...(query.q                 && {
        OR: [
          { requestNumber:    { contains: query.q, mode: 'insensitive' as const } },
          { requesterName:    { contains: query.q, mode: 'insensitive' as const } },
          { finalClientName:  { contains: query.q, mode: 'insensitive' as const } },
          { city:             { contains: query.q, mode: 'insensitive' as const } },
        ],
      }),
      ...((query.from || query.to) && {
        createdAt: {
          ...(query.from && { gte: new Date(query.from) }),
          ...(query.to   && { lte: new Date(query.to + 'T23:59:59Z') }),
        },
      }),
    }

    const orderBy = query.sort === 'isUrgent'
      ? [{ isUrgent: 'desc' as const }, { createdAt: 'desc' as const }]
      : [{ [query.sort ?? 'createdAt']: query.order ?? 'desc' }]

    const [requests, total] = await Promise.all([
      prisma.request.findMany({
        where, skip, take: limit, orderBy,
        include: {
          client:        { select: { id: true, name: true } },
          createdByUser: { select: { id: true, name: true, email: true } },
          assignedToUser: { select: { id: true, name: true } },
          serviceTypes:  { include: { serviceType: { select: { id: true, name: true } } } },
          quotes:        { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 1,
                           select: { id: true, status: true, totalValue: true, sentAt: true } },
        },
      }),
      prisma.request.count({ where }),
    ])

    return reply.send(buildPaginatedResult(requests, total, page, limit))
  })

  // GET /requests/:id
  app.get('/requests/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id }    = ParamsSchema.parse(req.params)
    const requester = req.user as JwtPayload

    const request = await prisma.request.findFirst({
      where: { id, deletedAt: null },
      include: {
        client:          { select: { id: true, name: true, tradeName: true, document: true, phone: true } },
        createdByUser:   { select: { id: true, name: true, email: true } },
        assignedToUser:  { select: { id: true, name: true, email: true } },
        serviceTypes:    { include: { serviceType: true } },
        quotes:          {
          where: { deletedAt: null }, orderBy: { createdAt: 'desc' },
          include: {
            createdByUser: { select: { id: true, name: true } },
            items:         { include: { serviceType: { select: { id: true, name: true } } } },
          },
        },
        history: {
          orderBy:  { performedAt: 'desc' },
          include:  { performedByUser: { select: { id: true, name: true } } },
        },
      },
    })

    if (!request) throw new NotFoundError('Solicitação', id)

    // Isolamento: cliente só vê seus próprios registros
    if (requester.role === 'CLIENT') {
      assertClientAccess(
        { id: requester.sub, role: requester.role, email: requester.email, clientIds: requester.clientIds, defaultClientId: requester.defaultClientId },
        request.clientId,
      )
    }

    return reply.send(request)
  })

  // POST /requests — cliente abre solicitação
  app.post('/requests', { preHandler: [app.authenticate] }, async (req, reply) => {
    const result = CreateRequestSchema.safeParse(req.body)
    if (!result.success) {
      return reply.status(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: result.error.flatten().fieldErrors },
      })
    }

    const data      = result.data
    const requester = req.user as JwtPayload

    // Cliente só pode abrir para seus próprios clientes
    if (requester.role === 'CLIENT') {
      assertClientAccess(
        { id: requester.sub, role: requester.role, email: requester.email, clientIds: requester.clientIds, defaultClientId: requester.defaultClientId },
        data.clientId,
      )
    }

    // Validar que todos os serviceTypeIds existem
    const serviceTypes = await prisma.serviceType.findMany({
      where: { id: { in: data.serviceTypeIds }, status: 'ACTIVE' },
    })
    if (serviceTypes.length !== data.serviceTypeIds.length) {
      throw new ValidationError('Um ou mais tipos de serviço são inválidos ou inativos.')
    }

    const request = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.request.create({
        data: {
          clientId:            data.clientId,
          createdBy:           requester.sub,
          requesterName:       data.requesterName,
          requesterEmail:      data.requesterEmail,
          requesterPhone:      data.requesterPhone ?? null,
          finalClientName:     data.finalClientName,
          finalClientCompany:  data.finalClientCompany  ?? null,
          finalClientDocument: data.finalClientDocument ?? null,
          finalClientContact:  data.finalClientContact  ?? null,
          finalClientPhone:    data.finalClientPhone    ?? null,
          zipCode:             data.zipCode      ?? null,
          street:              data.street       ?? null,
          streetNumber:        data.streetNumber ?? null,
          complement:          data.complement   ?? null,
          neighborhood:        data.neighborhood ?? null,
          city:                data.city         ?? null,
          state:               data.state        ?? null,
          reference:           data.reference    ?? null,
          latitude:            data.latitude     ?? null,
          longitude:           data.longitude    ?? null,
          description:         data.description  ?? null,
          observations:        data.observations ?? null,
          requestedDate:       data.requestedDate ? new Date(data.requestedDate) : null,
          isUrgent:            data.isUrgent,
          requestNumber:       '', // gerado pelo trigger
        },
      })

      // Vincular tipos de serviço
      await tx.requestServiceType.createMany({
        data: data.serviceTypeIds.map((serviceTypeId) => ({
          requestId: created.id,
          serviceTypeId,
        })),
      })

      // Registrar histórico
      await tx.requestHistory.create({
        data: {
          requestId:    created.id,
          performedBy:  requester.sub,
          action:       'Solicitação criada',
          toStatus:     'REQUESTED',
          observations: null,
        },
      })

      return created
    })

    await logAudit({
      userId: requester.sub, action: 'CREATE',
      entityType: 'request', entityId: request.id,
      newValues: { status: 'REQUESTED', clientId: data.clientId, isUrgent: data.isUrgent },
      ipAddress: req.ip,
    })

    return reply.status(201).send({ id: request.id, requestNumber: request.requestNumber, status: request.status })
  })

  // PATCH /requests/:id — atualizar dados da solicitação
  app.patch('/requests/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id }    = ParamsSchema.parse(req.params)
    const requester = req.user as JwtPayload

    const existing = await prisma.request.findFirst({ where: { id, deletedAt: null } })
    if (!existing) throw new NotFoundError('Solicitação', id)

    // Cliente só edita status REQUESTED; analista/admin editam em qualquer status não terminal
    if (requester.role === 'CLIENT') {
      assertClientAccess(
        { id: requester.sub, role: requester.role, email: requester.email, clientIds: requester.clientIds, defaultClientId: requester.defaultClientId },
        existing.clientId,
      )
      if (!['REQUESTED'].includes(existing.status)) {
        throw new ForbiddenError('Solicitação não pode ser editada no status atual.')
      }
    }

    const result = UpdateRequestSchema.safeParse(req.body)
    if (!result.success) {
      return reply.status(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: result.error.flatten().fieldErrors },
      })
    }
    const data = result.data

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const { serviceTypeIds, ...rest } = data
      await tx.request.update({ where: { id }, data: rest })

      if (serviceTypeIds) {
        await tx.requestServiceType.deleteMany({ where: { requestId: id } })
        await tx.requestServiceType.createMany({
          data: serviceTypeIds.map((serviceTypeId) => ({ requestId: id, serviceTypeId })),
        })
      }
    })

    await logAudit({
      userId: requester.sub, action: 'UPDATE',
      entityType: 'request', entityId: id,
      oldValues: { status: existing.status }, newValues: data, ipAddress: req.ip,
    })

    return reply.send({ id, message: 'Solicitação atualizada.' })
  })

  // POST /requests/:id/status — transição de status
  app.post('/requests/:id/status', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id }    = ParamsSchema.parse(req.params)
    const requester = req.user as JwtPayload

    const result = ChangeStatusSchema.safeParse(req.body)
    if (!result.success) {
      return reply.status(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: result.error.flatten().fieldErrors },
      })
    }
    const { status: newStatus, observations, estimatedDate } = result.data

    const existing = await prisma.request.findFirst({
      where: { id, deletedAt: null },
    })
    if (!existing) throw new NotFoundError('Solicitação', id)

    // Isolamento: cliente só altera seus registros
    if (requester.role === 'CLIENT') {
      assertClientAccess(
        { id: requester.sub, role: requester.role, email: requester.email, clientIds: requester.clientIds, defaultClientId: requester.defaultClientId },
        existing.clientId,
      )
      // Cliente só pode definir status de decisão
      if (!CLIENT_ALLOWED_STATUS.includes(newStatus)) {
        throw new ForbiddenError(`Cliente não pode definir status '${newStatus}'.`)
      }
    }

    // Validar transição
    const currentStatus = existing.status as RequestStatus
    const allowed       = REQUEST_TRANSITIONS[currentStatus]
    if (!allowed.includes(newStatus)) {
      throw new InvalidTransitionError(currentStatus, newStatus)
    }

    // Status que exigem observação
    if (STATUS_REQUIRES_REASON.includes(newStatus) && !observations?.trim()) {
      throw new ValidationError(`Observação obrigatória para status '${newStatus}'.`)
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.request.update({
        where: { id },
        data:  {
          status: newStatus,
          ...(estimatedDate && { estimatedDate: new Date(estimatedDate) }),
        },
      })

      await tx.requestHistory.create({
        data: {
          requestId:    id,
          performedBy:  requester.sub,
          action:       `Status alterado para '${newStatus}'`,
          fromStatus:   currentStatus,
          toStatus:     newStatus,
          observations: observations ?? null,
        },
      })
    })

    await logAudit({
      userId: requester.sub, action: 'STATUS_CHANGE',
      entityType: 'request', entityId: id,
      oldValues: { status: currentStatus }, newValues: { status: newStatus, observations },
      ipAddress: req.ip,
    })

    return reply.send({ id, status: newStatus, message: 'Status atualizado.' })
  })

  // POST /requests/:id/assign — analista assume solicitação
  app.post('/requests/:id/assign', { preHandler: [app.authenticate, app.requireRole('ANALYST', 'ADMIN')] }, async (req, reply) => {
    const { id }    = ParamsSchema.parse(req.params)
    const requester = req.user as JwtPayload

    const existing = await prisma.request.findFirst({ where: { id, deletedAt: null } })
    if (!existing) throw new NotFoundError('Solicitação', id)

    const { analystId } = z.object({
      analystId: IdSchema.optional(),
    }).parse(req.body)

    const targetId = analystId ?? requester.sub

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.request.update({
        where: { id },
        data:  { assignedTo: targetId, status: 'IN_ANALYSIS' },
      })
      await tx.requestHistory.create({
        data: {
          requestId:   id,
          performedBy: requester.sub,
          action:      'Analista assumiu a solicitação',
          fromStatus:  existing.status as RequestStatus,
          toStatus:    'IN_ANALYSIS',
        },
      })
    })

    return reply.send({ id, message: 'Solicitação assumida.' })
  })

  // GET /requests/:id/history
  app.get('/requests/:id/history', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id }    = ParamsSchema.parse(req.params)
    const requester = req.user as JwtPayload

    const request = await prisma.request.findFirst({ where: { id, deletedAt: null }, select: { clientId: true } })
    if (!request) throw new NotFoundError('Solicitação', id)

    if (requester.role === 'CLIENT') {
      assertClientAccess(
        { id: requester.sub, role: requester.role, email: requester.email, clientIds: requester.clientIds, defaultClientId: requester.defaultClientId },
        request.clientId,
      )
    }

    const history = await prisma.requestHistory.findMany({
      where:   { requestId: id },
      orderBy: { performedAt: 'desc' },
      include: { performedByUser: { select: { id: true, name: true, role: true } } },
    })

    return reply.send(history)
  })

  // POST /requests/:id/notes — adicionar nota interna
  app.post('/requests/:id/notes', { preHandler: [app.authenticate, app.requireRole('ANALYST', 'ADMIN')] }, async (req, reply) => {
    const { id } = ParamsSchema.parse(req.params)
    const requester = req.user as JwtPayload

    const result = AddInternalNoteSchema.safeParse(req.body)
    if (!result.success) {
      return reply.status(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: result.error.flatten().fieldErrors },
      })
    }

    const existing = await prisma.request.findFirst({ where: { id, deletedAt: null } })
    if (!existing) throw new NotFoundError('Solicitação', id)

    await prisma.requestHistory.create({
      data: {
        requestId: id,
        performedBy: requester.sub,
        action: 'NOTA INTERNA',
        observations: result.data.note,
      },
    })

    await logAudit({
      userId: requester.sub,
      action: 'UPDATE',
      entityType: 'request',
      entityId: id,
      newValues: { internalNote: result.data.note },
      ipAddress: req.ip,
    })

    return reply.status(201).send({ message: 'Nota interna registrada.' })
  })
}
