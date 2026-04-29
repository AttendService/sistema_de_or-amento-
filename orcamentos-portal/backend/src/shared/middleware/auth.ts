// ============================================================
// Middleware de Auth — JWT + RBAC + Isolamento de cliente
// ============================================================
import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify'
import { UnauthorizedError, ForbiddenError } from '../errors/index.js'
import type { UserRole, AuthUser, JwtPayload } from '../types/index.js'

// Verifica JWT e injeta user no request
export function authenticate(
  req: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction,
) {
  req.jwtVerify<JwtPayload>()
    .then(() => {
      const payload = req.user as JwtPayload
      if (!payload?.sub) {
        throw new UnauthorizedError()
      }
      done()
    })
    .catch(() => {
      reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Token inválido ou expirado.' },
      })
    })
}

// Factory: exige pelo menos um dos roles informados
export function requireRole(...roles: UserRole[]) {
  return (
    req: FastifyRequest,
    reply: FastifyReply,
    done: HookHandlerDoneFunction,
  ) => {
    const user = req.user as AuthUser
    if (!user) {
      reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Não autenticado.' },
      })
      return
    }
    if (user.role !== 'SUPER_ADMIN' && !roles.includes(user.role)) {
      reply.status(403).send({
        error: { code: 'FORBIDDEN', message: 'Acesso negado para este perfil.' },
      })
      return
    }
    done()
  }
}

// Valida que o clientId do parâmetro pertence ao usuário autenticado
// Admins e Analysts têm acesso irrestrito
export function assertClientAccess(user: AuthUser, clientId: string): void {
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.role === 'ANALYST') return
  if (!user.clientIds.includes(clientId)) {
    throw new ForbiddenError('Acesso negado a este cliente.')
  }
}

// Valida que o userId do parâmetro é o próprio usuário (ou admin)
export function assertSelfOrAdmin(user: AuthUser, targetUserId: string): void {
  const userId = user.id ?? user.sub
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return
  if (userId !== targetUserId) {
    throw new ForbiddenError('Acesso negado.')
  }
}
