// ============================================================
// Módulo Dashboard — métricas cliente e interno
// ============================================================
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import prisma from '../../infrastructure/database/prisma.js'
import { toNumber } from '../../shared/utils/index.js'
import type { JwtPayload } from '../../shared/types/index.js'

type ServiceTypeGroup = { serviceTypeId: string | null; _count: { requestId: number } }
type StatusGroup = { status: string; _count: { id: number } }
type AssignedGroup = { assignedTo: string | null; _count: { id: number } }
type ClientGroup = { clientId: string; _count: { id: number } }
type MonthGroup = { month: string; count: bigint }

const DateRangeSchema = z.object({
  from:     z.string().date().optional(),
  to:       z.string().date().optional(),
  clientId: z.string().uuid().optional(),
})

// Constrói query byMonth sem interpolação condicional inválida
async function queryByMonth(params: {
  clientIds?: string[]
  from?: string
  to?: string
}): Promise<{ month: string; count: bigint }[]> {
  const { clientIds, from, to } = params

  if (clientIds) {
    // Dashboard do cliente — filtra por clientIds
    if (from && to) {
      return prisma.$queryRaw`
        SELECT TO_CHAR(created_at, 'YYYY-MM') AS month, COUNT(*) AS count
        FROM requests
        WHERE client_id = ANY(${clientIds}::uuid[])
          AND deleted_at IS NULL
          AND created_at >= ${new Date(from)}
          AND created_at <= ${new Date(to + 'T23:59:59Z')}
        GROUP BY month ORDER BY month DESC LIMIT 12`
    }
    if (from) {
      return prisma.$queryRaw`
        SELECT TO_CHAR(created_at, 'YYYY-MM') AS month, COUNT(*) AS count
        FROM requests
        WHERE client_id = ANY(${clientIds}::uuid[])
          AND deleted_at IS NULL
          AND created_at >= ${new Date(from)}
        GROUP BY month ORDER BY month DESC LIMIT 12`
    }
    return prisma.$queryRaw`
      SELECT TO_CHAR(created_at, 'YYYY-MM') AS month, COUNT(*) AS count
      FROM requests
      WHERE client_id = ANY(${clientIds}::uuid[])
        AND deleted_at IS NULL
      GROUP BY month ORDER BY month DESC LIMIT 12`
  }

  // Dashboard operacional — sem filtro de cliente
  if (from && to) {
    return prisma.$queryRaw`
      SELECT TO_CHAR(created_at, 'YYYY-MM') AS month, COUNT(*) AS count
      FROM requests
      WHERE deleted_at IS NULL
        AND created_at >= ${new Date(from)}
        AND created_at <= ${new Date(to + 'T23:59:59Z')}
      GROUP BY month ORDER BY month DESC LIMIT 12`
  }
  if (from) {
    return prisma.$queryRaw`
      SELECT TO_CHAR(created_at, 'YYYY-MM') AS month, COUNT(*) AS count
      FROM requests
      WHERE deleted_at IS NULL
        AND created_at >= ${new Date(from)}
      GROUP BY month ORDER BY month DESC LIMIT 12`
  }
  return prisma.$queryRaw`
    SELECT TO_CHAR(created_at, 'YYYY-MM') AS month, COUNT(*) AS count
    FROM requests
    WHERE deleted_at IS NULL
    GROUP BY month ORDER BY month DESC LIMIT 12`
}

