import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { EmptyState, PageLoader, Pagination } from '../components/ui'
import { useProposalRequests } from '../hooks/queries'

export default function ProposalRequestsPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')

  const { data, isLoading } = useProposalRequests({
    page,
    limit: 20,
    q: q || undefined,
    status: status || undefined,
  })

  const rows = data?.data ?? []
  const totalPages = data?.meta?.totalPages ?? 1

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="font-semibold text-surface-900">Solicitações de propostas</h1>
          <p className="text-xs text-surface-400">Fila interna do Comercial e Pré-vendas</p>
        </div>
        <button className="btn-primary btn-sm" onClick={() => navigate('/proposals/requests/new')}>
          <Plus size={14} /> Nova solicitação
        </button>
      </div>

      <div className="page-body space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="relative md:col-span-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              className="form-input pl-9"
              placeholder="Buscar por número, cliente ou título..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(1)
              }}
            />
          </div>
          <select
            className="form-input appearance-none"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
          >
            <option value="">Todos os status</option>
            <option value="DRAFT">Rascunho</option>
            <option value="IN_SURVEY">Em levantamento</option>
            <option value="WAITING_PRESALES">Aguardando Pré-vendas</option>
            <option value="RETURNED_WITH_PENDING">Devolvida com pendência</option>
            <option value="READY_FOR_PROPOSAL">Liberada para proposta</option>
            <option value="PROPOSAL_GENERATED">Proposta gerada</option>
            <option value="PROPOSAL_PUBLISHED">Proposta publicada</option>
          </select>
        </div>

        <div className="card overflow-hidden">
          {isLoading ? (
            <PageLoader />
          ) : rows.length === 0 ? (
            <EmptyState title="Nenhuma solicitação encontrada" />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Número</th>
                    <th>Título</th>
                    <th>Cliente</th>
                    <th>Tecnologia</th>
                    <th>Urgência</th>
                    <th>Status</th>
                    <th>Responsáveis</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row: any) => (
                    <tr key={row.id}>
                      <td className="font-mono text-xs text-brand-600">{row.number}</td>
                      <td className="text-sm font-medium">{row.title}</td>
                      <td>{row.customerName}</td>
                      <td>{row.technology}</td>
                      <td>{row.urgency}</td>
                      <td>{row.status}</td>
                      <td>
                        <div className="text-xs">
                          <div>Comercial: {row.commercialOwner?.name ?? '-'}</div>
                          <div>Pré-vendas: {row.presalesOwner?.name ?? '-'}</div>
                        </div>
                      </td>
                      <td>
                        <button className="btn-ghost btn-sm" onClick={() => navigate(`/proposals/requests/${row.id}`)}>
                          Abrir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Pagination page={page} totalPages={totalPages} onPage={setPage} />
      </div>
    </div>
  )
}
