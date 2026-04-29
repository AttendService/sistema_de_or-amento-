// ============================================================
// Fila de Solicitações
// ============================================================
import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Filter, Plus, Eye } from 'lucide-react'
import { useRequests } from '../hooks/queries'
import { useRole } from '../store/auth.store'
import {
  RequestStatusBadge, UrgentBadge, EmptyState, PageLoader, Pagination,
} from '../components/ui'
import { formatDate, formatDateTime } from '../lib/constants'

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'REQUESTED,IN_ANALYSIS,QUOTE_IN_PROGRESS', label: 'Pendentes de ação (Minha fila)' },
  { value: 'REQUESTED',         label: 'Solicitado'              },
  { value: 'IN_ANALYSIS',       label: 'Em análise'              },
  { value: 'QUOTE_IN_PROGRESS', label: 'Orçamento em elaboração' },
  { value: 'QUOTE_SENT',        label: 'Orçamento enviado'       },
  { value: 'APPROVED',          label: 'Aprovado'                },
  { value: 'REJECTED',          label: 'Reprovado'               },
  { value: 'ON_HOLD',           label: 'Em espera'               },
  { value: 'CANCELLED',         label: 'Cancelado'               },
]

const SORT_OPTIONS = [
  { value: 'createdAt',     label: 'Mais recente'            },
  { value: 'requestedDate', label: 'Data prevista'           },
  { value: 'isUrgent',      label: 'Urgentes primeiro'       },
]

