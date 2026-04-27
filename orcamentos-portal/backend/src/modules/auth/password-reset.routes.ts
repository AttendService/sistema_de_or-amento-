// ============================================================
// Módulo Password Reset — forgot + reset
// Implementação simplificada: token gerado e logado (sem SMTP)
// Para produção: integrar com serviço de e-mail (SES, SendGrid, etc.)
// ============================================================
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import prisma from '../../infrastructure/database/prisma.js'
import { AppError } from '../../shared/errors/index.js'
import { logAudit } from '../../shared/utils/index.js'

// Armazenamento em memória dos tokens (em produção: Redis com TTL)
// Map<token, { userId, expiresAt }>
const resetTokens = new Map<string, { userId: string; expiresAt: Date }>()

// Limpeza periódica de tokens expirados
setInterval(() => {
  const now = new Date()
  for (const [token, data] of resetTokens.entries()) {
    if (data.expiresAt < now) resetTokens.delete(token)
  }
}, 5 * 60 * 1000) // a cada 5 min

export async function passwordResetRoutes(app: FastifyInstance) {

  // POST /auth/forgot-password
  // Gera token de reset. Em produção enviaria e-mail; aqui retorna o token (DEV ONLY)
  app.post('/auth/forgot-password', async (req, reply) => {
    const { email } = z.object({ email: z.string().email() }).parse(req.body)

    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim(), deletedAt: null, status: 'ACTIVE' },
    })

    // Resposta sempre igual para não vazar se e-mail existe
    if (!user) {
      return reply.send({
        message: 'Se o e-mail estiver cadastrado, você receberá as instruções de recuperação.',
      })
    }

    // Gerar token único com validade de 1h
    const token     = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
    resetTokens.set(token, { userId: user.id, expiresAt })

    await logAudit({
      userId:     user.id,
      action:     'UPDATE',
      entityType: 'auth',
      entityId:   user.id,
      newValues:  { event: 'password_reset_requested' },
      ipAddress:  req.ip,
    })

    // Em desenvolvimento: retorna o token diretamente
    // Em produção: enviar e-mail e retornar apenas a mensagem genérica
    const isDev = process.env.NODE_ENV !== 'production'

    app.log.info({ msg: 'Password reset token generated', userId: user.id, token })

    return reply.send({
      message: 'Se o e-mail estiver cadastrado, você receberá as instruções de recuperação.',
      ...(isDev && { devToken: token, devNote: 'Este campo só aparece em NODE_ENV != production' }),
    })
  })

  // POST /auth/reset-password
  app.post('/auth/reset-password', async (req, reply) => {
    const { token, password } = z.object({
      token:    z.string().min(1),
      password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
    }).parse(req.body)

    const data = resetTokens.get(token)
    if (!data || data.expiresAt < new Date()) {
      throw new AppError('INVALID_RESET_TOKEN', 'Token inválido ou expirado.', 400)
    }

    const passwordHash = await bcrypt.hash(password, 12)
    await prisma.user.update({
      where: { id: data.userId },
      data:  { passwordHash },
    })

    resetTokens.delete(token)

    await logAudit({
      userId:     data.userId,
      action:     'UPDATE',
      entityType: 'auth',
      entityId:   data.userId,
      newValues:  { event: 'password_reset_completed' },
      ipAddress:  req.ip,
    })

    return reply.send({ message: 'Senha alterada com sucesso. Faça login com a nova senha.' })
  })
}
