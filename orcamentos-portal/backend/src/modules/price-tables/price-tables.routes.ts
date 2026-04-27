// ============================================================
// Módulo Tabela de Preços — por cliente
// Admin: CRUD completo | Analyst: leitura | Client: sem acesso
// ============================================================
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import prisma from '../../infrastructure/database/prisma.js'
import { NotFoundError, ForbiddenError } from '../../shared/errors/index.js'
import { logAudit } from '../../shared/utils/index.js'
import type { JwtPayload } from '../../shared/types/index.js'

// ── Schemas ───────────────────────────────────────────────
const TableParamsSchema = z.object({
  clientId: z.string().uuid(),
  tableId:  z.string().uuid().optional(),
})

const CreateTableSchema = z.object({
  name:        z.string().min(2).max(255),
  description: z.string().optional().nullable(),
  validFrom:   z.string().datetime().optional().nullable(),
  validUntil:  z.string().datetime().optional().nullable(),
})

const UpdateTableSchema = CreateTableSchema.partial().extend({
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
})

const CreateItemSchema = z.object({
  serviceTypeId: z.string().uuid().optional().nullable(),
  code:          z.string().min(1).max(50),
  description:   z.string().min(1).max(500),
  unit:          z.string().min(1).max(30),
  unitValue:     z.number().positive(),
  notes:         z.string().optional().nullable(),
  sortOrder:     z.number().int().optional().default(0),
})

const UpdateItemSchema = CreateItemSchema.partial().extend({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
})

const ItemParamsSchema = z.object({
  clientId: z.string().uuid(),
  tableId:  z.string().uuid(),
  itemId:   z.string().uuid().optional(),
})

