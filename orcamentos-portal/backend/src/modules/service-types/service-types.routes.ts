// ============================================================
// Módulo Tipos de Serviço — CRUD (Admin gerencia, todos leem)
// ============================================================
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import prisma from '../../infrastructure/database/prisma.js'
import { NotFoundError } from '../../shared/errors/index.js'
import { logAudit } from '../../shared/utils/index.js'
import type { JwtPayload } from '../../shared/types/index.js'

const ServiceTypeSchema = z.object({
  name:        z.string().min(2).max(100),
  description: z.string().max(500).optional().nullable(),
  sortOrder:   z.number().int().optional().default(0),
})

const ParamsSchema = z.object({ id: z.string().uuid() })

export async function serviceTypeRoutes(app: FastifyInstance) {
  const adminOnly = [app.authenticate, app.requireRole('ADMIN')]

  // GET /service-types — todos autenticados
  app.get('/service-types', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { includeInactive } = z.object({
      includeInactive: z.coerce.boolean().optional().default(false),
    }).parse(req.query)

    const types = await prisma.serviceType.findMany({
      where:   { ...(includeInactive ? {} : { status: 'ACTIVE' }) },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
    return reply.send(types)
  })

  // POST /service-types
  app.post('/service-types', { preHandler: adminOnly }, async (req, reply) => {
    const result = ServiceTypeSchema.safeParse(req.body)
    if (!result.success) {
      return reply.status(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: result.error.flatten().fieldErrors },
      })
    }
    const requester = req.user as JwtPayload
    const created   = await prisma.serviceType.create({ data: result.data })

    await logAudit({
      userId: requester.sub, action: 'CREATE',
      entityType: 'service_type', entityId: created.id,
      newValues: { name: created.name }, ipAddress: req.ip,
    })

    return reply.status(201).send(created)
  })

  // PATCH /service-types/:id
  app.patch('/service-types/:id', { preHandler: adminOnly }, async (req, reply) => {
    const { id } = ParamsSchema.parse(req.params)
    const result = ServiceTypeSchema.partial().extend({
      status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    }).safeParse(req.body)

    if (!result.success) {
      return reply.status(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: result.error.flatten().fieldErrors },
      })
    }

    const existing = await prisma.serviceType.findUnique({ where: { id } })
    if (!existing) throw new NotFoundError('Tipo de serviço', id)

    const requester = req.user as JwtPayload
    const updated   = await prisma.serviceType.update({ where: { id }, data: result.data })

    await logAudit({
      userId: requester.sub, action: 'UPDATE',
      entityType: 'service_type', entityId: id,
      oldValues: { name: existing.name, status: existing.status },
      newValues: result.data, ipAddress: req.ip,
    })

    return reply.send(updated)
  })

  // DELETE /service-types/:id (soft — desativa)
  app.delete('/service-types/:id', { preHandler: adminOnly }, async (req, reply) => {
    const { id } = ParamsSchema.parse(req.params)
    const existing = await prisma.serviceType.findUnique({ where: { id } })
    if (!existing) throw new NotFoundError('Tipo de serviço', id)

    const requester = req.user as JwtPayload
    await prisma.serviceType.update({ where: { id }, data: { status: 'INACTIVE' } })

    await logAudit({
      userId: requester.sub, action: 'DELETE',
      entityType: 'service_type', entityId: id,
      oldValues: { name: existing.name }, ipAddress: req.ip,
    })

    return reply.status(204).send()
  })
}
