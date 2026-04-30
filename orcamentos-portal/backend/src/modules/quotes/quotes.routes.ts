// ============================================================
// Módulo Orçamentos — Montagem, itens, envio, decisão
// ============================================================
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import prisma from '../../infrastructure/database/prisma.js'
import {
  NotFoundError, ForbiddenError, InvalidTransitionError, ValidationError,
} from '../../shared/errors/index.js'
import { logAudit, toNumber } from '../../shared/utils/index.js'
import { assertClientAccess } from '../../shared/middleware/auth.js'
import {
  QUOTE_TRANSITIONS, STATUS_REQUIRES_REASON,
  type QuoteStatus, type JwtPayload,
} from '../../shared/types/index.js'

const IdSchema = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  'ID inválido.',
)

// ── Schemas ───────────────────────────────────────────────
const ParamsSchema        = z.object({ requestId: IdSchema })
const QuoteParamsSchema   = z.object({ requestId: IdSchema, quoteId: IdSchema })
const ItemParamsSchema    = z.object({ requestId: IdSchema, quoteId: IdSchema, itemId: IdSchema })

const CreateQuoteSchema = z.object({
  technicalNotes:  z.string().optional().nullable(),
  commercialNotes: z.string().optional().nullable(),
})

const AddItemSchema = z.object({
  priceItemId:   IdSchema.optional().nullable(),   // se origem TABLE
  serviceTypeId: IdSchema.optional().nullable(),
  origin:        z.enum(['TABLE', 'MANUAL']).default('TABLE'),
  code:          z.string().max(50).optional().nullable(),
  description:   z.string().min(1).max(500),
  unit:          z.string().min(1).max(30),
  quantity:      z.number().positive(),
  unitValue:     z.number().positive(),
  sortOrder:     z.number().int().optional().default(0),
})

const UpdateItemSchema = AddItemSchema.partial().extend({
  quantity:  z.number().positive().optional(),
  unitValue: z.number().positive().optional(),
})

const UpdateQuoteSchema = z.object({
  technicalNotes:  z.string().optional().nullable(),
  commercialNotes: z.string().optional().nullable(),
  discount:        z.number().min(0).optional(),
  estimatedDate:   z.string().date().optional().nullable(),
})

const QuoteDecisionSchema = z.object({
  status:         z.enum(['APPROVED', 'REJECTED', 'ON_HOLD', 'CANCELLED']),
  decisionReason: z.string().optional().nullable(),
})

