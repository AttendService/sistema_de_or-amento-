// ============================================================
// Cliente HTTP — Axios com interceptores de auth + refresh
// ============================================================
import axios, { type AxiosError } from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL?.trim() || '',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Request: injeta accessToken ───────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Response: refresh automático em 401 ──────────────────
let isRefreshing = false
let waitQueue: Array<(token: string) => void> = []

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as any
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve) => {
        waitQueue.push((token) => {
          original.headers.Authorization = `Bearer ${token}`
          resolve(api(original))
        })
      })
    }

    original._retry  = true
    isRefreshing     = true

    try {
      const refreshToken = localStorage.getItem('refreshToken')
      if (!refreshToken) throw new Error('no refresh token')

      const { data } = await api.post('/auth/refresh', { refreshToken })

      localStorage.setItem('accessToken',  data.accessToken)
      localStorage.setItem('refreshToken', data.refreshToken)

      waitQueue.forEach((cb) => cb(data.accessToken))
      waitQueue = []

      original.headers.Authorization = `Bearer ${data.accessToken}`
      return api(original)
    } catch {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      window.location.href = '/login'
      return Promise.reject(error)
    } finally {
      isRefreshing = false
    }
  },
)

// ── Helpers de extração de erro ───────────────────────────
export function extractApiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error?.message ?? err.message ?? 'Erro desconhecido.'
  }
  return 'Erro desconhecido.'
}
