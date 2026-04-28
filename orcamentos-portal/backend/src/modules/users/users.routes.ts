// ============================================================
// Módulo Usuários — CRUD (Admin)
// ============================================================
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'
import prisma from '../../infrastructure/database/prisma.js'
import { NotFoundError, ConflictError, ForbiddenError } from '../../shared/errors/index.js'
import { parsePagination, buildPaginatedResult, logAudit } from '../../shared/utils/index.js'
import { assertSelfOrAdmin } from '../../shared/middleware/auth.js'
import type { JwtPayload } from '../../shared/types/index.js'

const IdSchema = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  'ID inválido.',
)

// ── Schemas ───────────────────────────────────────────────
const CreateUserSchema = z.object({
  name:     z.string().min(2).max(255),
  email:    z.string().email(),
  password: z.string().min(8).max(100),
  role:     z.enum(['CLIENT', 'ANALYST', 'ADMIN']),
  clientIds: z.array(IdSchema).optional().default([]),
  defaultClientId: IdSchema.optional().nullable(),
})

const UpdateUserSchema = z.object({
  name:     z.string().min(2).max(255).optional(),
  email:    z.string().email().optional(),
  password: z.string().min(8).max(100).optional(),
  status:   z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  role:     z.enum(['CLIENT', 'ANALYST', 'ADMIN']).optional(),
})

const UserParamsSchema = z.object({ id: IdSchema })