// ── Routes ────────────────────────────────────────────────
export async function quoteRoutes(app: FastifyInstance) {
  const analystAdmin = [app.authenticate, app.requireRole('ANALYST', 'ADMIN')]

  // ─── GET /requests/:requestId/quotes ─────────────────────
  app.get('/requests/:requestId/quotes', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { requestId } = ParamsSchema.parse(req.params)
    const requester     = req.user as JwtPayload

    const request = await prisma.request.findFirst({ where: { id: requestId, deletedAt: null } })
    if (!request) throw new NotFoundError('Solicitação', requestId)

    if (requester.role === 'CLIENT') {
      assertClientAccess(
        { id: requester.sub, role: requester.role, email: requester.email, clientIds: requester.clientIds, defaultClientId: requester.defaultClientId },
        request.clientId,
      )
    }

    const quotes = await prisma.quote.findMany({
      where:   { requestId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        createdByUser: { select: { id: true, name: true } },
        items:         { include: { serviceType: { select: { id: true, name: true } } }, orderBy: { sortOrder: 'asc' } },
        _count:        { select: { items: true } },
      },
    })

    // Serializar Decimal
    return reply.send(quotes.map(serializeQuote))
  })

  // ─── GET /requests/:requestId/quotes/:quoteId ────────────
  app.get('/requests/:requestId/quotes/:quoteId', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { requestId, quoteId } = QuoteParamsSchema.parse(req.params)
    const requester              = req.user as JwtPayload

    const { request, quote } = await loadQuoteWithRequest(requestId, quoteId)

    if (requester.role === 'CLIENT') {
      assertClientAccess(
        { id: requester.sub, role: requester.role, email: requester.email, clientIds: requester.clientIds, defaultClientId: requester.defaultClientId },
        request.clientId,
      )
    }

    return reply.send(serializeQuote(quote))
  })

  // ─── POST /requests/:requestId/quotes ───── analista cria orçamento
  app.post('/requests/:requestId/quotes', { preHandler: analystAdmin }, async (req, reply) => {
    const { requestId } = ParamsSchema.parse(req.params)
    const requester     = req.user as JwtPayload

    const request = await prisma.request.findFirst({ where: { id: requestId, deletedAt: null } })
    if (!request) throw new NotFoundError('Solicitação', requestId)

    if (!['IN_ANALYSIS', 'QUOTE_IN_PROGRESS'].includes(request.status)) {
      throw new ValidationError(`Não é possível criar orçamento no status '${request.status}'.`)
    }

    const result = CreateQuoteSchema.safeParse(req.body)
    if (!result.success) {
      return reply.status(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: result.error.flatten().fieldErrors },
      })
    }

    const quote = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.quote.create({
        data: {
          requestId,
          createdBy:       requester.sub,
          technicalNotes:  result.data.technicalNotes  ?? null,
          commercialNotes: result.data.commercialNotes ?? null,
        },
      })

      const manualItems = await tx.requestManualItem.findMany({
        where: { requestId },
        orderBy: { sortOrder: 'asc' },
      })
      const manualQuoteItems = manualItems.length > 0
        ? manualItems
            .map((item) => ({
              description: item.description.trim(),
              quantity: item.quantity ? Number(item.quantity) : 0,
            }))
            .filter((item) => item.description.length > 0)
        : [typeof (request as any).serviceProduct === 'string' ? (request as any).serviceProduct.trim() : '']
            .filter((item) => item.length > 0)
            .map((description) => ({ description, quantity: 0 }))

      if (manualQuoteItems.length > 0) {
        await tx.quoteItem.createMany({
          data: manualQuoteItems.map((item, index) => ({
            quoteId: created.id,
            origin: 'MANUAL',
            description: item.description,
            unit: 'un',
            quantity: item.quantity,
            unitValue: 0,
            totalValue: 0,
            sortOrder: index,
          })),
        })
        await recalculateQuoteTotals(tx, created.id)
      }

      // Atualiza status da solicitação para "Orçamento em elaboração"
      if (request.status === 'IN_ANALYSIS') {
        await tx.request.update({
          where: { id: requestId },
          data:  { status: 'QUOTE_IN_PROGRESS' },
        })
        await tx.requestHistory.create({
          data: {
            requestId,
            performedBy: requester.sub,
            action:      'Orçamento iniciado',
            fromStatus:  'IN_ANALYSIS',
            toStatus:    'QUOTE_IN_PROGRESS',
          },
        })
      }

      await tx.quoteHistory.create({
        data: {
          quoteId:     created.id,
          performedBy: requester.sub,
          action:      'CREATE',
          toStatus:    'DRAFT',
        },
      })

      return created
    })

    await logAudit({
      userId: requester.sub, action: 'CREATE',
      entityType: 'quote', entityId: quote.id,
      newValues: { requestId, status: 'DRAFT' }, ipAddress: req.ip,
    })

    return reply.status(201).send({ id: quote.id, status: quote.status })
  })

  // ─── PATCH /requests/:requestId/quotes/:quoteId ──── atualizar cabeçalho
  app.patch('/requests/:requestId/quotes/:quoteId', { preHandler: analystAdmin }, async (req, reply) => {
    const { requestId, quoteId } = QuoteParamsSchema.parse(req.params)
    const { quote }              = await loadQuoteWithRequest(requestId, quoteId)

    if (quote.status !== 'DRAFT') {
      throw new ValidationError('Apenas orçamentos em rascunho podem ser editados.')
    }

    const result = UpdateQuoteSchema.safeParse(req.body)
    if (!result.success) {
      return reply.status(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: result.error.flatten().fieldErrors },
      })
    }

    const requester = req.user as JwtPayload
    const { estimatedDate, discount, ...rest } = result.data

    const updated = await prisma.quote.update({
      where: { id: quoteId },
      data:  {
        ...rest,
        ...(discount !== undefined && { discount }),
      },
    })

    // Atualizar estimatedDate na solicitação
    if (estimatedDate !== undefined) {
      await prisma.request.update({
        where: { id: requestId },
        data:  { estimatedDate: estimatedDate ? new Date(estimatedDate) : null },
      })
    }

    await logAudit({
      userId: requester.sub, action: 'UPDATE',
      entityType: 'quote', entityId: quoteId,
      newValues: result.data, ipAddress: req.ip,
    })

    return reply.send(serializeQuote(updated))
  })

  // ─── POST /requests/:requestId/quotes/:quoteId/items ─────
  app.post('/requests/:requestId/quotes/:quoteId/items', { preHandler: analystAdmin }, async (req, reply) => {
    const { requestId, quoteId } = QuoteParamsSchema.parse(req.params)
    const { quote }              = await loadQuoteWithRequest(requestId, quoteId)

    if (quote.status !== 'DRAFT') {
      throw new ValidationError('Apenas orçamentos em rascunho podem ser editados.')
    }

    const result = AddItemSchema.safeParse(req.body)
    if (!result.success) {
      return reply.status(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: result.error.flatten().fieldErrors },
      })
    }
    const data      = result.data
    const requester = req.user as JwtPayload

    // Se origem TABLE: buscar item original para registrar valor original
    let originalUnitValue: number | null = null
    if (data.origin === 'TABLE' && data.priceItemId) {
      const priceItem = await prisma.priceItem.findUnique({ where: { id: data.priceItemId } })
      if (!priceItem) throw new NotFoundError('Item da tabela', data.priceItemId)
      originalUnitValue = toNumber(priceItem.unitValue)
    }

    const totalValue        = data.quantity * data.unitValue
    const wasManuallyEdited = originalUnitValue !== null && data.unitValue !== originalUnitValue

    const item = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.quoteItem.create({
        data: {
          quoteId,
          serviceTypeId:       data.serviceTypeId   ?? null,
          origin:              data.origin,
          priceItemId:         data.priceItemId      ?? null,
          code:                data.code             ?? null,
          description:         data.description,
          unit:                data.unit,
          quantity:            data.quantity,
          unitValue:           data.unitValue,
          totalValue,
          originalUnitValue:   originalUnitValue ?? undefined,
          wasManuallyEdited,
          sortOrder:           data.sortOrder ?? 0,
        },
      })

      await recalculateQuoteTotals(tx, quoteId)
      return created
    })

    if (wasManuallyEdited) {
      await logAudit({
        userId: requester.sub, action: 'VALUE_EDIT',
        entityType: 'quote_item', entityId: item.id,
        oldValues: { unitValue: originalUnitValue },
        newValues: { unitValue: data.unitValue, reason: 'edited_on_add' },
        ipAddress: req.ip,
      })
    }

    return reply.status(201).send(item)
  })

  // ─── PATCH /requests/:requestId/quotes/:quoteId/items/:itemId
  app.patch('/requests/:requestId/quotes/:quoteId/items/:itemId', { preHandler: analystAdmin }, async (req, reply) => {
    const { requestId, quoteId, itemId } = ItemParamsSchema.parse(req.params)
    const { quote }                      = await loadQuoteWithRequest(requestId, quoteId)

    if (quote.status !== 'DRAFT') {
      throw new ValidationError('Apenas orçamentos em rascunho podem ser editados.')
    }

    const existing = await prisma.quoteItem.findFirst({ where: { id: itemId, quoteId } })
    // Torna a exclusão idempotente para evitar erro em cliques repetidos/concorrência.
    if (!existing) return reply.status(204).send()

    const result = UpdateItemSchema.safeParse(req.body)
    if (!result.success) {
      return reply.status(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: result.error.flatten().fieldErrors },
      })
    }
    const data      = result.data
    const requester = req.user as JwtPayload

    const newUnitValue = data.unitValue ?? toNumber(existing.unitValue)
    const newQty       = data.quantity  ?? toNumber(existing.quantity)
    const newTotal     = newUnitValue * newQty

    // Detectar edição manual de valor
    const originalValue   = toNumber(existing.originalUnitValue ?? existing.unitValue)
    const wasManuallyEdited = data.unitValue !== undefined && data.unitValue !== originalValue

    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const upd = await tx.quoteItem.update({
        where: { id: itemId },
        data:  {
          ...data,
          totalValue:       newTotal,
          wasManuallyEdited: wasManuallyEdited || existing.wasManuallyEdited,
        },
      })
      await recalculateQuoteTotals(tx, quoteId)
      return upd
    })

    if (wasManuallyEdited) {
      await logAudit({
        userId: requester.sub, action: 'VALUE_EDIT',
        entityType: 'quote_item', entityId: itemId,
        oldValues: { unitValue: toNumber(existing.unitValue) },
        newValues: { unitValue: data.unitValue },
        ipAddress: req.ip,
      })
    }

    return reply.send(updated)
  })

  // ─── DELETE /requests/:requestId/quotes/:quoteId/items/:itemId
  app.delete('/requests/:requestId/quotes/:quoteId/items/:itemId', { preHandler: analystAdmin }, async (req, reply) => {
    const { requestId, quoteId, itemId } = ItemParamsSchema.parse(req.params)
    const { quote }                      = await loadQuoteWithRequest(requestId, quoteId)

    if (quote.status !== 'DRAFT') {
      throw new ValidationError('Apenas orçamentos em rascunho podem ser editados.')
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const deleted = await tx.quoteItem.deleteMany({ where: { id: itemId, quoteId } })
      if (deleted.count === 0) return
      await recalculateQuoteTotals(tx, quoteId)
    })

    return reply.status(204).send()
  })

  // ─── POST /requests/:requestId/quotes/:quoteId/send ──────
  app.post('/requests/:requestId/quotes/:quoteId/send', { preHandler: analystAdmin }, async (req, reply) => {
    const { requestId, quoteId } = QuoteParamsSchema.parse(req.params)
    const { request, quote }     = await loadQuoteWithRequest(requestId, quoteId)
    const requester              = req.user as JwtPayload

    if (quote.status !== 'DRAFT') {
      throw new ValidationError('Apenas orçamentos em rascunho podem ser enviados.')
    }

    const itemCount = await prisma.quoteItem.count({ where: { quoteId } })
    if (itemCount === 0) {
      throw new ValidationError('O orçamento precisa ter pelo menos um item antes de ser enviado.')
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.quote.update({
        where: { id: quoteId },
        data:  { status: 'SENT', sentAt: new Date() },
      })

      await tx.request.update({
        where: { id: requestId },
        data:  { status: 'QUOTE_SENT' },
      })

      await tx.requestHistory.create({
        data: {
          requestId,
          performedBy: requester.sub,
          action:      'Orçamento enviado ao cliente',
          fromStatus:  'QUOTE_IN_PROGRESS',
          toStatus:    'QUOTE_SENT',
        },
      })

      await tx.quoteHistory.create({
        data: {
          quoteId,
          performedBy: requester.sub,
          action:      'SEND',
          fromStatus:  'DRAFT',
          toStatus:    'SENT',
        },
      })
    })

    await logAudit({
      userId: requester.sub, action: 'SEND',
      entityType: 'quote', entityId: quoteId,
      newValues: { status: 'SENT', requestId }, ipAddress: req.ip,
    })

    return reply.send({ id: quoteId, status: 'SENT', message: 'Orçamento enviado ao cliente.' })
  })

  // ─── POST /requests/:requestId/quotes/:quoteId/decision — cliente decide
  app.post('/requests/:requestId/quotes/:quoteId/decision', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { requestId, quoteId } = QuoteParamsSchema.parse(req.params)
    const requester              = req.user as JwtPayload
    const { request, quote }     = await loadQuoteWithRequest(requestId, quoteId)

    // Isolamento: cliente só decide sobre seus registros
    if (requester.role === 'CLIENT') {
      assertClientAccess(
        { id: requester.sub, role: requester.role, email: requester.email, clientIds: requester.clientIds, defaultClientId: requester.defaultClientId },
        request.clientId,
      )
    }

    if (quote.status !== 'SENT' && quote.status !== 'ON_HOLD') {
      throw new ValidationError(`Orçamento no status '${quote.status}' não pode receber decisão.`)
    }

    const result = QuoteDecisionSchema.safeParse(req.body)
    if (!result.success) {
      return reply.status(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: result.error.flatten().fieldErrors },
      })
    }
    const { status: newStatus, decisionReason } = result.data

    // Validar transição
    const currentStatus = quote.status as QuoteStatus
    if (!QUOTE_TRANSITIONS[currentStatus].includes(newStatus)) {
      throw new InvalidTransitionError(currentStatus, newStatus)
    }

    // Motivo obrigatório
    if (['REJECTED', 'ON_HOLD', 'CANCELLED'].includes(newStatus) && !decisionReason?.trim()) {
      throw new ValidationError(`Motivo obrigatório para decisão '${newStatus}'.`)
    }

    // Mapear status do orçamento para status da solicitação
    const requestStatusMap: Record<string, string> = {
      APPROVED:  'APPROVED',
      REJECTED:  'REJECTED',
      ON_HOLD:   'ON_HOLD',
      CANCELLED: 'CANCELLED',
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.quote.update({
        where: { id: quoteId },
        data:  { status: newStatus, decisionReason: decisionReason ?? null, decidedAt: new Date() },
      })

      await tx.request.update({
        where: { id: requestId },
        data:  { status: requestStatusMap[newStatus] as any },
      })

      await tx.requestHistory.create({
        data: {
          requestId,
          performedBy: requester.sub,
          action:      `Cliente: ${newStatus}`,
          fromStatus:  request.status as any,
          toStatus:    requestStatusMap[newStatus] as any,
          observations: decisionReason ?? null,
        },
      })

      await tx.quoteHistory.create({
        data: {
          quoteId,
          performedBy:  requester.sub,
          action:       newStatus === 'APPROVED' ? 'APPROVE' : newStatus === 'REJECTED' ? 'REJECT' : 'CANCEL',
          fromStatus:   currentStatus,
          toStatus:     newStatus,
          observations: decisionReason ?? null,
        },
      })
    })

    await logAudit({
      userId: requester.sub, action: newStatus === 'APPROVED' ? 'APPROVE' : newStatus === 'REJECTED' ? 'REJECT' : 'CANCEL',
      entityType: 'quote', entityId: quoteId,
      oldValues: { status: currentStatus }, newValues: { status: newStatus, decisionReason },
      ipAddress: req.ip,
    })

    return reply.send({ id: quoteId, status: newStatus, message: `Orçamento ${newStatus.toLowerCase()}.` })
  })

  // ─── GET /requests/:requestId/quotes/:quoteId/history ────
  app.get('/requests/:requestId/quotes/:quoteId/history', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { requestId, quoteId } = QuoteParamsSchema.parse(req.params)
    const requester              = req.user as JwtPayload
    const { request }            = await loadQuoteWithRequest(requestId, quoteId)

    if (requester.role === 'CLIENT') {
      assertClientAccess(
        { id: requester.sub, role: requester.role, email: requester.email, clientIds: requester.clientIds, defaultClientId: requester.defaultClientId },
        request.clientId,
      )
    }

    const history = await prisma.quoteHistory.findMany({
      where:   { quoteId },
      orderBy: { performedAt: 'desc' },
      include: { performedByUser: { select: { id: true, name: true, role: true } } },
    })

    return reply.send(history)
  })
}

