// ============================================================
// Tipos globais — Portal de Orçamentos
// ============================================================

export type UserRole = 'CLIENT' | 'ANALYST' | 'ADMIN'
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'

export type RequestStatus =
  | 'REQUESTED'
  | 'IN_ANALYSIS'
  | 'QUOTE_IN_PROGRESS'
  | 'QUOTE_SENT'
  | 'APPROVED'
  | 'REJECTED'
  | 'ON_HOLD'
  | 'CANCELLED'

export type QuoteStatus =
  | 'DRAFT'
  | 'SENT'
  | 'APPROVED'
  | 'REJECTED'
  | 'ON_HOLD'
  | 'CANCELLED'

export type QuoteItemOrigin = 'TABLE' | 'MANUAL'
export type ServiceTypeStatus = 'ACTIVE' | 'INACTIVE'
export type PriceTableStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'
export type PriceItemStatus = 'ACTIVE' | 'INACTIVE'

export type AuditAction =
  | 'CREATE' | 'UPDATE' | 'DELETE'
  | 'STATUS_CHANGE' | 'VALUE_EDIT'
  | 'SEND' | 'APPROVE' | 'REJECT' | 'CANCEL'

// Máquina de estados — transições válidas de solicitação
export const REQUEST_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  REQUESTED:          ['IN_ANALYSIS', 'CANCELLED'],
  IN_ANALYSIS:        ['QUOTE_IN_PROGRESS', 'CANCELLED'],
  QUOTE_IN_PROGRESS:  ['QUOTE_SENT', 'IN_ANALYSIS'],
  QUOTE_SENT:         ['APPROVED', 'REJECTED', 'ON_HOLD', 'CANCELLED'],
  APPROVED:           [],
  REJECTED:           [],
  ON_HOLD:            ['QUOTE_SENT', 'CANCELLED'],
  CANCELLED:          [],
}

// Quais status o cliente pode definir
export const CLIENT_ALLOWED_STATUS: RequestStatus[] = [
  'APPROVED', 'REJECTED', 'ON_HOLD', 'CANCELLED',
]

// Status que exigem motivo/observação
export const STATUS_REQUIRES_REASON: RequestStatus[] = [
  'REJECTED', 'ON_HOLD', 'CANCELLED',
]

// Máquina de estados — orçamento
export const QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  DRAFT:     ['SENT', 'CANCELLED'],
  SENT:      ['APPROVED', 'REJECTED', 'ON_HOLD'],
  APPROVED:  [],
  REJECTED:  [],
  ON_HOLD:   ['SENT', 'CANCELLED'],
  CANCELLED: [],
}

// Payload do JWT
export interface JwtPayload {
  sub: string          // userId
  email: string
  role: UserRole
  clientIds: string[]  // clientes que o usuário representa
  defaultClientId: string | null
  iat?: number
  exp?: number
}

// Request autenticado (injetado pelo middleware)
export interface AuthUser {
  sub?: string
  id?: string
  email: string
  role: UserRole
  clientIds: string[]
  defaultClientId: string | null
}

// Paginação padrão
export interface PaginationQuery {
  page?: number
  limit?: number
}

export interface PaginatedResult<T> {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

// Resposta de erro padrão
export interface ApiError {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}
