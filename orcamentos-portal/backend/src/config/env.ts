import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória.'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET deve ter pelo menos 32 caracteres.'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.string().default('info'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(200),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  REDIS_URL: z.string().optional(),
}).superRefine((env, ctx) => {
  const insecureMarkers = ['change_me', 'gere_um', 'sua_senha_aqui', 'example.com']
  const hasInsecureMarker = (value: string) => insecureMarkers.some((marker) => value.toLowerCase().includes(marker))

  if (hasInsecureMarker(env.DATABASE_URL)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['DATABASE_URL'],
      message: 'DATABASE_URL parece placeholder inseguro. Configure um valor real.',
    })
  }

  if (hasInsecureMarker(env.JWT_SECRET)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['JWT_SECRET'],
      message: 'JWT_SECRET parece placeholder inseguro. Configure um segredo real.',
    })
  }

  if (env.NODE_ENV === 'production' && !env.REDIS_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['REDIS_URL'],
      message: 'REDIS_URL é obrigatória em produção.',
    })
  }
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join(' | ')
  throw new Error(`Falha na validação de variáveis de ambiente: ${details}`)
}

export const env = parsed.data
