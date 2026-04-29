// ============================================================
// Detalhe da Solicitação
// ============================================================
import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, MapPin, Calendar, User, Building2,
  Clock, CheckCircle2, XCircle, PauseCircle, Trash2,
  ClipboardList, FileText, UserCheck, Wrench, AlertTriangle, Printer, Plus
} from 'lucide-react'
import {
  useRequest, useRequestHistory, useQuotes, useAssignRequest, useCreateQuote, useQuoteDecision,
  useAddQuoteItem, useUpdateQuoteItem, useDeleteQuoteItem, usePriceTables, usePriceTable,
} from '../hooks/queries'
import { useRole } from '../store/auth.store'
import {
  RequestStatusBadge, UrgentBadge, Modal, Alert, Spinner, PageLoader, EmptyState,
} from '../components/ui'
import { formatCurrency, formatDate, formatDateTime } from '../lib/constants'
import { api, extractApiError } from '../lib/api'
import { useQueryClient } from '@tanstack/react-query'

export default function RequestDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const role     = useRole()
  const qc       = useQueryClient()

  const { data: request, isLoading } = useRequest(id!)
  const { data: history = [] }       = useRequestHistory(id!)
  // Carrega orçamentos separadamente para garantir id e dados completos
  const { data: quotesData = [] }    = useQuotes(id!)
  const assignRequest = useAssignRequest()
  const createQuote   = useCreateQuote()
  const quoteDecision  = useQuoteDecision()
  const addQuoteItem = useAddQuoteItem()
  const updateQuoteItem = useUpdateQuoteItem()
  const deleteQuoteItem = useDeleteQuoteItem()

  const [decisionModal, setDecisionModal] = useState<{ open: boolean; action: string } | null>(null)
  const [observations,  setObservations]  = useState('')
  const [apiError,      setApiError]      = useState('')
  const [inlineQuoteEdit, setInlineQuoteEdit] = useState(false)
  const [manualItem, setManualItem] = useState({
    priceItemId: '',
    quantity: 1,
  })

  const { data: priceTables = [] } = usePriceTables(request?.clientId ?? '', false)
  const activePriceTable = priceTables.find((t: any) => t.status === 'ACTIVE') ?? priceTables[0]
  const [inlineTableId, setInlineTableId] = useState('')
  const effectiveInlineTableId = inlineTableId || activePriceTable?.id || ''
  const { data: inlinePriceTable } = usePriceTable(
    request?.clientId ?? '',
    effectiveInlineTableId,
    { includeInactive: false },
  )
  const inlinePriceItems = inlinePriceTable?.items ?? []
  const selectedInlinePriceItem = inlinePriceItems.find((item: any) => item.id === manualItem.priceItemId)

  if (isLoading)  return <PageLoader />
  if (!request)   return <div className="p-8 text-surface-400">Solicitação não encontrada.</div>

  // Usa os dados do endpoint /quotes que traz o id completo
  const quotes     = quotesData.length > 0 ? quotesData : (request.quotes ?? [])
  const hasQuote   = quotes.length > 0
  const activeQuote = quotes.find((q: any) => q.status === 'SENT')
    ?? quotes.find((q: any) => q.status === 'DRAFT')
    ?? quotes[0]

  const canDecide  = role === 'CLIENT' && ['QUOTE_SENT', 'ON_HOLD'].includes(request.status)
  const canAnalyse = (role === 'ANALYST' || role === 'ADMIN' || role === 'SUPER_ADMIN')
    && ['IN_ANALYSIS', 'QUOTE_IN_PROGRESS', 'QUOTE_SENT'].includes(request.status)
  // Permite assumir em REQUESTED ou reatribuir em qualquer estado ativo
  const canAssign  = (role === 'ANALYST' || role === 'ADMIN' || role === 'SUPER_ADMIN')
    && ['REQUESTED', 'IN_ANALYSIS'].includes(request.status)
    && !request.assignedTo

  const handleDecision = async (action: string) => {
    if (!activeQuote?.id) {
      setApiError('Nenhum orçamento enviado foi encontrado para esta solicitação.')
      return
    }

    const needsReason = ['REJECTED', 'ON_HOLD', 'CANCELLED'].includes(action)
    if (needsReason && !observations.trim()) {
      setApiError('Observação obrigatória para esta ação.')
      return
    }
    try {
      await quoteDecision.mutateAsync({
        requestId: id!,
        quoteId: activeQuote.id,
        data: { status: action, decisionReason: observations },
      })
      setDecisionModal(null)
      setObservations('')
      setApiError('')
    } catch (err) {
      setApiError(extractApiError(err))
    }
  }

  const handleAssign = async () => {
    try {
      await assignRequest.mutateAsync({ id: id! })
    } catch (err) {
      setApiError(extractApiError(err))
    }
  }

  const handleStartQuote = async () => {
    try {
      await createQuote.mutateAsync({ requestId: id!, data: {} })
      setInlineQuoteEdit(true)
    } catch (err) {
      setApiError(extractApiError(err))
    }
  }

  const handleAddManualItemInline = async () => {
    if (!id || !activeQuote?.id) return
    if (!selectedInlinePriceItem) {
      setApiError('Selecione um item da tabela de preços.')
      return
    }
    if (manualItem.quantity <= 0) {
      setApiError('Quantidade deve ser maior que zero.')
      return
    }
    try {
      await addQuoteItem.mutateAsync({
        requestId: id,
        quoteId: activeQuote.id,
        data: {
          origin: 'TABLE',
          priceItemId: selectedInlinePriceItem.id,
          serviceTypeId: selectedInlinePriceItem.serviceTypeId ?? undefined,
          code: selectedInlinePriceItem.code || undefined,
          description: selectedInlinePriceItem.description,
          unit: selectedInlinePriceItem.unit,
          quantity: Number(manualItem.quantity),
          unitValue: Number(selectedInlinePriceItem.unitValue),
        },
      })
      setManualItem({ priceItemId: '', quantity: 1 })
    } catch (err) {
      setApiError(extractApiError(err))
    }
  }

  const showValue = (value: unknown) => {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      return trimmed.length > 0 ? trimmed : '—'
    }
    if (value === null || value === undefined) return '—'
    return String(value)
  }

  const textOrNull = (value: unknown) => {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  const street = textOrNull(request.street)
  const number = textOrNull(request.streetNumber)
  const complement = textOrNull(request.complement)
  const neighborhood = textOrNull(request.neighborhood)
  const city = textOrNull(request.city)
  const state = textOrNull(request.state)
  const zipCode = textOrNull(request.zipCode)

  const hasAnyAddress = Boolean(
    street || number || complement || neighborhood || city || state || zipCode || textOrNull(request.reference) || request.latitude || request.longitude,
  )

  const addressLine1Parts = [
    [street, number].filter(Boolean).join(', '),
    neighborhood,
    [city, state].filter(Boolean).join(' - '),
    zipCode,
    complement,
  ].filter((part) => part && part.length > 0)

  const addressLine2Parts = [
    neighborhood,
    [city, state].filter(Boolean).join(', '),
    zipCode ? `CEP ${zipCode}` : null,
  ].filter((part) => part && part.length > 0)

  const addressLine1 = addressLine1Parts.join(', ')
  const addressLine2 = addressLine2Parts.join(' — ')

  return (
    <div className="fade-in pb-12">
      <div className="page-header flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-200 px-6 py-4 -mx-6 -mt-6 mb-6">
        <div className="flex items-start md:items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost p-1.5 rounded hover:bg-surface-100 flex-shrink-0 mt-0.5 md:mt-0">
            <ChevronLeft size={18} className="text-surface-600" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-bold text-lg text-surface-900 leading-none">{request.requestNumber}</h1>
              {request.isUrgent && <UrgentBadge />}
              <RequestStatusBadge status={request.status} />
              
              {/* Resumo visual do Total sempre visível - Pedido via feedback UX */}
              {activeQuote && (
                <div className="flex items-center gap-1.5 ml-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200 font-bold text-sm shadow-sm">
                  Total: {formatCurrency(Number(activeQuote.totalValue ?? 0))}
                </div>
              )}
            </div>
            <p className="text-sm text-surface-500 mt-1">
              Criado em {formatDateTime(request.createdAt)}
            </p>
          </div>
        </div>

        {/* Ações rápidas movidas para o Header para economia de espaço */}
        <div className="flex flex-wrap items-center gap-2">
          {request.status === 'APPROVED' && activeQuote && (
            <button className="btn-secondary btn-sm shadow-sm" onClick={() => window.print()}>
              <Printer size={14} /> Exportar PDF
            </button>
          )}
          {(canDecide || canAnalyse || canAssign) && (
            <>
              {canAssign && (
                <button className="btn-primary btn-sm shadow-sm" onClick={handleAssign}
                  disabled={assignRequest.isPending}>
                  <UserCheck size={14} />
                  {assignRequest.isPending ? 'Assumindo...' : 'Assumir solicitação'}
                </button>
              )}
              {canAnalyse && !hasQuote && (
                <button className="btn-primary btn-sm shadow-sm" onClick={handleStartQuote}
                  disabled={createQuote.isPending}>
                  <ClipboardList size={14} />
                  {createQuote.isPending ? 'Criando...' : 'Iniciar orçamento'}
                </button>
              )}
              {canAnalyse && hasQuote && (
                <button
                  className="btn-secondary btn-sm shadow-sm"
                  onClick={() => setInlineQuoteEdit((v) => !v)}
                >
                  <FileText size={14} /> {inlineQuoteEdit ? 'Fechar edição' : 'Editar orçamento'}
                </button>
              )}
              {canDecide && (
                <>
                  <button className="btn-primary btn-sm shadow-sm bg-emerald-500 hover:bg-emerald-600 border-emerald-500"
                    onClick={() => setDecisionModal({ open: true, action: 'APPROVED' })}>
                    <CheckCircle2 size={14} /> Aprovar
                  </button>
                  <button className="btn-secondary btn-sm shadow-sm text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => setDecisionModal({ open: true, action: 'REJECTED' })}>
                    <XCircle size={14} /> Reprovar
                  </button>
                  {request.status !== 'ON_HOLD' && (
                    <button className="btn-secondary btn-sm shadow-sm text-orange-600 border-orange-200 hover:bg-orange-50"
                      onClick={() => setDecisionModal({ open: true, action: 'ON_HOLD' })}>
                      <PauseCircle size={14} /> Em espera
                    </button>
                  )}
                  <button className="btn-ghost btn-sm text-surface-500 hover:text-red-500 hover:bg-red-50"
                    onClick={() => setDecisionModal({ open: true, action: 'CANCELLED' })}>
                    <Trash2 size={14} /> Cancelar
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="page-body max-w-[1500px] mx-auto space-y-6 screen-only">
        {apiError && <Alert type="error" message={apiError} />}

        {/* Bloco único — informações principais */}
        <div className="card">
          <div className="card-body">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold flex items-center gap-2 mb-2">
                    <User size={14} className="text-surface-400" /> Dados da solicitação
                  </p>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                    <div>
                      <dt className="text-surface-400 text-xs">Solicitante</dt>
                      <dd className="font-medium truncate" title={request.requesterName}>{request.requesterName}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-surface-400 text-xs">E-mail</dt>
                      <dd className="truncate" title={request.requesterEmail}>{request.requesterEmail}</dd>
                    </div>
                    {request.requesterPhone && (
                      <div>
                        <dt className="text-surface-400 text-xs">Telefone</dt>
                        <dd className="truncate" title={request.requesterPhone}>{request.requesterPhone}</dd>
                      </div>
                    )}
                    {request.client && (
                      <div>
                        <dt className="text-surface-400 text-xs">Cliente</dt>
                        <dd className="font-medium truncate" title={request.client.name}>{request.client.name}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                <div className="pt-2 border-t border-surface-100">
                  <p className="text-sm font-semibold flex items-center gap-2 mb-2">
                    <Calendar size={14} className="text-surface-400" /> Datas
                  </p>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                    <div>
                      <dt className="text-surface-400 text-xs">Data da solicitação</dt>
                      <dd className="font-medium mt-0.5">{formatDate(request.createdAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-surface-400 text-xs">Conclusão desejada</dt>
                      <dd className="font-medium mt-0.5">{formatDate(request.requestedDate)}</dd>
                    </div>
                    {request.estimatedDate && (
                      <div>
                        <dt className="text-surface-400 text-xs">Previsão confirmada</dt>
                        <dd className="font-semibold text-brand-600 mt-0.5">{formatDate(request.estimatedDate)}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <Building2 size={14} className="text-surface-400" /> Cliente final / Localidade
                </p>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                  <div>
                    <dt className="text-surface-400 text-xs">Nome</dt>
                    <dd className="font-medium truncate" title={showValue(request.finalClientName)}>{showValue(request.finalClientName)}</dd>
                  </div>
                  <div>
                    <dt className="text-surface-400 text-xs">Empresa</dt>
                    <dd className="truncate" title={showValue(request.finalClientCompany)}>
                      {showValue(request.finalClientCompany)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-surface-400 text-xs">Contato local</dt>
                    <dd className="truncate" title={showValue(request.finalClientContact)}>
                      {showValue(request.finalClientContact)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-surface-400 text-xs">Telefone local</dt>
                    <dd className="truncate" title={showValue(request.finalClientPhone)}>
                      {showValue(request.finalClientPhone)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-surface-400 text-xs">CPF/CNPJ</dt>
                    <dd className="truncate" title={showValue(request.finalClientDocument)}>
                      {showValue(request.finalClientDocument)}
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 flex items-start gap-2 text-sm p-2.5 bg-surface-50 rounded-lg">
                  <MapPin size={14} className="text-surface-400 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-medium break-words">
                      {addressLine1 || 'Endereço não informado'}
                    </p>
                    <p className="text-surface-500 break-words">
                      {addressLine2 || 'Cidade/UF não informadas'}
                    </p>
                    <p className="text-surface-400 text-xs mt-1">{hasAnyAddress ? showValue(request.reference) : '—'}</p>
                    <p className="text-xs font-mono text-surface-400 mt-1">
                      {hasAnyAddress && request.latitude && request.longitude ? `${request.latitude}, ${request.longitude}` : '—'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Interface Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          
          {/* Content Left (Servicos e Orcamentos) - 75% largura em XL */}
          <div className="xl:col-span-3 space-y-6">
            {/* Bloco 3 — Serviço */}
            <div className="card">
              <div className="card-header">
                <span className="text-sm font-semibold">Dados do serviço</span>
              </div>
              <div className="card-body space-y-3">
                <div>
                  <p className="text-xs text-surface-400 mb-2">Tipos de serviço</p>
                  <div className="flex flex-wrap gap-1.5">
                    {request.serviceTypes?.map((st: any) => (
                      <span key={st.serviceTypeId}
                        className="text-xs bg-brand-50 text-brand-700 border border-brand-200 px-2 py-0.5 rounded-full font-medium">
                        {st.serviceType.name}
                      </span>
                    ))}
                  </div>
                </div>
                {request.description && (
                  <div>
                    <p className="text-xs text-surface-400 mb-1">Descrição</p>
                    <p className="text-sm text-surface-700 bg-surface-50 rounded p-3">{request.description}</p>
                  </div>
                )}
                {request.observations && (
                  <div>
                    <p className="text-xs text-surface-400 mb-1">Observações</p>
                    <p className="text-sm text-surface-700">{request.observations}</p>
                  </div>
                )}
                {request.assignedToUser && (
                  <div>
                    <p className="text-xs text-surface-400 mb-1">Analista responsável</p>
                    <p className="text-sm font-medium">{request.assignedToUser.name}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Orçamento resumido (se existir) */}
            {activeQuote && (
              <div className="card border-brand-200">
                <div className="card-header items-center">
                  <span className="text-sm font-bold text-brand-700">
                     Orçamento - {request.client?.name ?? request.finalClientName} - {request.requestNumber} - Total: {formatCurrency(Number(activeQuote.totalValue ?? 0))}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${activeQuote.status === 'SENT' ? 'bg-cyan-50 text-cyan-700' : 'bg-slate-100 text-slate-600'}`}>
                      {activeQuote.status === 'SENT' ? 'Enviado' : activeQuote.status === 'DRAFT' ? 'Rascunho' : activeQuote.status}
                    </span>
                    {canAnalyse && activeQuote.status === 'DRAFT' && (
                      <button
                        className="btn-secondary btn-sm"
                        onClick={() => setInlineQuoteEdit((v) => !v)}
                      >
                        <FileText size={14} /> {inlineQuoteEdit ? 'Fechar edição' : 'Editar'}
                      </button>
                    )}
                  </div>
                </div>
                <div className="card-body">
                  {(activeQuote.items ?? []).length === 0 ? (
                    <EmptyState title="Orçamento sem itens" />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Descrição</th>
                            <th>Tipo</th>
                            <th className="text-right">Qtd</th>
                            <th className="text-right">Valor unit.</th>
                            <th className="text-right">Total</th>
                            {inlineQuoteEdit && canAnalyse && activeQuote.status === 'DRAFT' && <th className="text-right">Ações</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {(activeQuote.items ?? []).map((item: any) => (
                            <tr key={item.id}>
                              <td>
                                <p className="text-sm font-medium">{item.description}</p>
                                <p className="text-xs text-surface-400">
                                  {item.code ? `${item.code} · ` : ''}{item.unit}
                                </p>
                              </td>
                              <td className="text-xs text-surface-500">{item.serviceType?.name ?? '—'}</td>
                              <td className="text-right text-sm">
                                {inlineQuoteEdit && canAnalyse && activeQuote.status === 'DRAFT' ? (
                                  <input
                                    type="number"
                                    min="0.001"
                                    step="0.001"
                                    defaultValue={Number(item.quantity)}
                                    className="form-input text-xs py-1 w-20 ml-auto text-right"
                                    onBlur={async (e) => {
                                      const qty = Number(e.target.value)
                                      if (!Number.isFinite(qty) || qty <= 0) return
                                      try {
                                        await updateQuoteItem.mutateAsync({
                                          requestId: id!,
                                          quoteId: activeQuote.id,
                                          itemId: item.id,
                                          data: { quantity: qty },
                                        })
                                      } catch (err) {
                                        setApiError(extractApiError(err))
                                      }
                                    }}
                                  />
                                ) : (
                                  Number(item.quantity)
                                )}
                              </td>
                              <td className="text-right text-sm font-medium">
                                {inlineQuoteEdit && canAnalyse && activeQuote.status === 'DRAFT' ? (
                                  <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    defaultValue={Number(item.unitValue ?? 0)}
                                    className="form-input text-xs py-1 w-28 ml-auto text-right"
                                    onBlur={async (e) => {
                                      const val = Number(e.target.value)
                                      if (!Number.isFinite(val) || val <= 0) return
                                      try {
                                        await updateQuoteItem.mutateAsync({
                                          requestId: id!,
                                          quoteId: activeQuote.id,
                                          itemId: item.id,
                                          data: { unitValue: val },
                                        })
                                      } catch (err) {
                                        setApiError(extractApiError(err))
                                      }
                                    }}
                                  />
                                ) : (
                                  formatCurrency(Number(item.unitValue ?? 0))
                                )}
                              </td>
                              <td className="text-right text-sm font-semibold">{formatCurrency(Number(item.totalValue ?? 0))}</td>
                              {inlineQuoteEdit && canAnalyse && activeQuote.status === 'DRAFT' && (
                                <td className="text-right">
                                  <button
                                    className="btn-ghost btn-sm text-red-500 hover:text-red-600"
                                    onClick={async () => {
                                      try {
                                        await deleteQuoteItem.mutateAsync({
                                          requestId: id!,
                                          quoteId: activeQuote.id,
                                          itemId: item.id,
                                        })
                                      } catch (err) {
                                        setApiError(extractApiError(err))
                                      }
                                    }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {inlineQuoteEdit && canAnalyse && activeQuote.status === 'DRAFT' && (
                    <div className="mt-4 border-t border-surface-100 pt-4 space-y-3">
                      <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide">Adicionar item da tabela de preços</p>
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                        {priceTables.length > 1 && (
                          <select
                            value={inlineTableId}
                            onChange={(e) => {
                              setInlineTableId(e.target.value)
                              setManualItem((v) => ({ ...v, priceItemId: '' }))
                            }}
                            className="form-input text-xs"
                          >
                            {priceTables.map((t: any) => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        )}
                        <select
                          value={manualItem.priceItemId}
                          onChange={(e) => setManualItem((v) => ({ ...v, priceItemId: e.target.value }))}
                          className={`form-input text-xs ${priceTables.length > 1 ? 'md:col-span-3' : 'md:col-span-4'}`}
                        >
                          <option value="">Selecione item cadastrado...</option>
                          {inlinePriceItems.map((item: any) => (
                            <option key={item.id} value={item.id}>
                              {item.code ? `${item.code} · ` : ''}{item.description}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={manualItem.quantity}
                          onChange={(e) => setManualItem((v) => ({ ...v, quantity: Number(e.target.value) }))}
                          className="form-input text-xs"
                          placeholder="Qtd"
                        />
                        <input
                          value={selectedInlinePriceItem?.unit ?? ''}
                          readOnly
                          className="form-input text-xs"
                          placeholder="Unidade"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                        <input
                          value={selectedInlinePriceItem ? formatCurrency(Number(selectedInlinePriceItem.unitValue)) : ''}
                          readOnly
                          className="form-input text-xs"
                          placeholder="Valor unitário"
                        />
                        <input
                          value={selectedInlinePriceItem?.description ?? ''}
                          readOnly
                          className="form-input text-xs md:col-span-2"
                          placeholder="Descrição"
                        />
                        <div className="flex justify-end">
                          <button className="btn-primary btn-sm" onClick={handleAddManualItemInline} disabled={addQuoteItem.isPending}>
                            {addQuoteItem.isPending ? <Spinner size="sm" /> : <Plus size={13} />} Adicionar item
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 border-t border-surface-100 pt-4 flex justify-end">
                    <div className="w-full max-w-xs space-y-1.5 text-sm">
                      <div className="flex justify-between text-surface-600">
                        <span>Subtotal</span>
                        <span className="font-medium">{formatCurrency(Number(activeQuote.subtotal ?? 0))}</span>
                      </div>
                      {Number(activeQuote.discount ?? 0) > 0 && (
                        <div className="flex justify-between text-emerald-600">
                          <span>Desconto</span>
                          <span className="font-medium">- {formatCurrency(Number(activeQuote.discount ?? 0))}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-surface-200 pt-2 text-base font-bold">
                        <span>Total</span>
                        <span className="text-brand-600">{formatCurrency(Number(activeQuote.totalValue ?? 0))}</span>
                      </div>
                    </div>
                  </div>

                  {(activeQuote.technicalNotes || activeQuote.commercialNotes) && (
                    <div className="mt-4 border-t border-surface-100 pt-4 space-y-3">
                      {activeQuote.technicalNotes && (
                        <div>
                          <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-1">Observações técnicas</p>
                          <p className="text-sm text-surface-700">{activeQuote.technicalNotes}</p>
                        </div>
                      )}
                      {activeQuote.commercialNotes && (
                        <div>
                          <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-1">Observações comerciais</p>
                          <p className="text-sm text-surface-700">{activeQuote.commercialNotes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Right (Historico) - 25% largura em XL */}
          <div className="xl:col-span-1 space-y-6">
            
            {/* Notas internas (Apenas Analistas/Admins) */}
            {(role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'ANALYST') && (
              <div className="card">
                <div className="card-header">
                  <span className="text-sm font-semibold flex items-center gap-2 text-surface-600">
                    <FileText size={14} /> Adicionar Nota
                  </span>
                </div>
                <div className="card-body">
                  <p className="text-[11px] text-surface-400 mb-2">Essas anotações ficam ocultas do cliente. São mostradas apenas para a equipe na timeline oficial.</p>
                  <textarea rows={3} className="form-input text-xs w-full bg-yellow-50" placeholder="Anotação de uso interno..." id="internal-note-input" />
                  <button className="btn-secondary btn-sm w-full mt-2" onClick={async (e) => {
                    const el = document.getElementById('internal-note-input') as HTMLTextAreaElement
                    if (!el || !el.value.trim()) return
                    try {
                      const btn = e.currentTarget;
                      btn.disabled = true;
                      btn.innerText = 'Salvando...';
                      await api.post(`/api/v1/requests/${id}/notes`, { note: el.value })
                      el.value = ''
                      await Promise.all([
                        qc.invalidateQueries({ queryKey: ['request', id] }),
                        qc.invalidateQueries({ queryKey: ['request-history', id] })
                      ])
                      btn.disabled = false;
                      btn.innerText = 'Salvar nota';
                    } catch (err: any) {
                      alert('Erro ao salvar nota: ' + extractApiError(err))
                    }
                  }}>Salvar nota</button>
                </div>
              </div>
            )}

            {/* Histórico */}
            <div className="card h-full max-h-[800px] flex flex-col">
              <div className="card-header flex-shrink-0">
                <span className="text-sm font-semibold flex items-center gap-2">
                  <Clock size={14} className="text-surface-400" /> Histórico de timeline
                </span>
              </div>
              <div className="card-body overflow-y-auto override-scrollbar">
                {history.filter((h: any) => role === 'CLIENT' ? h.action !== 'NOTA INTERNA' : true).length === 0
                  ? <p className="text-xs text-surface-400 text-center py-8">Ainda não há registros nesta solicitação.</p>
                  : (
                    <ol className="relative border-l border-surface-200 ml-2 space-y-5 pb-2">
                      {history.filter((h: any) => role === 'CLIENT' ? h.action !== 'NOTA INTERNA' : true).map((h: any) => (
                        <li key={h.id} className="ml-5">
                          <div className={`absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full ring-4 ring-white ${h.action === 'NOTA INTERNA' ? 'bg-amber-400' : 'bg-brand-400'}`} />
                          <p className="text-xs font-semibold text-surface-800">{h.action}</p>
                          {h.observations && (
                            <p className="text-xs text-surface-500 mt-1 italic border-l-2 border-surface-200 pl-2">"{h.observations}"</p>
                          )}
                          <p className="text-[11px] text-surface-400 mt-1 flex items-center gap-1">
                            <User size={10} /> {h.performedByUser?.name} · {formatDateTime(h.performedAt)}
                          </p>
                        </li>
                      ))}
                    </ol>
                  )
                }
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de decisão */}
      {decisionModal?.open && (
        <Modal
          open
          onClose={() => { setDecisionModal(null); setApiError(''); setObservations('') }}
          title={
            decisionModal.action === 'APPROVED' ? 'Aprovar orçamento'
            : decisionModal.action === 'REJECTED' ? 'Reprovar orçamento'
            : decisionModal.action === 'ON_HOLD'  ? 'Colocar em espera'
            : 'Cancelar solicitação'
          }
          footer={
            <>
              <button className="btn-secondary"
                onClick={() => { setDecisionModal(null); setApiError(''); setObservations('') }}>
                Voltar
              </button>
              <button
                className={decisionModal.action === 'APPROVED' ? 'btn-primary bg-emerald-500 hover:bg-emerald-600' : 'btn-danger'}
                onClick={() => handleDecision(decisionModal.action)}
                disabled={quoteDecision.isPending}
              >
                {quoteDecision.isPending ? <Spinner size="sm" /> : null}
                Confirmar
              </button>
            </>
          }
        >
          <div className="space-y-3">
            {apiError && <Alert type="error" message={apiError} />}
            {decisionModal.action !== 'APPROVED' && (
              <div>
                <label className="form-label">
                  {decisionModal.action === 'REJECTED' ? 'Motivo da reprovação' : 'Observação'}
                  <span className="text-red-400 ml-1">*</span>
                </label>
                <textarea
                  rows={3}
                  className="form-input resize-none"
                  placeholder="Descreva o motivo..."
                  value={observations}
                  onChange={e => setObservations(e.target.value)}
                />
              </div>
            )}
            {decisionModal.action === 'APPROVED' && (
              <p className="text-sm text-surface-600">
                Confirma a aprovação deste orçamento? Esta ação não pode ser desfeita.
              </p>
            )}
          </div>
        </Modal>
      )}

      {/* ── Template Oculto para Impressão (PDF) via print-only ── */}
      {activeQuote && request.status === 'APPROVED' && (
        <div className="print-only print-container p-8 bg-white text-surface-900">
          
          {/* Header do PDF */}
          <div className="flex justify-between items-start border-b-2 border-brand-500 pb-6 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-brand-600 tracking-tight">Portal de Orçamentos</h1>
              <p className="text-surface-500 mt-1">Proposta técnica e comercial</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-lg">{request.requestNumber}</p>
              <p className="text-surface-500">{formatDateTime(activeQuote.createdAt)}</p>
            </div>
          </div>

          {/* Dados do Cliente */}
          <div className="grid grid-cols-2 gap-8 mb-8 border-b border-surface-200 pb-8">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-surface-400 mb-2">Solicitante / Empresa</h3>
              <p className="font-semibold">{request.requesterName}</p>
              <p className="text-surface-600">{request.requesterEmail}</p>
              {request.requesterPhone && <p className="text-surface-600">{request.requesterPhone}</p>}
              <p className="text-surface-600 font-medium mt-1">Conta: {request.client?.name}</p>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-surface-400 mb-2">Cliente Final (Local do Serviço)</h3>
              <p className="font-semibold">{request.finalClientName}</p>
              {request.finalClientCompany && <p className="text-surface-600">{request.finalClientCompany}</p>}
              <p className="text-surface-600 mt-1">
                {request.street}{request.streetNumber && `, ${request.streetNumber}`}
                {request.city && ` - ${request.city}`} {request.state && `/${request.state}`}
              </p>
              <p className="text-surface-600">CEP: {request.zipCode || 'Não informado'}</p>
            </div>
          </div>

          {/* Escopo */}
          <div className="mb-8">
            <h3 className="text-xs font-bold uppercase tracking-widest text-surface-400 mb-2">Escopo da Solicitação</h3>
            <p className="text-surface-800 whitespace-pre-wrap">{request.description || request.observations || 'Nenhum detalhe adicional fornecido.'}</p>
          </div>

          {/* Tabela de Itens */}
          <div className="mb-10">
            <h3 className="text-xs font-bold uppercase tracking-widest text-surface-400 mb-3">Itens do Orçamento</h3>
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-surface-200">
                  <th className="py-2 pr-4 font-semibold text-surface-600">Item</th>
                  <th className="py-2 px-4 font-semibold text-surface-600 text-right">Qtd</th>
                  <th className="py-2 px-4 font-semibold text-surface-600 text-right">V. Unit</th>
                  <th className="py-2 pl-4 font-semibold text-surface-600 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {(activeQuote.items ?? []).map((item: any, idx: number) => (
                  <tr key={item.id} className="border-b border-surface-100">
                    <td className="py-3 pr-4">
                      <div className="font-medium text-surface-900">{item.description}</div>
                      {item.code && <div className="text-xs text-surface-400">Cód: {item.code}</div>}
                    </td>
                    <td className="py-3 px-4 text-right">{item.quantity} {item.unit}</td>
                    <td className="py-3 px-4 text-right text-surface-600">{formatCurrency(item.unitValue)}</td>
                    <td className="py-3 pl-4 text-right font-medium text-surface-900">{formatCurrency(item.totalValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totais */}
            <div className="flex justify-end mt-4">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-surface-600">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(activeQuote.subtotal)}</span>
                </div>
                {activeQuote.discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Desconto:</span>
                    <span>- {formatCurrency(activeQuote.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t border-surface-200 pt-2 mt-2">
                  <span>Total Geral:</span>
                  <span className="text-brand-600">{formatCurrency(activeQuote.totalValue)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Observações do Orçamento */}
          {(activeQuote.technicalNotes || activeQuote.commercialNotes) && (
            <div className="border border-surface-200 rounded p-6 bg-surface-50 break-inside-avoid">
              {activeQuote.technicalNotes && (
                <div className="mb-4 last:mb-0">
                  <h4 className="text-xs font-bold uppercase text-surface-400 mb-1">Notas Técnicas</h4>
                  <p className="text-sm text-surface-800 whitespace-pre-wrap">{activeQuote.technicalNotes}</p>
                </div>
              )}
              {activeQuote.commercialNotes && (
                <div className="last:mb-0">
                  <h4 className="text-xs font-bold uppercase text-surface-400 mb-1">Notas Comerciais</h4>
                  <p className="text-sm text-surface-800 whitespace-pre-wrap">{activeQuote.commercialNotes}</p>
                </div>
              )}
            </div>
          )}

          {/* Assinatura / Rodapé */}
          <div className="mt-20 pt-8 border-t border-surface-200 flex justify-between text-sm text-surface-500">
            <div>
              <p>Orçamento aprovado em {formatDate(activeQuote.decidedAt || new Date())}</p>
              <p>Por: {request.requesterName}</p>
            </div>
            <div className="text-right">
              <p>Validade: 15 dias após emissão</p>
              <p>Documento gerado automaticamente.</p>
            </div>
          </div>

        </div>
      )}

    </div>
  )
}