export default function RequestsPage() {
  const navigate = useNavigate()
  const role     = useRole()
  const [searchParams] = useSearchParams()

  const initialStatus = searchParams.get('status')
  const initialUrgent = searchParams.get('urgent')

  const [page,    setPage]    = useState(1)
  const [q,       setQ]       = useState('')
  const [status,  setStatus]  = useState(initialStatus !== null ? initialStatus : '')
  const [urgent,  setUrgent]  = useState<boolean | undefined>(initialUrgent === 'true' ? true : initialUrgent === 'false' ? false : undefined)
  const [sort,    setSort]    = useState('createdAt')
  const [showFilters, setShowFilters] = useState(!!initialStatus || !!initialUrgent)

  // Sempre que URL mudar, força atualizar se user clicou novamente
  useEffect(() => {
    if (searchParams.has('status')) setStatus(searchParams.get('status') || '')
    if (searchParams.has('urgent')) setUrgent(searchParams.get('urgent') === 'true')
  }, [searchParams])

  const { data, isLoading } = useRequests({
    page, limit: 20, q: q || undefined,
    status: status || undefined,
    isUrgent: urgent,
    sort, order: sort === 'isUrgent' ? 'desc' : 'desc',
  })

  const requests   = data?.data ?? []
  const totalPages = data?.meta?.totalPages ?? 1
  const total      = data?.meta?.total ?? 0

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="font-semibold text-surface-900">
            {role === 'CLIENT' ? 'Minhas solicitações' : 'Fila de solicitações'}
          </h1>
          {!isLoading && (
            <p className="text-xs text-surface-400">{total} registro{total !== 1 ? 's' : ''}</p>
          )}
        </div>
        {role === 'CLIENT' && (
          <button className="btn-primary btn-sm" onClick={() => navigate('/requests/new')}>
            <Plus size={14} /> Nova solicitação
          </button>
        )}
      </div>

      <div className="page-body space-y-4">
        {/* Barra de busca */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              value={q}
              onChange={e => { setQ(e.target.value); setPage(1) }}
              placeholder="Buscar por número, cliente, solicitante..."
              className="form-input pl-9"
            />
          </div>
          <button
            className={`btn-secondary btn-sm gap-2 ${showFilters ? 'bg-brand-50 border-brand-200 text-brand-600' : ''}`}
            onClick={() => setShowFilters(v => !v)}
          >
            <Filter size={14} /> Filtros
          </button>
        </div>

        {/* Filtros expandidos */}
        {showFilters && (
          <div className="card">
            <div className="card-body">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="form-label">Status</label>
                  <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
                    className="form-input appearance-none">
                    {role === 'CLIENT' && <option value="">Todos os status</option>}
                    {STATUS_OPTIONS.map(o => {
                      if (role === 'CLIENT' && o.value === 'REQUESTED,IN_ANALYSIS,QUOTE_IN_PROGRESS') return null;
                      if (role === 'CLIENT' && o.value === '') return null;
                      return <option key={o.value} value={o.value}>{o.label}</option>
                    })}
                  </select>
                </div>
                <div>
                  <label className="form-label">Urgência</label>
                  <select
                    value={urgent === undefined ? '' : String(urgent)}
                    onChange={e => {
                      setUrgent(e.target.value === '' ? undefined : e.target.value === 'true')
                      setPage(1)
                    }}
                    className="form-input appearance-none"
                  >
                    <option value="">Todos</option>
                    <option value="true">Urgentes</option>
                    <option value="false">Não urgentes</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Ordenar por</label>
                  <select value={sort} onChange={e => setSort(e.target.value)}
                    className="form-input appearance-none">
                    {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <button className="btn-ghost btn-sm" onClick={() => {
                    setStatus(''); setUrgent(undefined); setSort('createdAt'); setQ(''); setPage(1)
                  }}>
                    Limpar filtros
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabela */}
        <div className="card overflow-hidden">
          {isLoading ? <PageLoader /> : requests.length === 0
            ? (
              <EmptyState
                icon={<FileIcon />}
                title="Nenhuma solicitação encontrada"
                desc="Ajuste os filtros ou crie uma nova solicitação"
                action={role === 'CLIENT'
                  ? <button className="btn-primary btn-sm" onClick={() => navigate('/requests/new')}>Nova solicitação</button>
                  : undefined
                }
              />
            )
            : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Número</th>
                      <th>Data</th>
                      <th>Solicitante</th>
                      <th>Cliente final</th>
                      <th>Tipos de serviço</th>
                      <th>Data prevista</th>
                      {role === 'CLIENT' && <th>Tempo Resp.</th>}
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((r: any) => {
                      const quote = r.quotes?.[0]
                      let slaStr = '-'
                      if (quote?.sentAt || quote?.createdAt) {
                        const end = new Date(quote.sentAt || quote.createdAt).getTime()
                        const start = new Date(r.createdAt).getTime()
                        const diffH = (end - start) / (1000 * 60 * 60)
                        slaStr = diffH < 1 ? '< 1h' : diffH < 24 ? `${diffH.toFixed(1)}h` : `${(diffH/24).toFixed(1)}d`
                      }

                      return (
                        <tr key={r.id} className="cursor-pointer" onClick={() => navigate(`/requests/${r.id}`)}>
                          <td>
                            <div className="flex flex-col">
                              <span className="font-mono text-xs font-medium text-brand-600">{r.requestNumber}</span>
                              {r.isUrgent && <UrgentBadge />}
                            </div>
                          </td>
                          <td className="text-xs text-surface-500">{formatDateTime(r.createdAt)}</td>
                          <td>
                            <div>
                              <p className="text-sm font-medium text-surface-800">{r.requesterName}</p>
                              {role !== 'CLIENT' && (
                                <p className="text-xs text-surface-400">{r.client?.name}</p>
                              )}
                            </div>
                          </td>
                          <td className="text-sm">{r.finalClientName}</td>
                          <td>
                            <div className="flex flex-wrap gap-1">
                              {r.serviceTypes?.slice(0, 2).map((st: any) => (
                                <span key={st.serviceTypeId}
                                  className="text-xs bg-surface-100 text-surface-600 px-1.5 py-0.5 rounded">
                                  {st.serviceType.name}
                                </span>
                              ))}
                              {r.serviceTypes?.length > 2 && (
                                <span className="text-xs text-surface-400">+{r.serviceTypes.length - 2}</span>
                              )}
                            </div>
                          </td>
                          <td className="text-sm text-surface-500">{formatDate(r.requestedDate)}</td>
                          {role === 'CLIENT' && (
                            <td className="text-sm font-semibold text-surface-600">{slaStr}</td>
                          )}
                          <td><RequestStatusBadge status={r.status} /></td>
                        <td onClick={e => e.stopPropagation()}>
                          <button className="btn-ghost btn-sm p-1.5"
                            onClick={() => navigate(`/requests/${r.id}`)}>
                            <Eye size={14} />
                          </button>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          }
        </div>

        <Pagination page={page} totalPages={totalPages} onPage={setPage} />
      </div>
    </div>
  )
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}
