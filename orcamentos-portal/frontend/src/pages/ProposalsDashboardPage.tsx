import { ClipboardList, Clock3, FileStack, Gauge, ShieldAlert, Sparkles } from 'lucide-react'
import { useProposalRequests } from '../hooks/queries'
import { KpiCard, PageLoader } from '../components/ui'
import { useRole } from '../store/auth.store'

function countByStatus(rows: any[], status: string) {
  return rows.filter((row) => row.status === status).length
}

export default function ProposalsDashboardPage() {
  const role = useRole()
  const { data, isLoading } = useProposalRequests({ limit: 200 })
  const rows = data?.data ?? []

  const draft = countByStatus(rows, 'DRAFT')
  const inSurvey = countByStatus(rows, 'IN_SURVEY')
  const waitingPresales = countByStatus(rows, 'WAITING_PRESALES')
  const returnedPending = countByStatus(rows, 'RETURNED_WITH_PENDING')
  const readyForProposal = countByStatus(rows, 'READY_FOR_PROPOSAL')
  const published = countByStatus(rows, 'PROPOSAL_PUBLISHED')

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="font-semibold text-surface-900">
            {role?.startsWith('PRESALES') ? 'Dashboard Técnico' : 'Dashboard Comercial'}
          </h1>
          <p className="text-xs text-surface-400">
            Módulo interno de formulação de propostas Starlink
          </p>
        </div>
      </div>

      <div className="page-body space-y-4">
        {isLoading ? (
          <PageLoader />
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard label="Rascunho" value={draft} icon={<ClipboardList size={14} />} />
              <KpiCard label="Em Levantamento" value={inSurvey} icon={<Clock3 size={14} />} />
              <KpiCard label="Aguardando Pré-vendas" value={waitingPresales} icon={<ShieldAlert size={14} />} />
              <KpiCard label="Devolvidas com Pendência" value={returnedPending} icon={<Sparkles size={14} />} />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <KpiCard label="Prontas para Proposta" value={readyForProposal} icon={<Gauge size={14} />} />
              <KpiCard label="Propostas Publicadas" value={published} icon={<FileStack size={14} />} />
              <KpiCard label="Total de Solicitações" value={rows.length} icon={<ClipboardList size={14} />} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
