import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, FormField, Spinner } from '../components/ui'
import { useCreateProposalRequest } from '../hooks/queries'
import { extractApiError } from '../lib/api'

export default function NewProposalRequestPage() {
  const navigate = useNavigate()
  const createProposalRequest = useCreateProposalRequest()
  const [apiError, setApiError] = useState('')
  const [form, setForm] = useState({
    title: '',
    customerName: '',
    technology: 'STARLINK',
    solutionType: 'internet_principal',
    urgency: 'NORMAL',
    region: '',
  })

  const handleSubmit = async () => {
    setApiError('')
    try {
      const created = await createProposalRequest.mutateAsync(form)
      navigate(`/proposals/requests/${created.id}`)
    } catch (error) {
      setApiError(extractApiError(error))
    }
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="font-semibold text-surface-900">Nova Solicitação de Proposta</h1>
          <p className="text-xs text-surface-400">Etapa inicial do fluxo Comercial → Pré-vendas</p>
        </div>
      </div>

      <div className="page-body">
        <div className="card max-w-2xl">
          <div className="card-body space-y-3">
            {apiError && <Alert type="error" message={apiError} />}

            <FormField label="Nome interno da solicitação" required>
              <input className="form-input" value={form.title} onChange={(e) => setForm((v) => ({ ...v, title: e.target.value }))} />
            </FormField>

            <FormField label="Cliente / Prospect" required>
              <input className="form-input" value={form.customerName} onChange={(e) => setForm((v) => ({ ...v, customerName: e.target.value }))} />
            </FormField>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <FormField label="Tecnologia">
                <select className="form-input appearance-none" value={form.technology} onChange={(e) => setForm((v) => ({ ...v, technology: e.target.value }))}>
                  <option value="STARLINK">Starlink</option>
                </select>
              </FormField>
              <FormField label="Tipo de solução">
                <select className="form-input appearance-none" value={form.solutionType} onChange={(e) => setForm((v) => ({ ...v, solutionType: e.target.value }))}>
                  <option value="internet_principal">Internet principal</option>
                  <option value="backup">Backup</option>
                  <option value="contingencia">Contingência</option>
                  <option value="temporario">Temporário</option>
                  <option value="mobilidade">Mobilidade</option>
                  <option value="projeto_hibrido">Projeto híbrido</option>
                </select>
              </FormField>
              <FormField label="Urgência">
                <select className="form-input appearance-none" value={form.urgency} onChange={(e) => setForm((v) => ({ ...v, urgency: e.target.value }))}>
                  <option value="LOW">Baixa</option>
                  <option value="NORMAL">Normal</option>
                  <option value="URGENT">Urgente</option>
                  <option value="EMERGENCY">Emergencial</option>
                </select>
              </FormField>
            </div>

            <FormField label="Região">
              <input className="form-input" value={form.region} onChange={(e) => setForm((v) => ({ ...v, region: e.target.value }))} />
            </FormField>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button className="btn-secondary" onClick={() => navigate('/proposals/requests')}>Cancelar</button>
              <button className="btn-primary" onClick={handleSubmit} disabled={createProposalRequest.isPending}>
                {createProposalRequest.isPending ? <Spinner size="sm" /> : null}
                Criar solicitação
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