// ── Routes ────────────────────────────────────────────────
export async function priceTableRoutes(app: FastifyInstance) {
  const analystAdmin = [app.authenticate, app.requireRole('ANALYST', 'ADMIN')]
  const adminOnly    = [app.authenticate, app.requireRole('ADMIN')]

  // ─── TABELAS ─────────────────────────────────────────────

  // GET /clients/:clientId/price-tables
  app.get('/clients/:clientId/price-tables', { preHandler: analystAdmin }, async (req, reply) => {
    const { clientId } = TableParamsSchema.parse(req.params)
    const { includeArchived } = z.object({
      includeArchived: z.coerce.boolean().optional().default(false),
    }).parse(req.query)

    await assertClientExists(clientId)

    const tables = await prisma.priceTable.findMany({
      where: {
        clientId,
        deletedAt: null,
        ...(includeArchived ? {} : { status: { not: 'ARCHIVED' } }),
      },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { items: true } } },
    })

    return reply.send(tables)
  })

  // GET /clients/:clientId/price-tables/:tableId
  app.get('/clients/:clientId/price-tables/:tableId', { preHandler: analystAdmin }, async (req, reply) => {
    const { clientId, tableId } = z.object({
      clientId: z.string().uuid(), tableId: z.string().uuid(),
    }).parse(req.params)

    const { serviceTypeId, q, includeInactive } = z.object({
      serviceTypeId:  z.string().uuid().optional(),
      q:              z.string().optional(),
      includeInactive: z.coerce.boolean().optional().default(false),
    }).parse(req.query)

    const table = await prisma.priceTable.findFirst({
      where: { id: tableId, clientId, deletedAt: null },
      include: {
        items: {
          where: {
            ...(includeInactive ? {} : { status: 'ACTIVE' }),
            ...(serviceTypeId && { serviceTypeId }),
            ...(q && {
              OR: [
                { code:        { contains: q, mode: 'insensitive' as const } },
                { description: { contains: q, mode: 'insensitive' as const } },
              ],
            }),
          },
          orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
          include: { serviceType: { select: { id: true, name: true } } },
        },
        createdByUser: { select: { id: true, name: true } },
      },
    })

    if (!table) throw new NotFoundError('Tabela de preços', tableId)
    return reply.send(table)
  })

  // POST /clients/:clientId/price-tables
  app.post('/clients/:clientId/price-tables', { preHandler: adminOnly }, async (req, reply) => {
    const { clientId } = TableParamsSchema.parse(req.params)
    await assertClientExists(clientId)

    const result = CreateTableSchema.safeParse(req.body)
    if (!result.success) {
      return reply.status(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: result.error.flatten().fieldErrors },
      })
    }

    const requester = req.user as JwtPayload
    // Obter próxima versão para este cliente
    const lastTable = await prisma.priceTable.findFirst({
      where: { clientId, deletedAt: null },
      orderBy: { version: 'desc' },
    })
    const version = (lastTable?.version ?? 0) + 1

    const table = await prisma.priceTable.create({
      data: {
        clientId,
        name:        result.data.name,
        description: result.data.description ?? null,
        validFrom:   result.data.validFrom   ? new Date(result.data.validFrom)  : null,
        validUntil:  result.data.validUntil  ? new Date(result.data.validUntil) : null,
        version,
        createdBy: requester.sub,
      },
    })

    await logAudit({
      userId: requester.sub, action: 'CREATE',
      entityType: 'price_table', entityId: table.id,
      newValues: { name: table.name, clientId, version }, ipAddress: req.ip,
    })

    return reply.status(201).send(table)
  })

  // PATCH /clients/:clientId/price-tables/:tableId
  app.patch('/clients/:clientId/price-tables/:tableId', { preHandler: adminOnly }, async (req, reply) => {
    const { clientId, tableId } = z.object({
      clientId: z.string().uuid(), tableId: z.string().uuid(),
    }).parse(req.params)

    const result = UpdateTableSchema.safeParse(req.body)
    if (!result.success) {
      return reply.status(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: result.error.flatten().fieldErrors },
      })
    }

    const existing = await prisma.priceTable.findFirst({ where: { id: tableId, clientId, deletedAt: null } })
    if (!existing) throw new NotFoundError('Tabela de preços', tableId)

    const requester = req.user as JwtPayload
    const updated   = await prisma.priceTable.update({
      where: { id: tableId },
      data:  {
        ...result.data,
        validFrom:  result.data.validFrom  ? new Date(result.data.validFrom)  : undefined,
        validUntil: result.data.validUntil ? new Date(result.data.validUntil) : undefined,
      },
    })

    await logAudit({
      userId: requester.sub, action: 'UPDATE',
      entityType: 'price_table', entityId: tableId,
      oldValues: { name: existing.name, status: existing.status },
      newValues: result.data, ipAddress: req.ip,
    })

    return reply.send(updated)
  })

  // DELETE /clients/:clientId/price-tables/:tableId
  app.delete('/clients/:clientId/price-tables/:tableId', { preHandler: adminOnly }, async (req, reply) => {
    const { clientId, tableId } = z.object({
      clientId: z.string().uuid(), tableId: z.string().uuid(),
    }).parse(req.params)

    const existing = await prisma.priceTable.findFirst({ where: { id: tableId, clientId, deletedAt: null } })
    if (!existing) throw new NotFoundError('Tabela de preços', tableId)

    const requester = req.user as JwtPayload
    await prisma.priceTable.update({ where: { id: tableId }, data: { deletedAt: new Date(), status: 'ARCHIVED' } })

    await logAudit({
      userId: requester.sub, action: 'DELETE',
      entityType: 'price_table', entityId: tableId,
      oldValues: { name: existing.name }, ipAddress: req.ip,
    })

    return reply.status(204).send()
  })

  // POST /clients/:clientId/price-tables/:tableId/clone
  // Clona uma tabela inteira (útil para criar nova versão mantendo itens)
  app.post('/clients/:clientId/price-tables/:tableId/clone', { preHandler: adminOnly }, async (req, reply) => {
    const { clientId, tableId } = z.object({
      clientId: z.string().uuid(), tableId: z.string().uuid(),
    }).parse(req.params)

    const source = await prisma.priceTable.findFirst({
      where: { id: tableId, clientId, deletedAt: null },
      include: { items: { where: { status: 'ACTIVE' } } },
    })
    if (!source) throw new NotFoundError('Tabela de preços', tableId)

    const { newName } = z.object({ newName: z.string().min(2).max(255).optional() }).parse(req.body)
    const requester   = req.user as JwtPayload

    const lastTable = await prisma.priceTable.findFirst({
      where: { clientId, deletedAt: null }, orderBy: { version: 'desc' },
    })
    const version = (lastTable?.version ?? 0) + 1

    const cloned = await prisma.$transaction(async (tx) => {
      const newTable = await tx.priceTable.create({
        data: {
          clientId,
          name:      newName ?? `${source.name} (cópia)`,
          description: source.description,
          version,
          status:    'INACTIVE', // começa inativa até admin ativar
          createdBy: requester.sub,
        },
      })

      if (source.items.length > 0) {
        await tx.priceItem.createMany({
          data: source.items.map((item) => ({
            priceTableId:  newTable.id,
            serviceTypeId: item.serviceTypeId,
            code:          item.code,
            description:   item.description,
            unit:          item.unit,
            unitValue:     item.unitValue,
            notes:         item.notes,
            sortOrder:     item.sortOrder,
            createdBy:     requester.sub,
          })),
        })
      }

      return newTable
    })

    await logAudit({
      userId: requester.sub, action: 'CREATE',
      entityType: 'price_table', entityId: cloned.id,
      newValues: { clonedFrom: tableId, name: cloned.name, version }, ipAddress: req.ip,
    })

    return reply.status(201).send({ ...cloned, message: 'Tabela clonada com sucesso.' })
  })

  // ─── ITENS ───────────────────────────────────────────────

  // POST /clients/:clientId/price-tables/:tableId/items
  app.post('/clients/:clientId/price-tables/:tableId/items', { preHandler: adminOnly }, async (req, reply) => {
    const { clientId, tableId } = ItemParamsSchema.parse(req.params)

    const table = await prisma.priceTable.findFirst({ where: { id: tableId, clientId, deletedAt: null } })
    if (!table) throw new NotFoundError('Tabela de preços', tableId)

    const result = CreateItemSchema.safeParse(req.body)
    if (!result.success) {
      return reply.status(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: result.error.flatten().fieldErrors },
      })
    }

    const requester = req.user as JwtPayload
    const item = await prisma.priceItem.create({
      data: {
        priceTableId:  tableId,
        serviceTypeId: result.data.serviceTypeId ?? null,
        code:          result.data.code,
        description:   result.data.description,
        unit:          result.data.unit,
        unitValue:     result.data.unitValue,
        notes:         result.data.notes ?? null,
        sortOrder:     result.data.sortOrder ?? 0,
        createdBy:     requester.sub,
      },
      include: { serviceType: { select: { id: true, name: true } } },
    })

    await logAudit({
      userId: requester.sub, action: 'CREATE',
      entityType: 'price_item', entityId: item.id,
      newValues: { code: item.code, unitValue: item.unitValue.toString() }, ipAddress: req.ip,
    })

    return reply.status(201).send(item)
  })

  // PATCH /clients/:clientId/price-tables/:tableId/items/:itemId
  app.patch('/clients/:clientId/price-tables/:tableId/items/:itemId', { preHandler: adminOnly }, async (req, reply) => {
    const { clientId, tableId, itemId } = z.object({
      clientId: z.string().uuid(), tableId: z.string().uuid(), itemId: z.string().uuid(),
    }).parse(req.params)

    const table = await prisma.priceTable.findFirst({ where: { id: tableId, clientId, deletedAt: null } })
    if (!table) throw new NotFoundError('Tabela de preços', tableId)

    const existing = await prisma.priceItem.findFirst({ where: { id: itemId, priceTableId: tableId } })
    if (!existing) throw new NotFoundError('Item', itemId)

    const result = UpdateItemSchema.safeParse(req.body)
    if (!result.success) {
      return reply.status(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: result.error.flatten().fieldErrors },
      })
    }

    const requester = req.user as JwtPayload
    const updated   = await prisma.priceItem.update({
      where: { id: itemId },
      data:  result.data,
      include: { serviceType: { select: { id: true, name: true } } },
    })

    await logAudit({
      userId: requester.sub, action: 'VALUE_EDIT',
      entityType: 'price_item', entityId: itemId,
      oldValues: { unitValue: existing.unitValue.toString(), description: existing.description },
      newValues: result.data, ipAddress: req.ip,
    })

    return reply.send(updated)
  })

  // DELETE /clients/:clientId/price-tables/:tableId/items/:itemId
  app.delete('/clients/:clientId/price-tables/:tableId/items/:itemId', { preHandler: adminOnly }, async (req, reply) => {
    const { clientId, tableId, itemId } = z.object({
      clientId: z.string().uuid(), tableId: z.string().uuid(), itemId: z.string().uuid(),
    }).parse(req.params)

    const table = await prisma.priceTable.findFirst({ where: { id: tableId, clientId, deletedAt: null } })
    if (!table) throw new NotFoundError('Tabela de preços', tableId)

    const existing = await prisma.priceItem.findFirst({ where: { id: itemId, priceTableId: tableId } })
    if (!existing) throw new NotFoundError('Item', itemId)

    const requester = req.user as JwtPayload
    await prisma.priceItem.update({ where: { id: itemId }, data: { status: 'INACTIVE' } })

    await logAudit({
      userId: requester.sub, action: 'DELETE',
      entityType: 'price_item', entityId: itemId,
      oldValues: { code: existing.code, description: existing.description }, ipAddress: req.ip,
    })

    return reply.status(204).send()
  })
}

// ── Helper ────────────────────────────────────────────────
async function assertClientExists(clientId: string) {
  const client = await prisma.client.findFirst({ where: { id: clientId, deletedAt: null } })
  if (!client) throw new NotFoundError('Cliente', clientId)
}
