// ============================================================
// Componentes UI compartilhados
// ============================================================
import React from 'react'
import { createPortal } from 'react-dom'
import { X, AlertCircle } from 'lucide-react'
import {
  REQUEST_STATUS_LABEL, REQUEST_STATUS_COLOR,
  QUOTE_STATUS_LABEL, QUOTE_STATUS_COLOR,
  type RequestStatus, type QuoteStatus,
} from '../lib/constants'

// ── StatusBadge ───────────────────────────────────────────
export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const c = REQUEST_STATUS_COLOR[status]
  return (
    <span className={`badge ${c.bg} ${c.text}`}>
      <span className={`badge-dot ${c.dot}`} />
      {REQUEST_STATUS_LABEL[status]}
    </span>
  )
}

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const c = QUOTE_STATUS_COLOR[status]
  return (
    <span className={`badge ${c.bg} ${c.text}`}>
      <span className={`badge-dot ${c.dot}`} />
      {QUOTE_STATUS_LABEL[status]}
    </span>
  )
}

// ── UrgentBadge ───────────────────────────────────────────
export function UrgentBadge() {
  return (
    <span className="urgent-indicator">
      ⚡ Urgente
    </span>
  )
}

// ── KpiCard ───────────────────────────────────────────────
interface KpiCardProps {
  label:    string
  value:    string | number
  icon?:    React.ReactNode
  delta?:   {
    value: string | number
    isPositive: boolean
  }
  color?:   string
  loading?: boolean
}

export function KpiCard({ label, value, icon, delta, color = 'text-brand-500', loading }: KpiCardProps) {
  return (
    <div className="kpi-card group relative">
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--c-surface-400)', textTransform: 'uppercase', letterSpacing: '0.07em', lineHeight: 1 }}>{label}</p>
          {loading
            ? <div className="h-4 w-14 bg-surface-100 rounded animate-pulse mt-1" />
            : (
              <div className="flex items-baseline gap-1 mt-0.5">
                <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--c-surface-900)', lineHeight: 1.2 }}>{value}</p>
                {delta && (
                  <span className={`text-[9px] font-bold px-1 py-0.5 rounded-full ${delta.isPositive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {delta.isPositive ? '↑' : '↓'} {delta.value}
                  </span>
                )}
              </div>
            )
          }
        </div>
        {icon && (
          <div className={`p-1.5 rounded-md bg-surface-50 ${color} group-hover:scale-110 group-hover:bg-white transition-all duration-300`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Spinner ───────────────────────────────────────────────
export function Spinner({ size = 'sm', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const s = size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-6 h-6' : 'w-8 h-8'
  return <div className={`${s} border-2 border-current border-t-transparent rounded-full animate-spin ${className}`} />
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <Spinner size="lg" className="text-brand-400" />
    </div>
  )
}

// ── EmptyState ────────────────────────────────────────────
interface EmptyStateProps {
  icon?:  React.ReactNode
  title:  string
  desc?:  string
  action?: React.ReactNode
}
export function EmptyState({ icon, title, desc, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state-icon">{icon}</div>}
      <p className="empty-state-title">{title}</p>
      {desc   && <p className="empty-state-desc">{desc}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────
interface ModalProps {
  open:      boolean
  onClose:   () => void
  title:     string
  children:  React.ReactNode
  footer?:   React.ReactNode
  maxWidth?: string
}

export function Modal({ open, onClose, title, children, footer, maxWidth = 'max-w-lg' }: ModalProps) {
  if (!open) return null
  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal-box ${maxWidth}`}>
        <div className="modal-header">
          <h2 className="font-semibold text-surface-900">{title}</h2>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

// ── Alert ─────────────────────────────────────────────────
interface AlertProps {
  type?:    'error' | 'warning' | 'success' | 'info'
  message:  string
}
export function Alert({ type = 'error', message }: AlertProps) {
  const styles = {
    error:   'bg-red-50 text-red-700 border-red-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    info:    'bg-blue-50 text-blue-700 border-blue-200',
  }
  return (
    <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${styles[type]}`}>
      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  )
}

// ── ConfirmDialog ─────────────────────────────────────────
interface ConfirmDialogProps {
  open:      boolean
  onClose:   () => void
  onConfirm: () => void
  title:     string
  message:   string
  danger?:   boolean
  loading?:  boolean
}
export function ConfirmDialog({ open, onClose, onConfirm, title, message, danger, loading }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={
        <>
          <button onClick={onClose} className="btn-secondary" disabled={loading}>Cancelar</button>
          <button onClick={onConfirm} className={danger ? 'btn-danger' : 'btn-primary'} disabled={loading}>
            {loading ? <Spinner size="sm" /> : 'Confirmar'}
          </button>
        </>
      }
    >
      <p className="text-sm text-surface-600">{message}</p>
    </Modal>
  )
}

// ── FormField ─────────────────────────────────────────────
interface FormFieldProps {
  label:     string
  error?:    string
  hint?:     string
  required?: boolean
  children:  React.ReactNode
}
export function FormField({ label, error, hint, required, children }: FormFieldProps) {
  return (
    <div>
      <label className="form-label">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="form-error">{error}</p>}
      {!error && hint && <p className="form-hint">{hint}</p>}
    </div>
  )
}

// ── Pagination ────────────────────────────────────────────
interface PaginationProps {
  page:       number
  totalPages: number
  onPage:     (p: number) => void
}
export function Pagination({ page, totalPages, onPage }: PaginationProps) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-1 pt-4">
      <button className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>←</button>
      {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
        const p = i + 1
        return (
          <button key={p} onClick={() => onPage(p)}
            className={`btn-sm w-8 h-8 p-0 ${p === page ? 'btn-primary' : 'btn-ghost'}`}>
            {p}
          </button>
        )
      })}
      <button className="btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>→</button>
    </div>
  )
}
