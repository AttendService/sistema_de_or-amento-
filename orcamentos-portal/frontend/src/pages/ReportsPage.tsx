// ============================================================
// Relatórios — exportações e resumos analíticos
// ============================================================
import React, { useState } from 'react'
import { Download, Filter, BarChart2, FileText, DollarSign } from 'lucide-react'
import { useRequests, useClients, useServiceTypes } from '../hooks/queries'
import { PageLoader, FormField, Alert } from '../components/ui'
import { formatCurrency, formatDateTime, REQUEST_STATUS_LABEL, type RequestStatus } from '../lib/constants'
import { api, extractApiError } from '../lib/api'

export default function ReportsPage() {
  const [filters, setFilters] = useState({
    from:          '',
    to:            '',
    clientId:      '',
    status:        '',
    serviceTypeId: '',
  })
  const [exporting, setExporting] = useState(false)
  const [apiError,  setApiError]  = useState('')

  const { data: clientsData  } = useClients({ limit: 100 })
  const { data: serviceTypes } = useServiceTypes()
  const clients = clientsData?.data ?? []

  // Preview dos dados (primeiros 50)
  const { data: reqData, isLoading } = useRequests({
    limit:  50,
    page:   1,
    from:   filters.from   || undefined,
    to:     filters.to     || undefined,
    clientId:      filters.clientId      || undefined,
    status:        filters.status        || undefined,
    serviceTypeId: filters.serviceTypeId || undefined,
  })

  const requests   = reqData?.data      ?? []
  const total      = reqData?.meta?.total ?? 0

  // ── Exportar CSV ─────────────────────────────────────────
  const handleExportCSV = async () => {
    setApiError('')
    setExporting(true)
    try {
      // Busca todos os registros sem paginação
      const params = new URLSearchParams()
      params.set('limit', '10000')
      if (filters.from)          params.set('from',          filters.from)
      if (filters.to)            params.set('to',            filters.to)
      if (filters.clientId)      params.set('clientId',      filters.clientId)
      if (filters.status)        params.set('status',        filters.status)
      if (filters.serviceTypeId) params.set('serviceTypeId', filters.serviceTypeId)

      const res = await api.get(`/api/v1/requests?${params.toString()}`)
      const data = res.data.data ?? []

      const rows = [
        // Cabeçalho
        ['Número','Data','Solicitante','Email','Cliente','Cliente Final','Tipos de Serviço',
         'Urgente','Status','Data Prevista','Data Estimada','Analista',
         'Valor Orçamento','Status Orçamento'].join(';'),
        // Dados
        ...data.map((r: any) => {
          const quote = r.quotes?.[0]
          const types = r.serviceTypes?.map((st: any) => st.serviceType.name).join(' | ') ?? ''
          return [
            r.requestNumber,
            formatDateTime(r.createdAt),
            r.requesterName,
            r.requesterEmail,
            r.client?.name ?? '',
            r.finalClientName,
            types,
            r.isUrgent ? 'Sim' : 'Não',
            REQUEST_STATUS_LABEL[r.status as RequestStatus] ?? r.status,
            r.requestedDate ? r.requestedDate.split('T')[0] : '',
            r.estimatedDate ? r.estimatedDate.split('T')[0] : '',
            r.assignedToUser?.name ?? '',
            quote ? quote.totalValue : '',
            quote ? quote.status : '',
          ].map((v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')
        }),
      ].join('\n')

      // Download
      const blob = new Blob(['\uFEFF' + rows], { type: 'text/csv;charset=utf-8;' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `relatorio-orcamentos-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setApiError(extractApiError(err))
    } finally {
      setExporting(false)
    }
  }

  // ── Métricas do preview ───────────────────────────────────
  const approved   = requests.filter((r: any) => r.status === 'APPROVED').length
  const totalValue = requests.reduce((acc: number, r: any) => {
    const q = r.quotes?.[0]
    return acc + (q?.totalValue ?? 0)
  }, 0)
  const approvedValue = requests
    .filter((r: any) => r.status === 'APPROVED')
    .reduce((acc: number, r: any) => acc + (r.quotes?.[0]?.totalValue ?? 0), 0)

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="font-semibold text-surface-900">Relatórios</h1>
        <button
          className="btn-primary btn-sm"
          onClick={handleExportCSV}
          disabled={exporting}
        >
          {exporting
            ? <><span className="spinner" /> Exportando...</>
            : <><Download size={14} /> Exportar CSV</>
          }
        </button>
      </div>

      <div className="page-body space-y-5">
        {apiError && <Alert type="error" message={apiError} />}

        {/* Filtros */}
        <div className="card">
          <div className="card-header">
            <span className="text-sm font-semibold flex items-center gap-2">
              <Filter size={14} className="text-surface-400" /> Filtros
            </span>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <FormField label="Data início">
                <input type="date" value={filters.from}
                  onChange={e => setFilters(v => ({ ...v, from: e.target.value }))}
                  className="form-input" />
              </FormField>
              <FormField label="Data fim">
                <input type="date" value={filters.to}
                  onChange={e => setFilters(v => ({ ...v, to: e.target.value }))}
                  className="form-input" />
              </FormField>
              <FormField label="Cliente">
                <select value={filters.clientId}
                  onChange={e => setFilters(v => ({ ...v, clientId: e.target.value }))}
                  className="form-input appearance-none">
                  <option value="">Todos</option>
                  {clients.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Status">
                <select value={filters.status}
                  onChange={e => setFilters(v => ({ ...v, status: e.target.value }))}
                  className="form-input appearance-none">
                  <option value="">Todos</option>
                  {Object.entries(REQUEST_STATUS_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Tipo de serviço">
                <select value={filters.serviceTypeId}
                  onChange={e => setFilters(v => ({ ...v, serviceTypeId: e.target.value }))}
                  className="form-input appearance-none">
                  <option value="">Todos</option>
                  {(serviceTypes as any[] ?? []).map((st: any) => (
                    <option key={st.id} value={st.id}>{st.name}</option>
                  ))}
                </select>
              </FormField>
            </div>
            <div className="flex justify-end mt-3">
              <button className="btn-ghost btn-sm"
                onClick={() => setFilters({ from:'', to:'', clientId:'', status:'', serviceTypeId:'' })}>
                Limpar filtros
              </button>
            </div>
          </div>
        </div>

        {/* Métricas resumidas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="kpi-card">
            <div className="flex items-start justify-between">
              <p className="kpi-label">Total encontrado</p>
              <FileText size={16} className="text-brand-400 opacity-60" />
            </div>
            <p className="kpi-value">{total.toLocaleString('pt-BR')}</p>
          </div>
          <div className="kpi-card">
            <div className="flex items-start justify-between">
              <p className="kpi-label">Aprovados (amostra)</p>
              <BarChart2 size={16} className="text-emerald-400 opacity-60" />
            </div>
            <p className="kpi-value text-emerald-600">{approved}</p>
          </div>
          <div className="kpi-card">
            <div className="flex items-start justify-between">
              <p className="kpi-label">Valor orçado (amostra)</p>
              <DollarSign size={16} className="text-brand-400 opacity-60" />
            </div>
            <p className="kpi-value text-sm">{formatCurrency(totalValue)}</p>
          </div>
          <div className="kpi-card">
            <div className="flex items-start justify-between">
              <p className="kpi-label">Valor aprovado (amostra)</p>
              <DollarSign size={16} className="text-emerald-400 opacity-60" />
            </div>
            <p className="kpi-value text-sm text-emerald-600">{formatCurrency(approvedValue)}</p>
          </div>
        </div>

        {/* Preview da tabela */}
        <div className="card overflow-hidden">
          <div className="card-header">
            <span className="text-sm font-semibold">
              Preview — primeiros 50 registros
              {total > 50 && <span className="text-surface-400 font-normal"> (de {total.toLocaleString('pt-BR')} total)</span>}
            </span>
            <span className="text-xs text-surface-400">Use "Exportar CSV" para baixar todos</span>
          </div>
          {isLoading ? <PageLoader /> : requests.length === 0
            ? <div className="card-body"><p className="text-sm text-surface-400 text-center py-6">Nenhum registro encontrado para os filtros aplicados</p></div>
            : (
              <div className="overflow-x-auto">
                <table className="data-table text-xs">
                  <thead>
                    <tr>
                      <th>Número</th>
                      <th>Data</th>
                      <th>Cliente</th>
                      <th>Cliente final</th>
                      <th>Status</th>
                      <th>Urgente</th>
                      <th>Analista</th>
                      <th className="text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((r: any) => {
                      const quote = r.quotes?.[0]
                      return (
                        <tr key={r.id}>
                          <td className="font-mono text-brand-600">{r.requestNumber}</td>
                          <td className="text-surface-500">{formatDateTime(r.createdAt)}</td>
                          <td>{r.client?.name ?? '—'}</td>
                          <td>{r.finalClientName}</td>
                          <td>
                            <span className="text-xs">
                              {REQUEST_STATUS_LABEL[r.status as RequestStatus] ?? r.status}
                            </span>
                          </td>
                          <td className="text-center">{r.isUrgent ? '⚡' : ''}</td>
                          <td>{r.assignedToUser?.name ?? '—'}</td>
                          <td className="text-right font-medium">
                            {quote?.totalValue ? formatCurrency(quote.totalValue) : '—'}
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
      </div>
    </div>
  )
}
