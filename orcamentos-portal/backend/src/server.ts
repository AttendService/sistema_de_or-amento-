// ============================================================
// Portal de Orçamentos — Entry point
// ============================================================
import Fastify from 'fastify'
import fastifyJwt from '@fastify/jwt'
import fastifyCors from '@fastify/cors'
import fastifyHelmet from '@fastify/helmet'
import fastifyRateLimit from '@fastify/rate-limit'
import net from 'node:net'
import { URL } from 'node:url'

import { authRoutes }        from './modules/auth/auth.routes.js'
import { passwordResetRoutes } from './modules/auth/password-reset.routes.js'
import { userRoutes }        from './modules/users/users.routes.js'
import { clientRoutes }      from './modules/clients/clients.routes.js'
import { serviceTypeRoutes } from './modules/service-types/service-types.routes.js'
import { priceTableRoutes }  from './modules/price-tables/price-tables.routes.js'
import { requestRoutes }     from './modules/requests/requests.routes.js'
import { quoteRoutes }       from './modules/quotes/quotes.routes.js'
import { dashboardRoutes }   from './modules/dashboard/dashboard.routes.js'
import { AppError }          from './shared/errors/index.js'
import prisma                from './infrastructure/database/prisma.js'
import { env }               from './config/env.js'
import type { UserRole } from './shared/types/index.js'

const app = Fastify({
  logger: {
    level: env.LOG_LEVEL,
  },
})

// ── Plugins ───────────────────────────────────────────────

await app.register(fastifyHelmet, {
  contentSecurityPolicy: false, // configurar no Nginx/proxy
})

await app.register(fastifyCors, {
  origin:      env.CORS_ORIGIN,
  credentials: true,
  methods:     ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
})

await app.register(fastifyRateLimit, {
  max:        env.RATE_LIMIT_MAX,
  timeWindow: '1 minute',
  allowList: (_req) => env.NODE_ENV !== 'production',
  errorResponseBuilder: () => ({
    error: { code: 'RATE_LIMIT', message: 'Muitas requisições. Tente novamente em breve.' },
  }),
})

await app.register(fastifyJwt, {
  secret: env.JWT_SECRET,
  sign:   { algorithm: 'HS256' },
})

// ── Decorator: authenticate ───────────────────────────────
app.decorate('authenticate', async (req, reply) => {
  try {
    await req.jwtVerify()
  } catch (_error) {
    return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Token inválido ou expirado.' } })
  }
})

// ── Decorator: requireRole ────────────────────────────────
app.decorate('requireRole', (...roles: UserRole[]) => {
  return async (req, reply) => {
    const user = req.user
    if (!user) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Não autenticado.' } })
    }
    // SUPER_ADMIN possui acesso irrestrito em todo o sistema.
    if (user.role === 'SUPER_ADMIN') {
      return
    }
    if (!roles.includes(user.role)) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Acesso negado para este perfil.' } })
    }
  }
})

// ── Error handler global ──────────────────────────────────
app.setErrorHandler((error, req, reply) => {
  app.log.error(error)

  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: {
        code:    error.code,
        message: error.message,
        details: error.details,
      },
    })
  }

  // Erros Zod que escaparam dos handlers
  if (isObjectError(error) && error.name === 'ZodError') {
    return reply.status(422).send({
      error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: (error as { errors?: unknown }).errors },
    })
  }

  // Erros Prisma
  if (isObjectError(error) && typeof error.message === 'string' && error.message.includes('Unique constraint')) {
    return reply.status(409).send({
      error: { code: 'CONFLICT', message: 'Registro duplicado.' },
    })
  }

  // Erros do Fastify (inclui rate limit) devem preservar status HTTP.
  if (isObjectError(error) && typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 600) {
    return reply.status(error.statusCode).send({
      error: {
        code: typeof error.code === 'string' ? error.code : 'HTTP_ERROR',
        message: typeof error.message === 'string' ? error.message : 'Erro na requisição.',
      },
    })
  }

  return reply.status(500).send({
    error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' },
  })
})

// ── Rotas ─────────────────────────────────────────────────
await app.register(authRoutes)
await app.register(passwordResetRoutes)
await app.register(userRoutes,        { prefix: '/api/v1' })
await app.register(clientRoutes,      { prefix: '/api/v1' })
await app.register(serviceTypeRoutes, { prefix: '/api/v1' })
await app.register(priceTableRoutes,  { prefix: '/api/v1' })
await app.register(requestRoutes,     { prefix: '/api/v1' })
await app.register(quoteRoutes,       { prefix: '/api/v1' })
await app.register(dashboardRoutes,   { prefix: '/api/v1' })

// ── Health check ──────────────────────────────────────────
app.get('/health', async () => {
  let dbStatus = 'ok'
  let redisStatus = 'not_configured'

  try {
    await prisma.$queryRaw`SELECT 1`
  } catch (_error) {
    dbStatus = 'error'
  }

  if (env.REDIS_URL) {
    try {
      await pingRedis(env.REDIS_URL)
      redisStatus = 'ok'
    } catch (_error) {
      redisStatus = 'error'
    }
  }

  const healthy = dbStatus === 'ok' && (redisStatus === 'ok' || redisStatus === 'not_configured')

  return {
    status:  healthy ? 'healthy' : 'degraded',
    version: process.env.npm_package_version ?? '1.0.0',
    checks:  { database: dbStatus, redis: redisStatus },
    uptime:  process.uptime(),
  }
})

// ── Shutdown graceful ─────────────────────────────────────
const shutdown = async () => {
  app.log.info('Encerrando servidor...')
  await app.close()
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGINT',  shutdown)
process.on('SIGTERM', shutdown)

// ── Start ─────────────────────────────────────────────────
const PORT = env.PORT
const HOST = env.HOST

try {
  await app.listen({ port: PORT, host: HOST })
  app.log.info(`🚀 Servidor rodando em http://${HOST}:${PORT}`)
} catch (err) {
  if (isObjectError(err) && 'code' in err && err.code === 'EADDRINUSE') {
    app.log.error(`Porta ${PORT} já está em uso. Defina uma porta diferente com PORT=<porta>.`)
  } else {
    app.log.error(err)
  }
  process.exit(1)
}

export type App = typeof app

function isObjectError(value: unknown): value is { name?: string; message?: string; code?: string } {
  return typeof value === 'object' && value !== null
}

async function pingRedis(redisUrl: string): Promise<void> {
  const parsed = new URL(redisUrl)
  const port = parsed.port ? Number(parsed.port) : 6379
  const host = parsed.hostname

  await new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({ host, port })
    socket.setTimeout(1000)
    socket.on('connect', () => {
      socket.end()
      resolve()
    })
    socket.on('timeout', () => {
      socket.destroy()
      reject(new Error('Redis timeout'))
    })
    socket.on('error', reject)
  })
}