// ── Helpers ───────────────────────────────────────────────

async function loadQuoteWithRequest(requestId: string, quoteId: string) {
  const request = await prisma.request.findFirst({ where: { id: requestId, deletedAt: null } })
  if (!request) throw new NotFoundError('Solicitação', requestId)

  const quote = await prisma.quote.findFirst({
    where:   { id: quoteId, requestId, deletedAt: null },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!quote) throw new NotFoundError('Orçamento', quoteId)

  return { request, quote }
}

type QuoteRecalcTx = Prisma.TransactionClient

async function recalculateQuoteTotals(tx: QuoteRecalcTx, quoteId: string) {
  const items = await tx.quoteItem.findMany({ where: { quoteId }, select: { totalValue: true } })
  const subtotal = items.reduce((acc: number, item: { totalValue: unknown }) => acc + toNumber(item.totalValue), 0)

  const quote   = await tx.quote.findUnique({ where: { id: quoteId }, select: { discount: true } })
  const discount = toNumber(quote?.discount ?? 0)

  await tx.quote.update({
    where: { id: quoteId },
    data:  {
      subtotal,
      totalValue: Math.max(0, subtotal - discount),
    },
  })
}

function serializeQuote(quote: any) {
  return {
    ...quote,
    subtotal:   toNumber(quote.subtotal),
    discount:   toNumber(quote.discount),
    totalValue: toNumber(quote.totalValue),
    items: (quote.items ?? []).map((item: any) => ({
      ...item,
      quantity:           toNumber(item.quantity),
      unitValue:          toNumber(item.unitValue),
      totalValue:         toNumber(item.totalValue),
      originalUnitValue:  item.originalUnitValue ? toNumber(item.originalUnitValue) : null,
    })),
  }
}
