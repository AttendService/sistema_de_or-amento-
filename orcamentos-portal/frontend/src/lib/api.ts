import axios, { type AxiosError } from 'axios'

const AUTH_STORAGE_KEY = 'auth-store'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

function readPersistedAuth() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as {
      state?: {
        user?: unknown
        accessToken?: string | null
        refreshToken?: string | null
      }
      version?: number
    }

    return parsed
  } catch {
    return null
  }
}

function readAccessToken() {
  return localStorage.getItem('accessToken') ?? readPersistedAuth()?.state?.accessToken ?? null
}

function readRefreshToken() {
  return localStorage.getItem('refreshToken') ?? readPersistedAuth()?.state?.refreshToken ?? null
}

function syncPersistedTokens(accessToken: string, refreshToken: string) {
  const persisted = readPersistedAuth()
  if (!persisted?.state) return

  localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      ...persisted,
      state: {
        ...persisted.state,
        accessToken,
        refreshToken,
      },
    }),
  )
}

function clearAuthStorage() {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem(AUTH_STORAGE_KEY)
}

api.interceptors.request.use((config) => {
  const token = readAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let isRefreshing = false
let waitQueue: Array<(token: string) => void> = []

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as any

    if (error.response?.status !== 401 || original?._retry) {
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

    original._retry = true
    isRefreshing = true

    try {
      const refreshToken = readRefreshToken()
      if (!refreshToken) throw new Error('no refresh token')

      const { data } = await axios.post(
        `${import.meta.env.VITE_API_URL ?? ''}/auth/refresh`,
        { refreshToken },
      )

      localStorage.setItem('accessToken', data.accessToken)
      localStorage.setItem('refreshToken', data.refreshToken)
      syncPersistedTokens(data.accessToken, data.refreshToken)

      waitQueue.forEach((callback) => callback(data.accessToken))
      waitQueue = []

      original.headers.Authorization = `Bearer ${data.accessToken}`
      return api(original)
    } catch {
      clearAuthStorage()
      if (window.location.pathname !== '/login') {
        window.location.replace('/login')
      }
      return Promise.reject(error)
    } finally {
      isRefreshing = false
    }
  },
)

export function extractApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error?.message ?? error.message ?? 'Erro desconhecido.'
  }

  return 'Erro desconhecido.'
}
