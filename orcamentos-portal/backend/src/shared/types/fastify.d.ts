import '@fastify/jwt'
import type { preHandlerHookHandler } from 'fastify'
import type { JwtPayload, UserRole } from './index.js'

type RefreshPayload = { sub: string; type: 'refresh'; iat?: number; exp?: number }

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload | RefreshPayload
    user: JwtPayload
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: preHandlerHookHandler
    requireRole: (...roles: UserRole[]) => preHandlerHookHandler
  }

  interface FastifyRequest {
    user: JwtPayload
  }
}
