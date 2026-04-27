// ============================================================
// Dashboard — cliente e operacional (analista/admin)
// ============================================================
import React from 'react'
import {
  FileText, CheckCircle, XCircle, Clock, Zap,
  TrendingUp, Users, DollarSign, BarChart2,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { useRole } from '../store/auth.store'
import {
  useDashboardClient, useDashboardOperational, useQueueStats,
} from '../hooks/queries'
import { KpiCard, PageLoader, RequestStatusBadge } from '../components/ui'
import { formatCurrency, REQUEST_STATUS_LABEL, REQUEST_STATUS_COLOR } from '../lib/constants'

const STATUS_COLORS = ['#4B5FFF','#F59E0B','#8B5CF6','#06B6D4','#10B981','#EF4444','#F97316','#94A3B8']

export default function DashboardPage() {
  const role = useRole()
  // Aguarda role ser definido antes de renderizar
  if (!role) return null
  return role === 'CLIENT' ? <ClientDashboard /> : <OperationalDashboard />
}

// ── Dashboard do Cliente ──────────────────────────────────
function ClientDashboard() {
  const { data, isLoading } = useDashboardClient()
  const summary = data?.summary ?? {}
  const byMonth = (data?.byMonth ?? []).reverse()
  const byServiceType = data?.byServiceType ?? []

  const pieData = Object.entries(summary.byStatus ?? {}).map(([status, count]) => ({
    name:  REQUEST_STATUS_LABEL[status as keyof typeof REQUEST_STATUS_LABEL] ?? status,
    value: count as number,
  }))

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="font-semibold text-surface-900">Dashboard</h1>
      </div>
      <div className="page-body space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Total"    value={summary.total ?? 0}   icon={<FileText size={18}  />} loading={isLoading} />
          <KpiCard label="Aprovados" value={summary.byStatus?.APPROVED ?? 0} icon={<CheckCircle size={18} />} color="text-emerald-500" loading={isLoading} />
          <KpiCard label="Em espera" value={summary.byStatus?.ON_HOLD  ?? 0} icon={<Clock size={18} />}       color="text-orange-500"  loading={isLoading} />
          <KpiCard label="Urgentes"  value={summary.urgent ?? 0}               icon={<Zap size={18} />}         color="text-amber-500"   loading={isLoading} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Status Pie */}
          <div className="card">
            <div className="card-header"><span className="text-sm font-semibold">Por status</span></div>
            <div className="card-body">
              {isLoading ? <PageLoader /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {pieData.map((_, i) => <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />)}
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Por mês */}
          <div className="card">
            <div className="card-header"><span className="text-sm font-semibold">Solicitações por mês</span></div>
            <div className="card-body">
              {isLoading ? <PageLoader /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={byMonth}>
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#4B5FFF" radius={[4,4,0,0]} name="Solicitações" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Por tipo de serviço */}
        {byServiceType.length > 0 && (
          <div className="card">
            <div className="card-header"><span className="text-sm font-semibold">Por tipo de serviço</span></div>
            <div className="card-body">
              <div className="space-y-2">
                {byServiceType.map((st: any) => (
                  <div key={st.serviceTypeId} className="flex items-center gap-3">
                    <span className="text-sm text-surface-600 w-40 truncate">{st.serviceTypeName}</span>
                    <div className="flex-1 bg-surface-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (st.count / (summary.total || 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-surface-700 w-8 text-right">{st.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Dashboard Operacional ─────────────────────────────────
function OperationalDashboard() {
  const { data, isLoading } = useDashboardOperational()
  const { data: queueData } = useQueueStats()

  const summary    = data?.summary ?? {}
  const quotes     = data?.quotes  ?? {}
  const byAnalyst  = data?.byAnalyst ?? []
  const byClient   = data?.byClient  ?? []
  const byMonth    = (data?.byMonth  ?? []).reverse()

  const pieData = Object.entries(summary.byStatus ?? {}).map(([status, count]) => ({
    name:  REQUEST_STATUS_LABEL[status as keyof typeof REQUEST_STATUS_LABEL] ?? status,
    value: count as number,
  }))

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="font-semibold text-surface-900">Dashboard Operacional</h1>
        <span className="text-xs text-surface-400">Atualiza a cada 30s</span>
      </div>
      <div className="page-body space-y-6">
        {/* KPIs principais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Total recebidas" value={summary.total ?? 0}          icon={<FileText size={18}    />} loading={isLoading} />
          <KpiCard label="Urgentes"        value={summary.urgent ?? 0}         icon={<Zap size={18}         />} color="text-amber-500"   loading={isLoading} />
          <KpiCard label="Valor orçado"    value={formatCurrency(quotes.totalValue    ?? 0)} icon={<DollarSign size={18} />} loading={isLoading} />
          <KpiCard label="Valor aprovado"  value={formatCurrency(quotes.approvedValue ?? 0)} icon={<TrendingUp size={18} />} color="text-emerald-500" loading={isLoading} />
        </div>

        {/* KPIs de orçamentos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Orçamentos"  value={quotes.total    ?? 0} icon={<BarChart2 size={18}   />} loading={isLoading} />
          <KpiCard label="Aprovados"   value={quotes.approved ?? 0} icon={<CheckCircle size={18} />} color="text-emerald-500" loading={isLoading} />
          <KpiCard label="Reprovados"  value={summary.byStatus?.REJECTED  ?? 0} icon={<XCircle size={18} />} color="text-red-500" loading={isLoading} />
          <KpiCard label="Em espera"   value={summary.byStatus?.ON_HOLD   ?? 0} icon={<Clock size={18}   />} color="text-orange-500" loading={isLoading} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Status */}
          <div className="card">
            <div className="card-header"><span className="text-sm font-semibold">Por status</span></div>
            <div className="card-body">
              {isLoading ? <PageLoader /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {pieData.map((_, i) => <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />)}
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Por mês */}
          <div className="card">
            <div className="card-header"><span className="text-sm font-semibold">Solicitações por mês</span></div>
            <div className="card-body">
              {isLoading ? <PageLoader /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={byMonth}>
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#4B5FFF" radius={[4,4,0,0]} name="Solicitações" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Por analista e por cliente */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card">
            <div className="card-header">
              <span className="text-sm font-semibold">Por analista</span>
            </div>
            <div className="card-body">
              {isLoading ? <PageLoader /> : byAnalyst.length === 0
                ? <p className="text-sm text-surface-400 text-center py-6">Sem dados</p>
                : (
                  <div className="space-y-2">
                    {byAnalyst.map((a: any) => (
                      <div key={a.analystId} className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-xs font-semibold text-brand-600">
                          {a.analystName?.charAt(0)}
                        </div>
                        <span className="text-sm text-surface-700 flex-1">{a.analystName}</span>
                        <span className="text-sm font-semibold text-surface-900">{a.count}</span>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="text-sm font-semibold">Top clientes</span>
            </div>
            <div className="card-body">
              {isLoading ? <PageLoader /> : byClient.length === 0
                ? <p className="text-sm text-surface-400 text-center py-6">Sem dados</p>
                : (
                  <div className="space-y-2">
                    {byClient.slice(0, 8).map((c: any) => (
                      <div key={c.clientId} className="flex items-center gap-3">
                        <span className="text-sm text-surface-700 flex-1 truncate">{c.clientName}</span>
                        <div className="flex-none w-24 bg-surface-100 rounded-full h-1.5">
                          <div
                            className="h-full bg-brand-400 rounded-full"
                            style={{ width: `${Math.min(100, (c.count / (byClient[0]?.count || 1)) * 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-surface-900 w-6 text-right">{c.count}</span>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
