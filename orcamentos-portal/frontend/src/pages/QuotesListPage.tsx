// ============================================================
// Orçamentos — lista e visualização para o cliente
// ============================================================
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { useRequests } from '../hooks/queries'
import { useRole } from '../store/auth.store'
import {
  RequestStatusBadge, PageLoader, EmptyState, Pagination,
} from '../components/ui'
import { formatCurrency, formatDate, formatDateTime } from '../lib/constants'

// ── Lista de orçamentos (menu "Orçamentos" do cliente) ────
export default function QuotesListPage() {
  const navigate = useNavigate()
  const role     = useRole()
  const [page, setPage] = useState(1)

  // Cliente: pendentes de decisão | Analista/Admin: visão ampla dos orçamentos
  const { data, isLoading } = useRequests({
    page, limit: 20,
  })

  const requests = (data?.data ?? []).filter((r: any) => {
    const quote = r.quotes?.[0]
    if (!quote) return false
    if (role === 'CLIENT') return ['QUOTE_SENT', 'ON_HOLD'].includes(r.status)
    return true
  })
  const totalPages = data?.meta?.totalPages ?? 1
  const total      = requests.length

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="font-semibold text-surface-900">Orçamentos</h1>
          {!isLoading && (
            <p className="text-xs text-surface-400">
              {total} orçamento{total !== 1 ? 's' : ''}
              {role === 'CLIENT' ? ' aguardando decisão' : ' vinculados às solicitações'}
            </p>
          )}
        </div>
      </div>

      <div className="page-body space-y-4">
        <div className="card overflow-hidden">
          {isLoading ? <PageLoader /> : requests.length === 0
            ? (
              <EmptyState
                icon={<FileText className="w-full h-full" />}
                title="Nenhum orçamento pendente"
                desc="Quando um analista enviar um orçamento, ele aparecerá aqui para sua aprovação"
              />
            )
            : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Solicitação</th>
                      <th>Cliente final</th>
                      <th>Tipos de serviço</th>
                      <th>Data envio</th>
                      <th>Valor</th>
                      <th>Status</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((r: any) => {
                      const quote = r.quotes?.[0]
                      return (
                        <tr key={r.id}>
                          <td>
                            <p className="font-mono text-xs font-medium text-brand-600">{r.requestNumber}</p>
                            <p className="text-xs text-surface-400">{formatDateTime(r.createdAt)}</p>
                          </td>
                          <td className="text-sm">{r.finalClientName}</td>
                          <td>
                            <div className="flex flex-wrap gap-1">
                              {r.serviceTypes?.slice(0, 2).map((st: any) => (
                                <span key={st.serviceTypeId} className="text-xs bg-surface-100 text-surface-600 px-1.5 py-0.5 rounded">
                                  {st.serviceType.name}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="text-xs text-surface-500">
                            {quote ? formatDate(quote.sentAt) : '—'}
                          </td>
                          <td className="font-semibold text-brand-600 text-sm">
                            {quote ? formatCurrency(quote.totalValue ?? 0) : '—'}
                          </td>
                          <td><RequestStatusBadge status={r.status} /></td>
                          <td>
                            <button
                              className="btn-primary btn-sm"
                              onClick={() => navigate(`/requests/${r.id}`)}
                            >
                              Ver orçamento
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