const UserQuerySchema = z.object({
  page:   z.coerce.number().optional(),
  limit:  z.coerce.number().optional(),
  role:   z.enum(['CLIENT', 'ANALYST', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  q:      z.string().optional(),
})

// ── Routes ────────────────────────────────────────────────
export async function userRoutes(app: FastifyInstance) {
  const adminOnly = [app.authenticate, app.requireRole('ADMIN')]

  // GET /users
  app.get('/users', { preHandler: adminOnly }, async (req, reply) => {
    const query  = UserQuerySchema.parse(req.query)
    const { page, limit, skip } = parsePagination(query)

    const where = {
      deletedAt: null,
      ...(query.role   && { role:   query.role }),
      ...(query.status && { status: query.status }),
      ...(query.q      && {
        OR: [
          { name:  { contains: query.q, mode: 'insensitive' as const } },
          { email: { contains: query.q, mode: 'insensitive' as const } },
        ],
      }),
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, email: true,
          role: true, status: true, lastLoginAt: true, createdAt: true,
          clientUsers: { select: { clientId: true, isDefault: true, client: { select: { id: true, name: true } } } },
        },
      }),
      prisma.user.count({ where }),
    ])

    return reply.send(buildPaginatedResult(users, total, page, limit))
  })

  // GET /users/:id
  app.get('/users/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id }    = UserParamsSchema.parse(req.params)
    const requester = req.user as JwtPayload
    assertSelfOrAdmin(
      { id: requester.sub, role: requester.role, email: requester.email, clientIds: requester.clientIds, defaultClientId: requester.defaultClientId },
      id,
    )

    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true, name: true, email: true,
        role: true, status: true, lastLoginAt: true, createdAt: true,
        clientUsers: { select: { clientId: true, isDefault: true, client: { select: { id: true, name: true } } } },
      },
    })
    if (!user) throw new NotFoundError('Usuário', id)
    return reply.send(user)
  })

  // POST /users
  app.post('/users', { preHandler: adminOnly }, async (req, reply) => {
    const result = CreateUserSchema.safeParse(req.body)
    if (!result.success) {
      return reply.status(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: result.error.flatten().fieldErrors },
      })
    }
    const data = result.data

    const exists = await prisma.user.findFirst({ where: { email: data.email.toLowerCase(), deletedAt: null } })
    if (exists) throw new ConflictError(`E-mail '${data.email}' já está em uso.`)

    const passwordHash = await bcrypt.hash(data.password, 12)
    const requester    = req.user as JwtPayload

    const user = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.user.create({
        data: {
          name:         data.name,
          email:        data.email.toLowerCase(),
          passwordHash,
          role:         data.role,
        },
      })

      // Vincular clientes se informados
      if (data.clientIds.length > 0) {
        await tx.clientUser.createMany({
          data: data.clientIds.map((cId, idx) => ({
            userId:    created.id,
            clientId:  cId,
            isDefault: data.defaultClientId
              ? cId === data.defaultClientId
              : idx === 0,
          })),
        })
      }

      return created
    })

    await logAudit({
      userId:     requester.sub,
      action:     'CREATE',
      entityType: 'user',
      entityId:   user.id,
      newValues:  { name: user.name, email: user.email, role: user.role },
      ipAddress:  req.ip,
    })

    return reply.status(201).send({ id: user.id, name: user.name, email: user.email, role: user.role })
  })

  // PATCH /users/:id
  app.patch('/users/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id }    = UserParamsSchema.parse(req.params)
    const requester = req.user as JwtPayload

    // Apenas admin pode alterar role/status; outros usuários só atualizam a si mesmos
    if (requester.role !== 'ADMIN' && requester.sub !== id) {
      throw new ForbiddenError('Acesso negado.')
    }

    const result = UpdateUserSchema.safeParse(req.body)
    if (!result.success) {
      return reply.status(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: result.error.flatten().fieldErrors },
      })
    }
    const data = result.data

    // Não-admin não pode alterar role ou status
    if (requester.role !== 'ADMIN') {
      delete data.role
      delete data.status
    }

    const existing = await prisma.user.findFirst({ where: { id, deletedAt: null } })
    if (!existing) throw new NotFoundError('Usuário', id)

    const updateData: Record<string, unknown> = {}
    if (data.name)     updateData.name     = data.name
    if (data.email)    updateData.email    = data.email.toLowerCase()
    if (data.role)     updateData.role     = data.role
    if (data.status)   updateData.status   = data.status
    if (data.password) updateData.passwordHash = await bcrypt.hash(data.password, 12)

    const updated = await prisma.user.update({ where: { id }, data: updateData })

    await logAudit({
      userId:     requester.sub,
      action:     'UPDATE',
      entityType: 'user',
      entityId:   id,
      oldValues:  { name: existing.name, email: existing.email, role: existing.role, status: existing.status },
      newValues:  updateData,
      ipAddress:  req.ip,
    })

    return reply.send({ id: updated.id, name: updated.name, email: updated.email, role: updated.role, status: updated.status })
  })

  // DELETE /users/:id (soft delete)
  app.delete('/users/:id', { preHandler: adminOnly }, async (req, reply) => {
    const { id }    = UserParamsSchema.parse(req.params)
    const requester = req.user as JwtPayload

    if (requester.sub === id) {
      throw new ForbiddenError('Não é possível excluir o próprio usuário.')
    }

    const existing = await prisma.user.findFirst({ where: { id, deletedAt: null } })
    if (!existing) throw new NotFoundError('Usuário', id)

    await prisma.user.update({ where: { id }, data: { deletedAt: new Date(), status: 'INACTIVE' } })

    await logAudit({
      userId:     requester.sub,
      action:     'DELETE',
      entityType: 'user',
      entityId:   id,
      oldValues:  { name: existing.name, email: existing.email },
      ipAddress:  req.ip,
    })

    return reply.status(204).send()
  })

  // POST /users/:id/clients — vincular cliente ao usuário
  app.post('/users/:id/clients', { preHandler: adminOnly }, async (req, reply) => {
    const { id } = UserParamsSchema.parse(req.params)
    const { clientId, isDefault } = z.object({
      clientId:  IdSchema,
      isDefault: z.boolean().optional().default(false),
    }).parse(req.body)

    const user   = await prisma.user.findFirst({ where: { id, deletedAt: null } })
    if (!user) throw new NotFoundError('Usuário', id)

    const client = await prisma.client.findFirst({ where: { id: clientId, deletedAt: null } })
    if (!client) throw new NotFoundError('Cliente', clientId)

    const existing = await prisma.clientUser.findFirst({ where: { userId: id, clientId } })
    if (existing) throw new ConflictError('Usuário já vinculado a este cliente.')

    if (isDefault) {
      await prisma.clientUser.updateMany({ where: { userId: id }, data: { isDefault: false } })
    }

    await prisma.clientUser.create({ data: { userId: id, clientId, isDefault } })

    return reply.status(201).send({ message: 'Vínculo criado.' })
  })

  // PUT /users/:id/clients — substituir vínculos do usuário
  app.put('/users/:id/clients', { preHandler: adminOnly }, async (req, reply) => {
    const { id } = UserParamsSchema.parse(req.params)
    const { clientIds, defaultClientId } = z.object({
      clientIds: z.array(IdSchema).min(1, 'Selecione ao menos um cliente.'),
      defaultClientId: IdSchema.optional().nullable(),
    }).parse(req.body)

    const user = await prisma.user.findFirst({ where: { id, deletedAt: null } })
    if (!user) throw new NotFoundError('Usuário', id)

    const clients = await prisma.client.findMany({
      where: { id: { in: clientIds }, deletedAt: null },
      select: { id: true },
    })
    if (clients.length !== clientIds.length) {
      throw new NotFoundError('Cliente', 'um ou mais IDs informados')
    }

    const effectiveDefault = defaultClientId && clientIds.includes(defaultClientId)
      ? defaultClientId
      : clientIds[0]

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.clientUser.deleteMany({ where: { userId: id } })
      await tx.clientUser.createMany({
        data: clientIds.map((clientId) => ({
          userId: id,
          clientId,
          isDefault: clientId === effectiveDefault,
        })),
      })
    })

    return reply.send({ message: 'Vínculos atualizados com sucesso.' })
  })

  // DELETE /users/:id/clients/:clientId — desvincular
  app.delete('/users/:id/clients/:clientId', { preHandler: adminOnly }, async (req, reply) => {
    const { id, clientId } = z.object({
      id: IdSchema, clientId: IdSchema,
    }).parse(req.params)

    const link = await prisma.clientUser.findFirst({ where: { userId: id, clientId } })
    if (!link) throw new NotFoundError('Vínculo usuário-cliente')

    await prisma.clientUser.delete({ where: { id: link.id } })
    return reply.status(204).send()
  })
}
