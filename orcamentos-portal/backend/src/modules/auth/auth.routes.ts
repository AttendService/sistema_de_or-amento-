// ============================================================
// Módulo Auth — Login, Refresh, Me, Logout
// ============================================================
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import prisma from '../../infrastructure/database/prisma.js'
import { UnauthorizedError, AppError } from '../../shared/errors/index.js'
import { logAudit } from '../../shared/utils/index.js'
import type { JwtPayload } from '../../shared/types/index.js'

// ── Schemas ───────────────────────────────────────────────
const LoginSchema = z.object({
  email:    z.string().email('E-mail inválido.'),
  password: z.string().min(1, 'Senha obrigatória.'),
})

const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
})

// ── Service ───────────────────────────────────────────────
export async function loginService(
  email: string,
  password: string,
  ip?: string,
): Promise<{ accessToken: string; refreshToken: string; user: object }> {
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase().trim(), deletedAt: null },
    include: {
      clientUsers: { where: {}, include: { client: { select: { id: true, name: true } } } },
    },
  })

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    await logAudit({
      action: 'UPDATE',
      entityType: 'auth',
      entityId: '00000000-0000-0000-0000-000000000000',
      newValues: { event: 'login_failed', email },
      ipAddress: ip,
    })
    throw new UnauthorizedError('E-mail ou senha inválidos.')
  }

  if (user.status !== 'ACTIVE') {
    throw new AppError('USER_INACTIVE', 'Usuário inativo ou suspenso.', 403)
  }

  const clientIds     = user.clientUsers.map((cu) => cu.clientId)
  const defaultCU     = user.clientUsers.find((cu) => cu.isDefault)
  const defaultClientId = defaultCU?.clientId ?? clientIds[0] ?? null

  const payload: JwtPayload = {
    sub:             user.id,
    email:           user.email,
    role:            user.role as JwtPayload['role'],
    clientIds,
    defaultClientId,
  }

  // Access token: 15min | Refresh token: 7 dias
  // Cast necessário pois Fastify JWT types variam por versão
  const fastifyJwt = (globalThis as any).__fastifyJwt
  const accessToken  = fastifyJwt.sign(payload, { expiresIn: '15m' })
  const refreshToken = fastifyJwt.sign({ sub: user.id, type: 'refresh' }, { expiresIn: '7d' })

  await prisma.user.update({
    where: { id: user.id },
    data:  { lastLoginAt: new Date() },
  })

  await logAudit({
    userId:     user.id,
    action:     'UPDATE',
    entityType: 'auth',
    entityId:   user.id,
    newValues:  { event: 'login_success' },
    ipAddress:  ip,
  })

  return {
    accessToken,
    refreshToken,
    user: {
      id:             user.id,
      name:           user.name,
      email:          user.email,
      role:           user.role,
      clientIds,
      defaultClientId,
      clients:        user.clientUsers.map((cu) => ({ id: cu.clientId, name: cu.client.name, isDefault: cu.isDefault })),
    },
  }
}

// ── Routes ────────────────────────────────────────────────
export async function authRoutes(app: FastifyInstance) {
  // Injeta instância JWT no global para uso no service (evita circular dependency)
  ;(globalThis as any).__fastifyJwt = app.jwt

  // POST /auth/login
  app.post('/auth/login', async (req, reply) => {
    const result = LoginSchema.safeParse(req.body)
    if (!result.success) {
      return reply.status(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: result.error.flatten().fieldErrors },
      })
    }
    const { email, password } = result.data
    const data = await loginService(email, password, req.ip)
    return reply.status(200).send(data)
  })

  // POST /auth/refresh
  app.post('/auth/refresh', async (req, reply) => {
    const result = RefreshSchema.safeParse(req.body)
    if (!result.success) {
      return reply.status(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'refreshToken obrigatório.' },
      })
    }
    try {
      const decoded = app.jwt.verify<{ sub: string; type: string }>(result.data.refreshToken)
      if (decoded.type !== 'refresh') throw new Error()

      const user = await prisma.user.findFirst({
        where:   { id: decoded.sub, deletedAt: null, status: 'ACTIVE' },
        include: { clientUsers: { include: { client: { select: { id: true, name: true } } } } },
      })
      if (!user) throw new UnauthorizedError()

      const clientIds       = user.clientUsers.map((cu) => cu.clientId)
      const defaultCU       = user.clientUsers.find((cu) => cu.isDefault)
      const defaultClientId = defaultCU?.clientId ?? clientIds[0] ?? null

      const payload: JwtPayload = {
        sub: user.id, email: user.email,
        role: user.role as JwtPayload['role'],
        clientIds, defaultClientId,
      }
      const accessToken  = app.jwt.sign(payload, { expiresIn: '15m' })
      const refreshToken = app.jwt.sign({ sub: user.id, type: 'refresh' }, { expiresIn: '7d' })

      return reply.status(200).send({ accessToken, refreshToken })
    } catch {
      return reply.status(401).send({
        error: { code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token inválido ou expirado.' },
      })
    }
  })

  // GET /auth/me
  app.get('/auth/me', { preHandler: [app.authenticate] }, async (req, reply) => {
    const user = req.user as JwtPayload & { sub: string }
    const dbUser = await prisma.user.findFirst({
      where:   { id: user.sub, deletedAt: null },
      include: { clientUsers: { include: { client: { select: { id: true, name: true } } } } },
    })
    if (!dbUser) return reply.status(404).send({ error: { code: 'USER_NOT_FOUND', message: 'Usuário não encontrado.' } })

    return reply.status(200).send({
      id:             dbUser.id,
      name:           dbUser.name,
      email:          dbUser.email,
      role:           dbUser.role,
      status:         dbUser.status,
      clients:        dbUser.clientUsers.map((cu) => ({ id: cu.clientId, name: cu.client.name, isDefault: cu.isDefault })),
    })
  })

  // POST /auth/logout (client-side token invalidation; registra auditoria)
  app.post('/auth/logout', { preHandler: [app.authenticate] }, async (req, reply) => {
    const user = req.user as JwtPayload
    await logAudit({
      userId:     user.sub,
      action:     'UPDATE',
      entityType: 'auth',
      entityId:   user.sub,
      newValues:  { event: 'logout' },
      ipAddress:  req.ip,
    })
    return reply.status(200).send({ message: 'Logout registrado.' })
  })
}
