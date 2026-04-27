// ============================================================
// Módulo Clientes — CRUD (Admin + Analyst read)
// ============================================================
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import prisma from '../../infrastructure/database/prisma.js'
import { NotFoundError, ConflictError } from '../../shared/errors/index.js'
import { parsePagination, buildPaginatedResult, logAudit } from '../../shared/utils/index.js'
import type { JwtPayload } from '../../shared/types/index.js'

const ClientSchema = z.object({
  name:      z.string().min(2).max(255),
  tradeName: z.string().max(255).optional().nullable(),
  document:  z.string().max(18).optional().nullable(),
  email:     z.string().email().optional().nullable(),
  phone:     z.string().max(20).optional().nullable(),
})

const UpdateClientSchema = ClientSchema.partial().extend({
  isActive: z.boolean().optional(),
})

const ParamsSchema = z.object({ id: z.string().uuid() })

const QuerySchema = z.object({
  page:     z.coerce.number().optional(),
  limit:    z.coerce.number().optional(),
  q:        z.string().optional(),
  isActive: z.coerce.boolean().optional(),
})

export async function clientRoutes(app: FastifyInstance) {
  const adminOnly    = [app.authenticate, app.requireRole('ADMIN')]
  const analystAdmin = [app.authenticate, app.requireRole('ANALYST', 'ADMIN')]

  // GET /clients
  app.get('/clients', { preHandler: analystAdmin }, async (req, reply) => {
    const query = QuerySchema.parse(req.query)
    const { page, limit, skip } = parsePagination(query)

    const where = {
      deletedAt: null,
      ...(query.isActive !== undefined && { isActive: query.isActive }),
      ...(query.q && {
        OR: [
          { name:      { contains: query.q, mode: 'insensitive' as const } },
          { tradeName: { contains: query.q, mode: 'insensitive' as const } },
          { document:  { contains: query.q, mode: 'insensitive' as const } },
        ],
      }),
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where, skip, take: limit,
        orderBy: { name: 'asc' },
        select: {
          id: true, name: true, tradeName: true,
          document: true, email: true, phone: true,
          isActive: true, createdAt: true,
          _count: { select: { requests: true } },
        },
      }),
      prisma.client.count({ where }),
    ])

    return reply.send(buildPaginatedResult(clients, total, page, limit))
  })

  // GET /clients/:id
  app.get('/clients/:id', { preHandler: analystAdmin }, async (req, reply) => {
    const { id } = ParamsSchema.parse(req.params)
    const client = await prisma.client.findFirst({
      where: { id, deletedAt: null },
      include: {
        clientUsers: {
          include: { user: { select: { id: true, name: true, email: true, role: true, status: true } } },
        },
        priceTables: {
          where:   { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select:  { id: true, name: true, status: true, version: true, createdAt: true },
        },
        _count: { select: { requests: true } },
      },
    })
    if (!client) throw new NotFoundError('Cliente', id)
    return reply.send(client)
  })

  // POST /clients
  app.post('/clients', { preHandler: adminOnly }, async (req, reply) => {
    const result = ClientSchema.safeParse(req.body)
    if (!result.success) {
      return reply.status(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: result.error.flatten().fieldErrors },
      })
    }
    const data      = result.data
    const requester = req.user as JwtPayload

    if (data.document) {
      const dup = await prisma.client.findFirst({ where: { document: data.document, deletedAt: null } })
      if (dup) throw new ConflictError(`Documento '${data.document}' já cadastrado.`)
    }

    const client = await prisma.client.create({
      data: {
        name:      data.name,
        tradeName: data.tradeName ?? null,
        document:  data.document  ?? null,
        email:     data.email     ?? null,
        phone:     data.phone     ?? null,
      },
    })

    await logAudit({
      userId: requester.sub, action: 'CREATE',
      entityType: 'client', entityId: client.id,
      newValues: { name: client.name }, ipAddress: req.ip,
    })

    return reply.status(201).send(client)
  })

  // PATCH /clients/:id
  app.patch('/clients/:id', { preHandler: adminOnly }, async (req, reply) => {
    const { id } = ParamsSchema.parse(req.params)
    const result = UpdateClientSchema.safeParse(req.body)
    if (!result.success) {
      return reply.status(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: result.error.flatten().fieldErrors },
      })
    }
    const existing = await prisma.client.findFirst({ where: { id, deletedAt: null } })
    if (!existing) throw new NotFoundError('Cliente', id)

    const requester = req.user as JwtPayload
    const updated   = await prisma.client.update({ where: { id }, data: result.data })

    await logAudit({
      userId: requester.sub, action: 'UPDATE',
      entityType: 'client', entityId: id,
      oldValues: { name: existing.name, isActive: existing.isActive },
      newValues: result.data, ipAddress: req.ip,
    })

    return reply.send(updated)
  })

  // DELETE /clients/:id (soft delete)
  app.delete('/clients/:id', { preHandler: adminOnly }, async (req, reply) => {
    const { id }    = ParamsSchema.parse(req.params)
    const existing  = await prisma.client.findFirst({ where: { id, deletedAt: null } })
    if (!existing) throw new NotFoundError('Cliente', id)

    const requester = req.user as JwtPayload
    await prisma.client.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } })

    await logAudit({
      userId: requester.sub, action: 'DELETE',
      entityType: 'client', entityId: id,
      oldValues: { name: existing.name }, ipAddress: req.ip,
    })

    return reply.status(204).send()
  })
}
