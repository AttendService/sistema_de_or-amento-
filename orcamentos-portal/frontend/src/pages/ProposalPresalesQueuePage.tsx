import { useNavigate } from 'react-router-dom'
import { EmptyState, PageLoader } from '../components/ui'
import { usePresalesQueue } from '../hooks/queries'

export default function ProposalPresalesQueuePage() {
  const navigate = useNavigate()
  const { data, isLoading } = usePresalesQueue()
  const rows = data ?? []

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="font-semibold text-surface-900">Fila de Análises Técnicas</h1>
          <p className="text-xs text-surface-400">Demandas aguardando ação de Pré-vendas</p>
        </div>
      </div>

      <div className="page-body">
        <div className="card overflow-hidden">
          {isLoading ? (
            <PageLoader />
          ) : rows.length === 0 ? (
            <EmptyState title="Nenhuma demanda na fila técnica" />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Cliente</th>
                  <th>Título</th>
                  <th>Tecnologia</th>
                  <th>Urgência</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row: any) => (
                  <tr key={row.id}>
                    <td className="font-mono text-xs text-brand-600">{row.number}</td>
                    <td>{row.customerName}</td>
                    <td>{row.title}</td>
                    <td>{row.technology}</td>
                    <td>{row.urgency}</td>
                    <td>{row.status}</td>
                    <td>
                      <button className="btn-ghost btn-sm" onClick={() => navigate(`/proposals/requests/${row.id}`)}>
                        Analisar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
