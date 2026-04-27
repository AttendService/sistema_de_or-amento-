// ============================================================
// Tipos e utilitários de status — Portal de Orçamentos
// ============================================================

export type RequestStatus =
  | 'REQUESTED' | 'IN_ANALYSIS' | 'QUOTE_IN_PROGRESS'
  | 'QUOTE_SENT' | 'APPROVED' | 'REJECTED' | 'ON_HOLD' | 'CANCELLED'

export type QuoteStatus =
  | 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED' | 'ON_HOLD' | 'CANCELLED'

export type UserRole = 'CLIENT' | 'ANALYST' | 'ADMIN'

// ── Labels de status ──────────────────────────────────────
export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  REQUESTED:         'Solicitado',
  IN_ANALYSIS:       'Em análise',
  QUOTE_IN_PROGRESS: 'Orçamento em elaboração',
  QUOTE_SENT:        'Orçamento enviado',
  APPROVED:          'Aprovado',
  REJECTED:          'Reprovado',
  ON_HOLD:           'Em espera',
  CANCELLED:         'Cancelado',
}

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  DRAFT:     'Rascunho',
  SENT:      'Enviado',
  APPROVED:  'Aprovado',
  REJECTED:  'Reprovado',
  ON_HOLD:   'Em espera',
  CANCELLED: 'Cancelado',
}

// ── Cores de status (classes Tailwind) ────────────────────
export const REQUEST_STATUS_COLOR: Record<RequestStatus, { bg: string; text: string; dot: string }> = {
  REQUESTED:         { bg: 'bg-violet-50',  text: 'text-violet-700',  dot: 'bg-violet-500' },
  IN_ANALYSIS:       { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500'  },
  QUOTE_IN_PROGRESS: { bg: 'bg-purple-50',  text: 'text-purple-700',  dot: 'bg-purple-500' },
  QUOTE_SENT:        { bg: 'bg-cyan-50',    text: 'text-cyan-700',    dot: 'bg-cyan-500'   },
  APPROVED:          { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500'},
  REJECTED:          { bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500'    },
  ON_HOLD:           { bg: 'bg-orange-50',  text: 'text-orange-700',  dot: 'bg-orange-500' },
  CANCELLED:         { bg: 'bg-slate-100',  text: 'text-slate-500',   dot: 'bg-slate-400'  },
}

export const QUOTE_STATUS_COLOR: Record<QuoteStatus, { bg: string; text: string; dot: string }> = {
  DRAFT:     { bg: 'bg-slate-100',  text: 'text-slate-600',   dot: 'bg-slate-400'  },
  SENT:      { bg: 'bg-cyan-50',    text: 'text-cyan-700',    dot: 'bg-cyan-500'   },
  APPROVED:  { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500'},
  REJECTED:  { bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500'    },
  ON_HOLD:   { bg: 'bg-orange-50',  text: 'text-orange-700',  dot: 'bg-orange-500' },
  CANCELLED: { bg: 'bg-slate-100',  text: 'text-slate-500',   dot: 'bg-slate-400'  },
}

// ── Formatadores ──────────────────────────────────────────
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date))
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(date))
}

export function formatRelative(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d    = new Date(date)
  const now  = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)   return 'agora'
  if (mins < 60)  return `${mins}min atrás`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h atrás`
  const days = Math.floor(hrs / 24)
  if (days < 7)   return `${days}d atrás`
  return formatDate(date)
}

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  Ativação:            'Ativação',
  'Mudança de Endereço': 'Mudança de Endereço',
  'Mudança de Layout': 'Mudança de Layout',
  Migração:            'Migração',
  Vistoria:            'Vistoria',
  'Obra Civil':        'Obra Civil',
  Outros:              'Outros',
}
