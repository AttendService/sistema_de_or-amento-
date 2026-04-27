// ============================================================
// Utilitários compartilhados
// ============================================================
import type { PaginationQuery, PaginatedResult } from '../types/index.js'
import prisma from '../../infrastructure/database/prisma.js'
import type { AuditAction } from '../types/index.js'
import type { Prisma } from '@prisma/client'

// ── Paginação ─────────────────────────────────────────────
export function parsePagination(query: PaginationQuery) {
  const page  = Math.max(1, Number(query.page)  || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20))
  const skip  = (page - 1) * limit
  return { page, limit, skip }
}

export function buildPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  }
}

// ── Auditoria ─────────────────────────────────────────────
export async function logAudit(params: {
  userId?: string
  action: AuditAction
  entityType: string
  entityId: string
  oldValues?: unknown
  newValues?: unknown
  ipAddress?: string
  userAgent?: string
}) {
  await prisma.auditLog.create({
    data: {
      userId:     params.userId,
      action:     params.action,
      entityType: params.entityType,
      entityId:   params.entityId,
      oldValues:  toJsonValue(params.oldValues),
      newValues:  toJsonValue(params.newValues),
      ipAddress:  params.ipAddress,
      userAgent:  params.userAgent,
    },
  })
}

// ── Formatação de erros Zod ───────────────────────────────
export function formatZodError(issues: { path: (string|number)[]; message: string }[]) {
  return issues.reduce<Record<string, string>>((acc, issue) => {
    acc[issue.path.join('.')] = issue.message
    return acc
  }, {})
}

// ── Número da solicitação ─────────────────────────────────
// Gerado pelo trigger do banco; este helper é usado apenas em testes/seeds
export function buildRequestNumber(seq: number): string {
  const year = new Date().getFullYear()
  return `ORC-${year}-${String(seq).padStart(6, '0')}`
}

// ── Serialização de Decimal ───────────────────────────────
// Prisma retorna Decimal objects; converte para number no response
export function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0
  return parseFloat(String(value))
}

function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}
