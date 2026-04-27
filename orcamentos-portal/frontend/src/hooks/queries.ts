// ============================================================
// Hooks de dados — TanStack Query v5
// ============================================================
import {
  useQuery, useMutation, useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query'
import { api, extractApiError } from '../lib/api'

// ── Auth ──────────────────────────────────────────────────
export const useMe = () =>
  useQuery({ queryKey: ['me'], queryFn: () => api.get('/auth/me').then(r => r.data) })

// ── Service Types ─────────────────────────────────────────
export const useServiceTypes = (includeInactive = false) =>
  useQuery({
    queryKey: ['service-types', { includeInactive }],
    queryFn:  () => api.get('/api/v1/service-types', { params: { includeInactive } }).then(r => r.data),
  })

// ── Clients ───────────────────────────────────────────────
export const useClients = (params?: Record<string, unknown>) =>
  useQuery({
    queryKey: ['clients', params],
    queryFn:  () => api.get('/api/v1/clients', { params }).then(r => r.data),
  })

export const useClient = (id: string) =>
  useQuery({
    queryKey: ['clients', id],
    queryFn:  () => api.get(`/api/v1/clients/${id}`).then(r => r.data),
    enabled:  !!id,
  })

// ── Price Tables ──────────────────────────────────────────
export const usePriceTables = (clientId: string, includeArchived = false) =>
  useQuery({
    queryKey: ['price-tables', clientId, { includeArchived }],
    queryFn:  () => api.get(`/api/v1/clients/${clientId}/price-tables`, { params: { includeArchived } }).then(r => r.data),
    enabled:  !!clientId,
  })

export const usePriceTable = (clientId: string, tableId: string, params?: Record<string, unknown>) =>
  useQuery({
    queryKey: ['price-tables', clientId, tableId, params],
    queryFn:  () => api.get(`/api/v1/clients/${clientId}/price-tables/${tableId}`, { params }).then(r => r.data),
    enabled:  !!clientId && !!tableId,
  })

export const useCreatePriceTable = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ clientId, data }: { clientId: string; data: unknown }) =>
      api.post(`/api/v1/clients/${clientId}/price-tables`, data).then(r => r.data),
    onSuccess: (_, { clientId }) => qc.invalidateQueries({ queryKey: ['price-tables', clientId] }),
  })
}

export const useCreatePriceItem = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ clientId, tableId, data }: { clientId: string; tableId: string; data: unknown }) =>
      api.post(`/api/v1/clients/${clientId}/price-tables/${tableId}/items`, data).then(r => r.data),
    onSuccess: (_, { clientId, tableId }) =>
      qc.invalidateQueries({ queryKey: ['price-tables', clientId, tableId] }),
  })
}

export const useUpdatePriceItem = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ clientId, tableId, itemId, data }: { clientId: string; tableId: string; itemId: string; data: unknown }) =>
      api.patch(`/api/v1/clients/${clientId}/price-tables/${tableId}/items/${itemId}`, data).then(r => r.data),
    onSuccess: (_, { clientId, tableId }) =>
      qc.invalidateQueries({ queryKey: ['price-tables', clientId, tableId] }),
  })
}

export const useDeletePriceItem = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ clientId, tableId, itemId }: { clientId: string; tableId: string; itemId: string }) =>
      api.delete(`/api/v1/clients/${clientId}/price-tables/${tableId}/items/${itemId}`),
    onSuccess: (_, { clientId, tableId }) =>
      qc.invalidateQueries({ queryKey: ['price-tables', clientId, tableId] }),
  })
}

// ── Requests ──────────────────────────────────────────────
export const useRequests = (params?: Record<string, unknown>) =>
  useQuery({
    queryKey: ['requests', params],
    queryFn:  () => api.get('/api/v1/requests', { params }).then(r => r.data),
  })

export const useRequest = (id: string) =>
  useQuery({
    queryKey: ['requests', id],
    queryFn:  () => api.get(`/api/v1/requests/${id}`).then(r => r.data),
    enabled:  !!id,
  })

export const useRequestHistory = (id: string) =>
  useQuery({
    queryKey: ['requests', id, 'history'],
    queryFn:  () => api.get(`/api/v1/requests/${id}/history`).then(r => r.data),
    enabled:  !!id,
  })

export const useCreateRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: unknown) => api.post('/api/v1/requests', data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['requests'] }),
  })
}

export const useChangeRequestStatus = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      api.post(`/api/v1/requests/${id}/status`, data).then(r => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['requests'] })
      qc.invalidateQueries({ queryKey: ['requests', id] })
    },
  })
}

export const useAssignRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, analystId }: { id: string; analystId?: string }) =>
      api.post(`/api/v1/requests/${id}/assign`, { analystId }).then(r => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['requests'] })
      qc.invalidateQueries({ queryKey: ['requests', id] })
    },
  })
}

