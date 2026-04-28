import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { EmptyState, PageLoader, Spinner } from '../components/ui'
import { useDecideProposalApproval, useProposalApprovals } from '../hooks/queries'
import { extractApiError } from '../lib/api'

export default function ProposalApprovalsPage() {
  const navigate = useNavigate()
  const [apiError, setApiError] = useState('')
  const { data, isLoading } = useProposalApprovals({ status: 'PENDING', limit: 100 })
  const decideApproval = useDecideProposalApproval()
  const rows = data?.data ?? []

  const handleDecision = async (approvalId: string, decision: 'APPROVED' | 'REJECTED') => {
    setApiError('')
    try {
      await decideApproval.mutateAsync({
        approvalId,
        data: {
          decision,
          justification: decision === 'APPROVED'
            ? 'Aprovação concedida conforme política de alçada.'
            : 'Reprovado para revisão comercial e ajustes.',
        },
      })
    } catch (error) {
      setApiError(extractApiError(error))
    }
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="font-semibold text-surface-900">Aprovações</h1>
          <p className="text-xs text-surface-400">Solicitações aguardando decisão de alçada</p>
        </div>
      </div>

      <div className="page-body">
        <div className="card overflow-hidden">
          {apiError && <p className="px-4 pt-3 text-sm text-red-600">{apiError}</p>}
          {isLoading ? (
            <PageLoader />
          ) : rows.length === 0 ? (
            <EmptyState title="Nenhuma aprovação pendente" />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Tipo</th>
                  <th>Título</th>
                  <th>Cliente</th>
                  <th>Solicitante</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row: any) => (
                  <tr key={row.id}>
                    <td className="font-mono text-xs text-brand-600">{row.proposalRequest?.number}</td>
                    <td>{row.approvalType}</td>
                    <td>{row.proposalRequest?.title}</td>
                    <td>{row.proposalRequest?.customerName}</td>
                    <td>{row.requesterUser?.name}</td>
                    <td>{row.status}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn-ghost btn-sm" onClick={() => navigate(`/proposals/requests/${row.proposalRequestId}`)}>
                          Abrir
                        </button>
                        <button
                          className="btn-secondary btn-sm"
                          disabled={decideApproval.isPending}
                          onClick={() => handleDecision(row.id, 'APPROVED')}
                        >
                          {decideApproval.isPending ? <Spinner size="sm" /> : null}
                          Aprovar
                        </button>
                        <button
                          className="btn-secondary btn-sm"
                          disabled={decideApproval.isPending}
                          onClick={() => handleDecision(row.id, 'REJECTED')}
                        >
                          {decideApproval.isPending ? <Spinner size="sm" /> : null}
                          Reprovar
                        </button>
                      </div>
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
