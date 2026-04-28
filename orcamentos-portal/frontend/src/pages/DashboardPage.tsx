// ============================================================
// Dashboard — Portal de Orçamentos v3
// ============================================================
import React, { useState, useMemo } from 'react'
import {
  FileText, Zap, TrendingUp, DollarSign, BarChart2, Receipt,
  CheckCircle, Clock, ChevronRight, ArrowRight,
  AlertTriangle, Activity, Package, Percent,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area, CartesianGrid,
} from 'recharts'
import { useNavigate } from 'react-router-dom'
import { useRole } from '../store/auth.store'
import {
  useDashboardClient, useDashboardOperational, useRequests,
} from '../hooks/queries'
import { KpiCard, PageLoader, RequestStatusBadge } from '../components/ui'
import { formatCurrency, REQUEST_STATUS_LABEL } from '../lib/constants'

// ── Paleta e constantes ──────────────────────────────────────
const PALETTE = ['#4B5FFF','#10B981','#F59E0B','#8B5CF6','#06B6D4','#EF4444','#F97316','#94A3B8']

const TT = {
  borderRadius: '10px', border: 'none',
  boxShadow: '0 8px 24px rgb(0 0 0/.10)',
  fontSize: 12, padding: '8px 12px',
}

const STATUS_CFG: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  REQUESTED:         { label: 'Solicitado',         bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    dot: '#3B82F6' },
  IN_ANALYSIS:       { label: 'Em análise',          bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200',  dot: '#6366F1' },
  QUOTE_IN_PROGRESS: { label: 'Orç. em elaboração', bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200',  dot: '#8B5CF6' },
  QUOTE_SENT:        { label: 'Orçamento enviado',   bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-200',    dot: '#06B6D4' },
  APPROVED:          { label: 'Aprovado',             bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: '#10B981' },
  REJECTED:          { label: 'Reprovado',            bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     dot: '#EF4444' },
  ON_HOLD:           { label: 'Em espera',            bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: '#F59E0B' },
  CANCELLED:         { label: 'Cancelado',            bg: 'bg-surface-50', text: 'text-surface-500', border: 'border-surface-200', dot: '#94A3B8' },
}

const PERIODS = [
  { label: '7 dias',  value: '7d',  days: 7   },
  { label: '30 dias', value: '30d', days: 30  },
  { label: '90 dias', value: '90d', days: 90  },
  { label: '1 ano',   value: '1y',  days: 365 },
]

// ── Helpers ──────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtMonth = (m: any): string => {
  const ns = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const [, mm] = (String(m ?? '')).split('-')
  return ns[parseInt(mm) - 1] ?? String(m)
}

const fmtSLA = (h?: number) => {
  if (!h || isNaN(h) || h <= 0) return '—'
  return h >= 24 ? `${(h / 24).toFixed(1)}d` : `${h.toFixed(1)}h`
}

const initials = (name: string) =>
  (name ?? '').split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

// ── Componentes compartilhados ───────────────────────────────
function Clickable({ to, children, className = '' }: { to: string; children: React.ReactNode; className?: string }) {
  const navigate = useNavigate()
  return (
    <div onClick={() => navigate(to)}
      className={`cursor-pointer transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 ${className}`}>
      {children}
    </div>
  )
}

function AccentKpi({ to, label, value, icon, color, accent, loading, delta }: {
  to: string; label: string; value: string | number; icon: React.ReactNode
  color?: string; accent: string; loading?: boolean
  delta?: { value: string | number; isPositive: boolean }
}) {
  return (
    <div className="overflow-hidden rounded-xl" style={{ borderLeft: `3px solid ${accent}`, boxShadow: '0 1px 4px rgb(0 0 0/.06)' }}>
      <Clickable to={to}>
        <KpiCard label={label} value={value} icon={icon} color={color} loading={loading} delta={delta} />
      </Clickable>
    </div>
  )
}

function SectionTitle({ title, sub, to, toLabel }: { title: string; sub?: string; to?: string; toLabel?: string }) {
  const navigate = useNavigate()
  return (
    <div className="flex items-end justify-between mb-3">
      <div>
        <h2 className="text-sm font-semibold text-surface-900">{title}</h2>
        {sub && <p className="text-xs text-surface-400 mt-0.5">{sub}</p>}
      </div>
      {to && (
        <button onClick={() => navigate(to)}
          className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
          {toLabel} <ChevronRight size={11} />
        </button>
      )}
    </div>
  )
}

function PeriodBar({ v, set }: { v: string; set: (x: string) => void }) {
  return (
    <div className="flex items-center gap-1 bg-surface-100 p-1 rounded-lg">
      {PERIODS.map(p => (
        <button key={p.value} onClick={() => set(p.value)}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all
            ${v === p.value ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'}`}>
          {p.label}
        </button>
      ))}
    </div>
  )
}

function CardHead({ title, sub, to, badge }: { title: string; sub?: string; to?: string; badge?: string }) {
  const navigate = useNavigate()
  return (
    <div className="card-header">
      <div>
        <p className="text-xs font-bold text-surface-900">{title}</p>
        {sub && <p className="text-xs text-surface-400 mt-0.5">{sub}</p>}
      </div>
      {badge && <span className="text-xs font-bold text-brand-600">{badge}</span>}
      {to && !badge && (
        <button onClick={() => navigate(to)}
          className="flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:underline">
          Ver <ChevronRight size={11} />
        </button>
      )}
    </div>
  )
}

// ── Root ─────────────────────────────────────────────────────
export default function DashboardPage() {
  const role = useRole()
  if (!role) return null
  return role === 'CLIENT' ? <ClientDashboard /> : <OperationalDashboard />
}

// ─────────────────────────────────────────────────────────────
// Dashboard do Cliente
// ─────────────────────────────────────────────────────────────
function ClientDashboard() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState('30d')
  const days = PERIODS.find(p => p.value === period)?.days ?? 30
  const to   = useMemo(() => new Date().toISOString().split('T')[0], [])
  const from = useMemo(() =>
    new Date(Date.now() - days * 86400000).toISOString().split('T')[0], [days])

  const { data, isLoading } = useDashboardClient({ from, to })
  const { data: recentData } = useRequests({ page: 1, limit: 8 })
  const recentRequests = recentData?.data ?? []

  const summary       = data?.summary      ?? {}
  const quotes        = data?.quotes       ?? {}
  const byMonth       = useMemo(() => [...(data?.byMonth ?? [])].reverse(), [data])
  const byServiceType = data?.byServiceType ?? []
  const statusEntries = Object.entries(summary.byStatus ?? {}) as [string, number][]
  const pending = (summary.byStatus?.REQUESTED ?? 0)
    + (summary.byStatus?.IN_ANALYSIS ?? 0)
    + (summary.byStatus?.QUOTE_IN_PROGRESS ?? 0)

  const slaData = useMemo(() => {
    return recentRequests
      .filter((r: any) => r.quotes?.[0]?.sentAt || r.quotes?.[0]?.createdAt)
      .map((r: any) => {
        const quote = r.quotes[0]
        const end = new Date(quote.sentAt || quote.createdAt).getTime()
        const start = new Date(r.createdAt).getTime()
        const hours = (end - start) / (1000 * 60 * 60)
        return {
          name: r.requestNumber,
          SLA: Number(hours.toFixed(1))
        }
      }).reverse()
  }, [recentRequests])

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="font-semibold text-surface-900">Painel do Cliente</h1>
          <p className="text-xs text-surface-400">Suas solicitações e orçamentos</p>
        </div>
        <div className="flex items-center gap-3">
          <PeriodBar v={period} set={setPeriod} />
          <button className="btn-primary btn-sm" onClick={() => navigate('/requests/new')}>
            + Nova solicitação
          </button>
        </div>
      </div>

      <div className="page-body space-y-5">

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <AccentKpi to="/requests" label="Total de Solicitações" value={summary.total ?? 0}
            icon={<FileText size={14} />} accent="#4B5FFF" loading={isLoading} />
          <AccentKpi to="/requests?status=REQUESTED,IN_ANALYSIS,QUOTE_IN_PROGRESS" label="Em Andamento"
            value={pending} icon={<Activity size={14} />} color="text-indigo-500" accent="#6366F1" loading={isLoading} />
          <AccentKpi to="/quotes" label="Orçamentos Pendentes" value={quotes.pipelineCount ?? 0}
            icon={<Receipt size={14} />} color="text-brand-500" accent="#8B5CF6" loading={isLoading} />
          <AccentKpi to="/requests?urgent=true" label="Urgentes" value={summary.urgent ?? 0}
            icon={<Zap size={14} />} color="text-amber-500" accent="#F59E0B" loading={isLoading} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <AccentKpi to="/quotes" label="Valor em Negociação" value={formatCurrency(quotes.pipelineValue ?? 0)}
            icon={<DollarSign size={14} />} color="text-brand-500" accent="#4B5FFF" loading={isLoading} />
          <AccentKpi to="/quotes" label="Valor Aprovado" value={formatCurrency(quotes.approvedValue ?? 0)}
            icon={<CheckCircle size={14} />} color="text-emerald-500" accent="#10B981" loading={isLoading} />
          <AccentKpi to="/requests?status=APPROVED" label="Orçamentos Aprovados" value={quotes.approved ?? 0}
            icon={<TrendingUp size={14} />} color="text-emerald-500" accent="#10B981" loading={isLoading} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 card">
            <CardHead title="Volume Mensal de Solicitações" sub="Entradas por mês" to="/requests" />
            <div className="card-body">
              {isLoading ? <PageLoader /> : (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={byMonth}>
                    <defs>
                      <linearGradient id="cliCnt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#4B5FFF" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#4B5FFF" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f9" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={fmtMonth} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TT} labelFormatter={fmtMonth} />
                    <Area type="monotone" dataKey="count" stroke="#4B5FFF" strokeWidth={2.5}
                      fill="url(#cliCnt)" name="Solicitações"
                      dot={{ r: 3, fill: '#4B5FFF', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="lg:col-span-4 card">
            <CardHead title="Status das Solicitações" to="/requests" />
            <div className="card-body space-y-2">
              {isLoading ? <PageLoader /> : statusEntries.map(([st, count]) => {
                const cfg = STATUS_CFG[st]
                const pct = Math.round((count / (summary.total || 1)) * 100)
                return (
                  <div key={st}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer hover:shadow-sm transition-all ${cfg?.bg} ${cfg?.border}`}
                    onClick={() => navigate(`/requests?status=${st}`)}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cfg?.dot }} />
                    <span className={`text-xs font-medium flex-1 truncate ${cfg?.text}`}>{cfg?.label ?? st}</span>
                    <span className={`text-xs font-bold ${cfg?.text}`}>{count}</span>
                    <span className="text-[10px] text-surface-400">{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Gráfico SLA por Orçamento */}
          <div className="card">
            <CardHead title="Tempo de Resposta (SLA)" sub="Horas gastas para enviar cada orçamento recente" />
            <div className="card-body p-4">
              {isLoading ? <PageLoader /> : slaData.length === 0 ? <p className="text-xs text-center text-surface-400 py-10">Ainda não há orçamentos respondidos recentemente.</p> : (
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={slaData} barSize={24}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TT} formatter={(val) => [`${val}h`, 'Tempo Resp.']} />
                    <Bar dataKey="SLA" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="SLA (horas)" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="card">
            <CardHead title="Demandas por Tipo de Serviço" sub="Categorias mais solicitadas" />
          <div className="card-body">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {byServiceType.slice(0, 6).map((st: any, i: number) => (
                <div key={st.serviceTypeId}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-50 cursor-pointer transition-all"
                  onClick={() => navigate('/requests')}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ backgroundColor: PALETTE[i % PALETTE.length] }}>
                    {st.count}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-700 truncate">{st.serviceTypeName}</p>
                    <div className="h-1.5 bg-surface-100 rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, (st.count / (summary.total || 1)) * 100)}%`, backgroundColor: PALETTE[i % PALETTE.length] }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        </div>

        {/* ── Recentes ────────────────────────────────── */}
        <div>
          <SectionTitle title="Solicitações Recentes" to="/requests" toLabel="Ver todas" />
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="pl-5">Número</th>
                    <th>Cliente Final</th>
                    <th>Tipo de Serviço</th>
                    <th>Tempo Resp.</th>
                    <th>Status</th>
                    <th className="pr-5 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {recentRequests.map((r: any) => {
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
                        <td className="pl-5">
                          <span className="font-mono text-xs font-bold text-brand-600">{r.requestNumber}</span>
                          {r.isUrgent && <div className="text-[10px] text-amber-600 font-semibold">⚡ Urgente</div>}
                        </td>
                        <td className="text-sm text-surface-600 max-w-[160px] truncate">{r.finalClientName}</td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {r.serviceTypes?.slice(0, 2).map((st: any) => (
                              <span key={st.serviceTypeId}
                                className="text-[11px] bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded font-medium">
                                {st.serviceType.name}
                              </span>
                            ))}
                            {r.serviceTypes?.length > 2 && (
                              <span className="text-[11px] text-surface-400">+{r.serviceTypes.length - 2}</span>
                            )}
                          </div>
                        </td>
                        <td className="text-sm font-semibold text-surface-600">{slaStr}</td>
                        <td><RequestStatusBadge status={r.status} /></td>
                        <td className="pr-5 text-right" onClick={e => e.stopPropagation()}>
                          <button className="flex items-center gap-1 text-xs text-brand-600 font-semibold hover:underline ml-auto"
                            onClick={() => navigate(`/requests/${r.id}`)}>
                            Abrir <ArrowRight size={11} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Dashboard Operacional
// ─────────────────────────────────────────────────────────────
function OperationalDashboard() {
  const navigate  = useNavigate()
  const [period, setPeriod] = useState('30d')
  const days = PERIODS.find(p => p.value === period)?.days ?? 30
  const to   = useMemo(() => new Date().toISOString().split('T')[0], [])
  const from = useMemo(() =>
    new Date(Date.now() - days * 86400000).toISOString().split('T')[0], [days])

  const { data, isLoading } = useDashboardOperational({ from, to })
  const { data: recentData } = useRequests({ page: 1, limit: 8 })
  const recentRequests = recentData?.data ?? []

  const summary       = data?.summary       ?? {}
  const quotes        = data?.quotes        ?? {}
  const byAnalyst     = data?.byAnalyst     ?? []
  const byClient      = data?.byClient      ?? []
  const byServiceType = data?.byServiceType ?? []
  const byMonth       = useMemo(() => [...(data?.byMonth ?? [])].reverse(), [data])
  const trends        = data?.performanceTrends ?? {}

  const decisions     = (quotes.approved ?? 0) + (summary.byStatus?.REJECTED ?? 0)
  const winRate       = decisions > 0
    ? ((quotes.approved / decisions) * 100).toFixed(1) : '0'

  const statusEntries = Object.entries(summary.byStatus ?? {}) as [string, number][]

  const pending = (summary.byStatus?.REQUESTED ?? 0)
    + (summary.byStatus?.IN_ANALYSIS          ?? 0)
    + (summary.byStatus?.QUOTE_IN_PROGRESS    ?? 0)

  const funnelData = [
    { label: 'Recebidas',       value: summary.total ?? 0,                    path: '/requests',                                                  color: '#4B5FFF' },
    { label: 'Em Andamento',    value: pending,                               path: '/requests?status=REQUESTED,IN_ANALYSIS,QUOTE_IN_PROGRESS',   color: '#8B5CF6' },
    { label: 'Orç. Enviados',   value: summary.byStatus?.QUOTE_SENT ?? 0,    path: '/requests?status=QUOTE_SENT',                                color: '#06B6D4' },
    { label: 'Aprovadas',       value: quotes.approved ?? 0,                  path: '/requests?status=APPROVED',                                  color: '#10B981' },
    { label: 'Reprovadas',      value: summary.byStatus?.REJECTED ?? 0,      path: '/requests?status=REJECTED',                                  color: '#EF4444' },
  ]
  const fMax = funnelData[0].value || 1

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="font-semibold text-surface-900">Dashboard</h1>
          <p className="text-xs text-surface-400">Visão geral de solicitações e orçamentos</p>
        </div>
        <div className="flex items-center gap-3">
          <PeriodBar v={period} set={setPeriod} />
          <button className="btn-primary btn-sm" onClick={() => navigate('/requests/new')}>
            + Nova solicitação
          </button>
        </div>
      </div>

      <div className="page-body space-y-6">

        {/* ── Volume ──────────────────────────────────── */}
        <div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <AccentKpi to="/requests" label="Total Recebidas" value={summary.total ?? 0}
              icon={<FileText size={14} />} accent="#4B5FFF" loading={isLoading} />
            <AccentKpi to="/requests?status=REQUESTED,IN_ANALYSIS,QUOTE_IN_PROGRESS" label="Em Andamento"
              value={pending} icon={<Activity size={14} />} color="text-indigo-500" accent="#6366F1" loading={isLoading} />
            <AccentKpi to="/requests?status=QUOTE_SENT" label="Orç. Enviados" value={summary.byStatus?.QUOTE_SENT ?? 0}
              icon={<Receipt size={14} />} color="text-cyan-600" accent="#06B6D4" loading={isLoading} />
            <AccentKpi to="/requests?urgent=true" label="Urgentes" value={summary.urgent ?? 0}
              icon={<Zap size={14} />} color="text-amber-500" accent="#F59E0B" loading={isLoading} />
          </div>
        </div>

        {/* ── Financeiro ──────────────────────────────── */}
        <div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <AccentKpi to="/requests" label="Portfólio Total" value={formatCurrency(quotes.totalValue ?? 0)}
              icon={<Package size={14} />} accent="#4B5FFF" loading={isLoading} />
            <AccentKpi to="/requests?status=QUOTE_SENT" label="Pipeline Ativo" value={formatCurrency(quotes.pipelineValue ?? 0)}
              icon={<BarChart2 size={14} />} color="text-brand-500" accent="#8B5CF6" loading={isLoading} />
            <AccentKpi to="/requests?status=APPROVED" label="Valor Aprovado" value={formatCurrency(quotes.approvedValue ?? 0)}
              icon={<TrendingUp size={14} />} color="text-emerald-500" accent="#10B981" loading={isLoading} />
            <AccentKpi to="/requests" label="Descontos Concedidos" value={formatCurrency(quotes.totalDiscount ?? 0)}
              icon={<DollarSign size={14} />} color="text-red-500" accent="#EF4444" loading={isLoading} />
          </div>
        </div>

        {/* ── Performance ─────────────────────────────── */}
        <div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <AccentKpi to="/requests?status=APPROVED" label="Taxa de Conversão" value={`${winRate}%`}
              icon={<Percent size={14} />} color="text-emerald-500" accent="#10B981" loading={isLoading} />
            <AccentKpi to="/requests" label="SLA Médio de Resposta" value={fmtSLA(quotes.avgResponseHours)}
              icon={<Clock size={14} />} color="text-indigo-500" accent="#6366F1" loading={isLoading} />
            <AccentKpi to="/requests?status=APPROVED" label="Aprovações" value={quotes.approved ?? 0}
              icon={<CheckCircle size={14} />} color="text-emerald-500" accent="#10B981" loading={isLoading} />
            <AccentKpi to="/requests?status=REJECTED" label="Reprovações" value={summary.byStatus?.REJECTED ?? 0}
              icon={<AlertTriangle size={14} />} color="text-red-500" accent="#EF4444" loading={isLoading} />
          </div>
        </div>

        {/* ── Gráficos de Tendência ────────────────────── */}
        <div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            <div className="card">
              <CardHead title="Volume de Entradas" sub="Solicitações por mês" to="/requests" />
              <div className="card-body p-4">
                {isLoading ? <PageLoader /> : (
                  <ResponsiveContainer width="100%" height={210}>
                    <BarChart data={byMonth} barSize={12}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f9" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={fmtMonth} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={TT} labelFormatter={fmtMonth} />
                      <Bar dataKey="count" fill="#4B5FFF" radius={[4,4,0,0]} name="Solicitações"
                        onClick={() => navigate('/requests')} style={{ cursor: 'pointer' }} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="card">
              <CardHead title="Taxa de Conversão" sub="Aprovações vs decisões" badge={`${winRate}% atual`} />
              <div className="card-body p-4">
                {isLoading ? <PageLoader /> : (
                  <ResponsiveContainer width="100%" height={210}>
                    <AreaChart data={trends.winRateTrend ?? []}>
                      <defs>
                        <linearGradient id="gWin" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#10B981" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f9" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={fmtMonth} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                      <Tooltip contentStyle={TT} labelFormatter={fmtMonth} formatter={(v: any) => [`${Number(v).toFixed(1)}%`, 'Conversão']} />
                      <Area type="monotone" dataKey="rate" stroke="#10B981" strokeWidth={2.5} fill="url(#gWin)"
                        dot={{ r: 3, fill: '#10B981', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="card">
              <CardHead title="Evolução do SLA" sub="Horas médias de resposta" badge={`${fmtSLA(quotes.avgResponseHours)} atual`} />
              <div className="card-body p-4">
                {isLoading ? <PageLoader /> : (
                  <ResponsiveContainer width="100%" height={210}>
                    <AreaChart data={trends.slaTrend ?? []}>
                      <defs>
                        <linearGradient id="gSLA" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#8B5CF6" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f9" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={fmtMonth} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={TT} labelFormatter={fmtMonth} formatter={(v: any) => [`${Number(v).toFixed(1)}h`, 'SLA']} />
                      <Area type="monotone" dataKey="hours" stroke="#8B5CF6" strokeWidth={2.5} fill="url(#gSLA)"
                        dot={{ r: 3, fill: '#8B5CF6', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Funil + Status ───────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          <div className="card">
            <CardHead title="Funil de Solicitações" sub="Da entrada à aprovação" />
            <div className="card-body space-y-3">
              {funnelData.map(item => {
                const barPct = Math.max(8, Math.round((item.value / fMax) * 100))
                const dispPct = Math.round((item.value / fMax) * 100)
                return (
                  <div key={item.label} className="group cursor-pointer hover:opacity-90"
                    onClick={() => navigate(item.path)}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-medium text-surface-600 group-hover:text-surface-900 transition-colors">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-surface-400">{dispPct}%</span>
                        <span className="text-sm font-bold text-surface-900 w-8 text-right">{item.value}</span>
                      </div>
                    </div>
                    <div className="h-7 bg-surface-50 rounded-lg overflow-hidden">
                      <div className="h-full rounded-lg flex items-center justify-end pr-2 transition-all duration-700 text-white text-[10px] font-bold"
                        style={{ width: `${barPct}%`, backgroundColor: item.color }}>
                        {item.value > 0 ? item.value : ''}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card">
            <CardHead title="Distribuição por Status" sub={`${summary.total ?? 0} solicitações`} to="/requests" />
            <div className="card-body space-y-2">
              {statusEntries.map(([st, count]) => {
                const cfg = STATUS_CFG[st]
                const pct = Math.round((count / (summary.total || 1)) * 100)
                return (
                  <div key={st}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer hover:shadow-sm transition-all ${cfg?.bg ?? 'bg-surface-50'} ${cfg?.border ?? 'border-surface-200'}`}
                    onClick={() => navigate(`/requests?status=${st}`)}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cfg?.dot ?? '#94A3B8' }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between mb-1">
                        <span className={`text-xs font-medium ${cfg?.text ?? 'text-surface-700'}`}>{cfg?.label ?? st}</span>
                        <span className={`text-xs font-bold ${cfg?.text ?? 'text-surface-700'}`}>
                          {count} <span className="font-normal opacity-60">({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-1 bg-white/60 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, backgroundColor: cfg?.dot ?? '#94A3B8' }} />
                      </div>
                    </div>
                    <ChevronRight size={12} className="text-surface-300 flex-shrink-0" />
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Analistas + Clientes + Tipos ─────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* Analistas */}
          <div className="lg:col-span-7 card overflow-hidden">
            <CardHead title="Performance por Analista" sub={`${byAnalyst.length} analistas com demandas no período`} />
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="pl-5">Analista</th>
                    <th className="text-center">Demandas</th>
                    <th className="text-center">SLA Médio</th>
                    <th className="pr-5 text-right">Carga</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? <tr><td colSpan={4} className="py-8 text-center text-surface-400 text-sm">Carregando...</td></tr>
                    : byAnalyst.length === 0
                    ? <tr><td colSpan={4} className="py-8 text-center text-surface-400 text-sm">Sem dados no período selecionado</td></tr>
                    : byAnalyst.map((a: any) => {
                        const maxR = Math.max(...byAnalyst.map((x: any) => x.count), 1)
                        const load = Math.round((a.count / maxR) * 100)
                        const slaOk = !a.avgResponseHours || a.avgResponseHours <= 4
                        const loadColor = load > 80 ? 'bg-red-400' : load > 50 ? 'bg-amber-400' : 'bg-emerald-500'
                        return (
                          <tr key={a.analystId} className="cursor-pointer" onClick={() => navigate('/requests')}>
                            <td className="pl-5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full premium-gradient flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0">
                                  {initials(a.analystName)}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-surface-800 leading-tight">{a.analystName}</p>
                                  <p className={`text-[10px] font-semibold ${slaOk ? 'text-emerald-500' : 'text-red-500'}`}>
                                    {slaOk ? '● Dentro do SLA' : '● SLA excedido'}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="text-center font-bold text-surface-900">{a.count}</td>
                            <td className="text-center">
                              <span className={`px-2 py-1 rounded-md text-xs font-bold ${slaOk ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                {fmtSLA(a.avgResponseHours)}
                              </span>
                            </td>
                            <td className="pr-5">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-20 h-2 bg-surface-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full transition-all ${loadColor}`} style={{ width: `${load}%` }} />
                                </div>
                                <span className="text-xs font-bold text-surface-400 w-8 text-right">{load}%</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                  }
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: Clientes + Tipos */}
          <div className="lg:col-span-5 space-y-4">

            <div className="card">
              <CardHead title="Top Clientes" sub="Por volume de demandas" to="/clients" />
              <div className="card-body space-y-3">
                {byClient.slice(0, 5).map((c: any, i: number) => (
                  <div key={c.clientId}
                    className="flex items-center gap-3 cursor-pointer hover:opacity-80 group"
                    onClick={() => navigate('/requests')}>
                    <span className="text-xs font-bold text-surface-200 w-4 flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-surface-700 truncate group-hover:text-surface-900">{c.clientName}</span>
                        <span className="font-bold text-surface-900 ml-2 flex-shrink-0">{c.count}</span>
                      </div>
                      <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${(c.count / (byClient[0]?.count || 1)) * 100}%`, backgroundColor: PALETTE[i % PALETTE.length] }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <CardHead title="Demandas por Tipo de Serviço" sub={`${byServiceType.length} categorias`} />
              <div className="card-body p-3">
                <ResponsiveContainer width="100%" height={185}>
                  <PieChart>
                    <Pie data={byServiceType.slice(0, 6)} dataKey="count" nameKey="serviceTypeName"
                      cx="50%" cy="50%" innerRadius={42} outerRadius={72} paddingAngle={2} stroke="none"
                      onClick={() => navigate('/requests')} style={{ cursor: 'pointer' }}>
                      {byServiceType.map((_: unknown, i: number) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TT} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </div>

        {/* ── Recentes ────────────────────────────────── */}
        <div>
          <SectionTitle title="Solicitações Recentes" to="/requests" toLabel="Ver todas" />
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="pl-5">Número</th>
                    <th>Empresa</th>
                    <th>Cliente Final</th>
                    <th>Tipo de Serviço</th>
                    <th>Status</th>
                    <th className="pr-5 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {recentRequests.map((r: any) => (
                    <tr key={r.id} className="cursor-pointer" onClick={() => navigate(`/requests/${r.id}`)}>
                      <td className="pl-5">
                        <span className="font-mono text-xs font-bold text-brand-600">{r.requestNumber}</span>
                        {r.isUrgent && <div className="text-[10px] text-amber-600 font-semibold">⚡ Urgente</div>}
                      </td>
                      <td className="text-sm font-medium text-surface-700">{r.client?.name ?? '—'}</td>
                      <td className="text-sm text-surface-600 max-w-[160px] truncate">{r.finalClientName}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {r.serviceTypes?.slice(0, 2).map((st: any) => (
                            <span key={st.serviceTypeId}
                              className="text-[11px] bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded font-medium">
                              {st.serviceType.name}
                            </span>
                          ))}
                          {r.serviceTypes?.length > 2 && (
                            <span className="text-[11px] text-surface-400">+{r.serviceTypes.length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td><RequestStatusBadge status={r.status} /></td>
                      <td className="pr-5 text-right" onClick={e => e.stopPropagation()}>
                        <button className="flex items-center gap-1 text-xs text-brand-600 font-semibold hover:underline ml-auto"
                          onClick={() => navigate(`/requests/${r.id}`)}>
                          Abrir <ArrowRight size={11} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