// ── Quotes ────────────────────────────────────────────────
export const useQuotes = (requestId: string) =>
  useQuery({
    queryKey: ['quotes', requestId],
    queryFn:  () => api.get(`/api/v1/requests/${requestId}/quotes`).then(r => r.data),
    enabled:  !!requestId,
  })

export const useQuote = (requestId: string, quoteId: string) =>
  useQuery({
    queryKey: ['quotes', requestId, quoteId],
    queryFn:  () => api.get(`/api/v1/requests/${requestId}/quotes/${quoteId}`).then(r => r.data),
    enabled:  !!requestId && !!quoteId,
  })

export const useCreateQuote = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ requestId, data }: { requestId: string; data: unknown }) =>
      api.post(`/api/v1/requests/${requestId}/quotes`, data).then(r => r.data),
    onSuccess: (_, { requestId }) => {
      qc.invalidateQueries({ queryKey: ['quotes', requestId] })
      qc.invalidateQueries({ queryKey: ['requests', requestId] })
    },
  })
}

export const useUpdateQuote = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ requestId, quoteId, data }: { requestId: string; quoteId: string; data: unknown }) =>
      api.patch(`/api/v1/requests/${requestId}/quotes/${quoteId}`, data).then(r => r.data),
    onSuccess: (_, { requestId, quoteId }) => {
      qc.invalidateQueries({ queryKey: ['quotes', requestId, quoteId] })
    },
  })
}

export const useAddQuoteItem = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ requestId, quoteId, data }: { requestId: string; quoteId: string; data: unknown }) =>
      api.post(`/api/v1/requests/${requestId}/quotes/${quoteId}/items`, data).then(r => r.data),
    onSuccess: (_, { requestId, quoteId }) =>
      qc.invalidateQueries({ queryKey: ['quotes', requestId, quoteId] }),
  })
}

export const useUpdateQuoteItem = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ requestId, quoteId, itemId, data }: { requestId: string; quoteId: string; itemId: string; data: unknown }) =>
      api.patch(`/api/v1/requests/${requestId}/quotes/${quoteId}/items/${itemId}`, data).then(r => r.data),
    onSuccess: (_, { requestId, quoteId }) =>
      qc.invalidateQueries({ queryKey: ['quotes', requestId, quoteId] }),
  })
}

export const useDeleteQuoteItem = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ requestId, quoteId, itemId }: { requestId: string; quoteId: string; itemId: string }) =>
      api.delete(`/api/v1/requests/${requestId}/quotes/${quoteId}/items/${itemId}`),
    onSuccess: (_, { requestId, quoteId }) =>
      qc.invalidateQueries({ queryKey: ['quotes', requestId, quoteId] }),
  })
}

export const useSendQuote = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ requestId, quoteId }: { requestId: string; quoteId: string }) =>
      api.post(`/api/v1/requests/${requestId}/quotes/${quoteId}/send`).then(r => r.data),
    onSuccess: (_, { requestId, quoteId }) => {
      qc.invalidateQueries({ queryKey: ['quotes', requestId] })
      qc.invalidateQueries({ queryKey: ['requests', requestId] })
    },
  })
}

export const useQuoteDecision = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ requestId, quoteId, data }: { requestId: string; quoteId: string; data: unknown }) =>
      api.post(`/api/v1/requests/${requestId}/quotes/${quoteId}/decision`, data).then(r => r.data),
    onSuccess: (_, { requestId, quoteId }) => {
      qc.invalidateQueries({ queryKey: ['quotes', requestId] })
      qc.invalidateQueries({ queryKey: ['requests', requestId] })
      qc.invalidateQueries({ queryKey: ['requests'] })
    },
  })
}

// ── Dashboard ─────────────────────────────────────────────
export const useDashboardClient = (params?: Record<string, unknown>) =>
  useQuery({
    queryKey: ['dashboard', 'client', params],
    queryFn:  () => api.get('/api/v1/dashboard/client', { params }).then(r => r.data),
  })

export const useDashboardOperational = (params?: Record<string, unknown>) =>
  useQuery({
    queryKey: ['dashboard', 'operational', params],
    queryFn:  () => api.get('/api/v1/dashboard/operational', { params }).then(r => r.data),
  })

export const useQueueStats = () =>
  useQuery({
    queryKey: ['dashboard', 'queue-stats'],
    queryFn:  () => api.get('/api/v1/dashboard/queue-stats').then(r => r.data),
    refetchInterval: 30_000, // atualiza a cada 30s
  })

// ── Users ─────────────────────────────────────────────────
export const useUsers = (params?: Record<string, unknown>) =>
  useQuery({
    queryKey: ['users', params],
    queryFn:  () => api.get('/api/v1/users', { params }).then(r => r.data),
  })

export const useCreateUser = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: unknown) => api.post('/api/v1/users', data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

export const useUpdateUser = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      api.patch(`/api/v1/users/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}
