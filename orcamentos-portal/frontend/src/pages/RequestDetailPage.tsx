// ============================================================
// Detalhe da Solicitação
// ============================================================
import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, MapPin, Calendar, User, Building2,
  Clock, CheckCircle2, XCircle, PauseCircle, Trash2,
  ClipboardList, FileText, Send, UserCheck,
} from 'lucide-react'
import {
  useRequest, useRequestHistory, useAssignRequest, useCreateQuote, useQuoteDecision,
} from '../hooks/queries'
import { useRole, useUser } from '../store/auth.store'
import {
  RequestStatusBadge, UrgentBadge, Modal, Alert, Spinner, PageLoader, EmptyState,
} from '../components/ui'
import { formatDate, formatDateTime } from '../lib/constants'
import { extractApiError } from '../lib/api'
import QuoteBuilderPage from './QuoteBuilderPage'

export default function RequestDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const role     = useRole()
  const user     = useUser()

  const { data: request, isLoading } = useRequest(id!)
  const { data: history = [] }       = useRequestHistory(id!)
  const quoteDecision = useQuoteDecision()
  const assignRequest = useAssignRequest()
  const createQuote   = useCreateQuote()

  const [decisionModal, setDecisionModal] = useState<{ open: boolean; action: string } | null>(null)
  const [observations,  setObservations]  = useState('')
  const [apiError,      setApiError]      = useState('')
  const [showQuote,     setShowQuote]     = useState(false)

  if (isLoading)  return <PageLoader />
  if (!request)   return <div className="p-8 text-surface-400">Solicitação não encontrada.</div>

  const activeQuote = (request.quotes ?? []).find((q: any) => ['SENT', 'DRAFT', 'ON_HOLD'].includes(q.status))
  const canDecide  = role === 'CLIENT' && !!activeQuote && ['SENT', 'ON_HOLD'].includes(activeQuote.status)
  const canAnalyse = (role === 'ANALYST' || role === 'ADMIN') && ['IN_ANALYSIS', 'QUOTE_IN_PROGRESS'].includes(request.status)
  const canAssign  = (role === 'ANALYST' || role === 'ADMIN') && request.status === 'REQUESTED'
  const hasQuote   = (request.quotes ?? []).length > 0

  const handleDecision = async (action: string) => {
    const needsReason = ['REJECTED', 'ON_HOLD', 'CANCELLED'].includes(action)
    if (needsReason && !observations.trim()) {
      setApiError('Observação obrigatória para esta ação.')
      return
    }
    try {
      if (!activeQuote) {
        setApiError('Nenhum orçamento elegível para decisão.')
        return
      }
      await quoteDecision.mutateAsync({
        requestId: id!,
        quoteId: activeQuote.id,
        data: { status: action, decisionReason: observations || null },
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
      setShowQuote(true)
    } catch (err) {
      setApiError(extractApiError(err))
    }
  }

  if (showQuote) {
    const quote = request.quotes?.[0]
    if (quote) return <QuoteBuilderPage requestId={id!} quoteId={quote.id} onBack={() => setShowQuote(false)} />
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="btn-ghost p-1.5">
            <ChevronLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-surface-900">{request.requestNumber}</h1>
              {request.isUrgent && <UrgentBadge />}
            </div>
            <p className="text-xs text-surface-400">{formatDateTime(request.createdAt)}</p>
          </div>
        </div>
        <RequestStatusBadge status={request.status} />
      </div>

      <div className="page-body max-w-4xl mx-auto space-y-5">
        {apiError && <Alert type="error" message={apiError} />}

        {/* Ações rápidas */}
        {(canDecide || canAnalyse || canAssign) && (
          <div className="card">
            <div className="card-body">
              <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-3">Ações disponíveis</p>
              <div className="flex flex-wrap gap-2">
                {canAssign && (
                  <button className="btn-primary btn-sm" onClick={handleAssign}
                    disabled={assignRequest.isPending}>
                    <UserCheck size={14} />
                    {assignRequest.isPending ? 'Assumindo...' : 'Assumir solicitação'}
                  </button>
                )}
                {canAnalyse && !hasQuote && (
                  <button className="btn-primary btn-sm" onClick={handleStartQuote}
                    disabled={createQuote.isPending}>
                    <ClipboardList size={14} />
                    {createQuote.isPending ? 'Criando...' : 'Iniciar orçamento'}
                  </button>
                )}
                {canAnalyse && hasQuote && (
                  <button className="btn-secondary btn-sm" onClick={() => setShowQuote(true)}>
                    <FileText size={14} /> Editar orçamento
                  </button>
                )}
                {canDecide && (
                  <>
                    <button className="btn-primary btn-sm bg-emerald-500 hover:bg-emerald-600"
                      onClick={() => setDecisionModal({ open: true, action: 'APPROVED' })}>
                      <CheckCircle2 size={14} /> Aprovar
                    </button>
                    <button className="btn-secondary btn-sm text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => setDecisionModal({ open: true, action: 'REJECTED' })}>
                      <XCircle size={14} /> Reprovar
                    </button>
                    <button className="btn-secondary btn-sm text-orange-600 border-orange-200 hover:bg-orange-50"
                      onClick={() => setDecisionModal({ open: true, action: 'ON_HOLD' })}>
                      <PauseCircle size={14} /> Em espera
                    </button>
                    <button className="btn-ghost btn-sm text-surface-500"
                      onClick={() => setDecisionModal({ open: true, action: 'CANCELLED' })}>
                      <Trash2 size={14} /> Cancelar
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Coluna principal */}
          <div className="md:col-span-2 space-y-5">
            {/* Bloco 1 — Solicitação */}
            <div className="card">
              <div className="card-header">
                <span className="text-sm font-semibold flex items-center gap-2">
                  <User size={14} className="text-surface-400" /> Dados da solicitação
                </span>
              </div>
              <div className="card-body">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div>
                    <dt className="text-surface-400 text-xs">Solicitante</dt>
                    <dd className="font-medium">{request.requesterName}</dd>
                  </div>
                  <div>
                    <dt className="text-surface-400 text-xs">E-mail</dt>
                    <dd>{request.requesterEmail}</dd>
                  </div>
                  {request.requesterPhone && (
                    <div>
                      <dt className="text-surface-400 text-xs">Telefone</dt>
                      <dd>{request.requesterPhone}</dd>
                    </div>
                  )}
                  {request.client && (
                    <div>
                      <dt className="text-surface-400 text-xs">Cliente</dt>
                      <dd className="font-medium">{request.client.name}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>

            {/* Bloco 2 — Cliente final + endereço */}
            <div className="card">
              <div className="card-header">
                <span className="text-sm font-semibold flex items-center gap-2">
                  <Building2 size={14} className="text-surface-400" /> Cliente final / Localidade
                </span>
              </div>
              <div className="card-body space-y-4">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div>
                    <dt className="text-surface-400 text-xs">Nome</dt>
                    <dd className="font-medium">{request.finalClientName}</dd>
                  </div>
                  {request.finalClientCompany && (
                    <div>
                      <dt className="text-surface-400 text-xs">Empresa</dt>
                      <dd>{request.finalClientCompany}</dd>
                    </div>
                  )}
                  {request.finalClientContact && (
                    <div>
                      <dt className="text-surface-400 text-xs">Contato local</dt>
                      <dd>{request.finalClientContact}</dd>
                    </div>
                  )}
                  {request.finalClientPhone && (
                    <div>
                      <dt className="text-surface-400 text-xs">Telefone local</dt>
                      <dd>{request.finalClientPhone}</dd>
                    </div>
                  )}
                </dl>

                {request.street && (
                  <div className="flex items-start gap-2 text-sm p-3 bg-surface-50 rounded-lg">
                    <MapPin size={14} className="text-surface-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">
                        {request.street}{request.streetNumber ? `, ${request.streetNumber}` : ''}
                        {request.complement ? ` — ${request.complement}` : ''}
                      </p>
                      <p className="text-surface-500">
                        {[request.neighborhood, request.city, request.state].filter(Boolean).join(', ')}
                        {request.zipCode ? ` — CEP ${request.zipCode}` : ''}
                      </p>
                      {request.reference && <p className="text-surface-400 text-xs mt-1">{request.reference}</p>}
                      {request.latitude && (
                        <p className="text-xs font-mono text-surface-400 mt-1">
                          {request.latitude}, {request.longitude}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

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
                <div className="card-header">
                  <span className="text-sm font-semibold text-brand-700">Orçamento</span>
                  <span className={`badge ${activeQuote.status === 'SENT' ? 'bg-cyan-50 text-cyan-700' : 'bg-slate-100 text-slate-600'}`}>
                    {activeQuote.status === 'SENT' ? 'Enviado' : 'Rascunho'}
                  </span>
                </div>
                <div className="card-body">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-surface-400">Valor total</p>
                      <p className="text-xl font-bold text-brand-600">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(activeQuote.totalValue ?? 0)}
                      </p>
                    </div>
                    <button className="btn-primary btn-sm" onClick={() => navigate(`/requests/${id}/quotes/${activeQuote.id}`)}>
                      <FileText size={14} /> Ver orçamento
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Coluna lateral — Datas + Histórico */}
          <div className="space-y-5">
            <div className="card">
              <div className="card-header">
                <span className="text-sm font-semibold flex items-center gap-2">
                  <Calendar size={14} className="text-surface-400" /> Datas
                </span>
              </div>
              <div className="card-body space-y-3 text-sm">
                <div>
                  <p className="text-xs text-surface-400">Data da solicitação</p>
                  <p className="font-medium">{formatDate(request.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-surface-400">Data prevista (cliente)</p>
                  <p className="font-medium">{formatDate(request.requestedDate)}</p>
                </div>
                {request.estimatedDate && (
                  <div>
                    <p className="text-xs text-surface-400">Data provável (analista)</p>
                    <p className="font-medium text-brand-600">{formatDate(request.estimatedDate)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Histórico */}
            <div className="card">
              <div className="card-header">
                <span className="text-sm font-semibold flex items-center gap-2">
                  <Clock size={14} className="text-surface-400" /> Histórico
                </span>
              </div>
              <div className="card-body">
                {history.length === 0
                  ? <p className="text-xs text-surface-400 text-center py-4">Sem registros</p>
                  : (
                    <ol className="relative border-l border-surface-100 ml-2 space-y-4">
                      {history.map((h: any) => (
                        <li key={h.id} className="ml-4">
                          <div className="absolute -left-1.5 mt-1 w-3 h-3 rounded-full bg-brand-200 border-2 border-white" />
                          <p className="text-xs font-medium text-surface-700">{h.action}</p>
                          {h.observations && (
                            <p className="text-xs text-surface-500 mt-0.5 italic">"{h.observations}"</p>
                          )}
                          <p className="text-xs text-surface-400 mt-0.5">
                            {h.performedByUser?.name} · {formatDateTime(h.performedAt)}
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
    </div>
  )
}