export async function dashboardRoutes(app: FastifyInstance) {

  // GET /dashboard/client — dashboard do cliente (isolado)
  app.get('/dashboard/client', { preHandler: [app.authenticate] }, async (req, reply) => {
    const requester = req.user as JwtPayload
    const query     = DateRangeSchema.parse(req.query)

    // Cliente só vê seus dados; analista/admin podem filtrar por clientId
    let clientIds: string[]
    if (requester.role === 'CLIENT') {
      clientIds = requester.clientIds
    } else if (query.clientId) {
      clientIds = [query.clientId]
    } else {
      return reply.status(400).send({
        error: { code: 'CLIENT_REQUIRED', message: 'Informe clientId para acessar o dashboard de cliente.' },
      })
    }

    const dateFilter = buildDateFilter(query.from, query.to)
    const where = { clientId: { in: clientIds }, deletedAt: null, ...dateFilter }

    const [
      totalRequests,
      byStatus,
      urgentCount,
      byServiceType,
      byMonth,
    ] = await Promise.all([
      prisma.request.count({ where }),
      prisma.request.groupBy({ by: ['status'], where, _count: { id: true } }),
      prisma.request.count({ where: { ...where, isUrgent: true } }),
      prisma.requestServiceType.groupBy({
        by: ['serviceTypeId'],
        where: { request: { ...where } },
        _count: { requestId: true },
      }),
      queryByMonth({ clientIds, from: query.from, to: query.to }),
    ])

    // Resolver nomes dos tipos de serviço
    const serviceTypeIds = (byServiceType as ServiceTypeGroup[]).map((r: ServiceTypeGroup) => r.serviceTypeId).filter(Boolean) as string[]
    const serviceTypeNames = await prisma.serviceType.findMany({
      where: { id: { in: serviceTypeIds } },
      select: { id: true, name: true },
    })
    const stMap = Object.fromEntries(serviceTypeNames.map((st: { id: string; name: string }) => [st.id, st.name]))

    return reply.send({
      summary: {
        total:    totalRequests,
        urgent:   urgentCount,
        byStatus: Object.fromEntries((byStatus as StatusGroup[]).map((r: StatusGroup) => [r.status, r._count.id])),
      },
      byServiceType: (byServiceType as ServiceTypeGroup[]).map((r: ServiceTypeGroup) => ({
        serviceTypeId:   r.serviceTypeId,
        serviceTypeName: stMap[r.serviceTypeId!] ?? 'Desconhecido',
        count:           r._count.requestId,
      })),
      byMonth: (byMonth as MonthGroup[]).map((r: MonthGroup) => ({ month: r.month, count: Number(r.count) })),
    })
  })

  // GET /dashboard/operational — dashboard interno (analista/admin)
  app.get('/dashboard/operational', {
    preHandler: [app.authenticate, app.requireRole('ANALYST', 'ADMIN')],
  }, async (req, reply) => {
    const query = DateRangeSchema.parse(req.query)
    const dateFilter = buildDateFilter(query.from, query.to)

    const baseWhere = {
      deletedAt: null,
      ...dateFilter,
      ...(query.clientId && { clientId: query.clientId }),
    }

    const [
      totalRequests,
      byStatus,
      urgentCount,
      byAnalyst,
      byClient,
      byServiceType,
      quoteStats,
      byMonth,
    ] = await Promise.all([
      prisma.request.count({ where: baseWhere }),
      prisma.request.groupBy({ by: ['status'], where: baseWhere, _count: { id: true } }),
      prisma.request.count({ where: { ...baseWhere, isUrgent: true } }),
      prisma.request.groupBy({
        by: ['assignedTo'],
        where: { ...baseWhere, assignedTo: { not: null } },
        _count: { id: true },
      }),
      prisma.request.groupBy({
        by: ['clientId'],
        where: baseWhere,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      prisma.requestServiceType.groupBy({
        by: ['serviceTypeId'],
        where: { request: baseWhere },
        _count: { requestId: true },
      }),
      prisma.quote.aggregate({
        where: { deletedAt: null, request: baseWhere },
        _count: { id: true },
        _sum:   { totalValue: true },
      }),
      queryByMonth({ from: query.from, to: query.to }),
    ])

    // Resolver nomes
    const analystIds = (byAnalyst as AssignedGroup[]).map((r: AssignedGroup) => r.assignedTo).filter(Boolean) as string[]
    const clientIds2 = (byClient as ClientGroup[]).map((r: ClientGroup) => r.clientId)
    const stIds      = (byServiceType as ServiceTypeGroup[]).map((r: ServiceTypeGroup) => r.serviceTypeId).filter(Boolean) as string[]

    const [analystNames, clientNames, stNames, approvedQuotes] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: analystIds } }, select: { id: true, name: true } }),
      prisma.client.findMany({ where: { id: { in: clientIds2 } }, select: { id: true, name: true } }),
      prisma.serviceType.findMany({ where: { id: { in: stIds } }, select: { id: true, name: true } }),
      prisma.quote.aggregate({
        where: { status: 'APPROVED', deletedAt: null, request: baseWhere },
        _sum:   { totalValue: true },
        _count: { id: true },
      }),
    ])

    const analystMap = Object.fromEntries(analystNames.map((u: { id: string; name: string }) => [u.id, u.name]))
    const clientMap  = Object.fromEntries(clientNames.map((c: { id: string; name: string }) => [c.id, c.name]))
    const stMap      = Object.fromEntries(stNames.map((s: { id: string; name: string }) => [s.id, s.name]))

    return reply.send({
      summary: {
        total:    totalRequests,
        urgent:   urgentCount,
        byStatus: Object.fromEntries((byStatus as StatusGroup[]).map((r: StatusGroup) => [r.status, r._count.id])),
      },
      quotes: {
        total:         quoteStats._count.id,
        totalValue:    toNumber(quoteStats._sum.totalValue),
        approved:      approvedQuotes._count.id,
        approvedValue: toNumber(approvedQuotes._sum.totalValue),
      },
      byAnalyst: (byAnalyst as AssignedGroup[]).map((r: AssignedGroup) => ({
        analystId:   r.assignedTo,
        analystName: analystMap[r.assignedTo!] ?? 'Sem analista',
        count:       r._count.id,
      })),
      byClient: (byClient as ClientGroup[]).map((r: ClientGroup) => ({
        clientId:   r.clientId,
        clientName: clientMap[r.clientId] ?? 'Desconhecido',
        count:      r._count.id,
      })),
      byServiceType: (byServiceType as ServiceTypeGroup[]).map((r: ServiceTypeGroup) => ({
        serviceTypeId:   r.serviceTypeId,
        serviceTypeName: stMap[r.serviceTypeId!] ?? 'Desconhecido',
        count:           r._count.requestId,
      })),
      byMonth: (byMonth as MonthGroup[]).map((r: MonthGroup) => ({ month: r.month, count: Number(r.count) })),
    })
  })

  // GET /dashboard/queue-stats — contadores de fila em tempo real
  app.get('/dashboard/queue-stats', {
    preHandler: [app.authenticate, app.requireRole('ANALYST', 'ADMIN')],
  }, async (req, reply) => {
    const counts = await prisma.request.groupBy({
      by: ['status', 'isUrgent'],
      where: { deletedAt: null },
      _count: { id: true },
    })
    return reply.send({ counts })
  })
}

// ── Helper ────────────────────────────────────────────────
function buildDateFilter(from?: string, to?: string) {
  if (!from && !to) return {}
  return {
    createdAt: {
      ...(from && { gte: new Date(from) }),
      ...(to   && { lte: new Date(to + 'T23:59:59Z') }),
    },
  }
}
