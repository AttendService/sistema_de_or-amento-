// ============================================================
// Store de Auth — Zustand
// ============================================================
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '../lib/api'

export interface AuthClient {
  id: string
  name: string
  isDefault: boolean
}

export interface AuthUser {
  id:             string
  name:           string
  email:          string
  role:           'CLIENT' | 'ANALYST' | 'ADMIN'
  clientIds:      string[]
  defaultClientId: string | null
  clients:        AuthClient[]
}

interface AuthState {
  user:         AuthUser | null
  accessToken:  string | null
  refreshToken: string | null
  isLoading:    boolean
  // Ações
  login:  (email: string, password: string) => Promise<void>
  logout: () => void
  setUser:(user: AuthUser) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user:         null,
      accessToken:  null,
      refreshToken: null,
      isLoading:    false,

      login: async (email, password) => {
        set({ isLoading: true })
        try {
          const { data } = await api.post('/auth/login', { email, password })
          localStorage.setItem('accessToken',  data.accessToken)
          localStorage.setItem('refreshToken', data.refreshToken)
          set({
            user:         data.user,
            accessToken:  data.accessToken,
            refreshToken: data.refreshToken,
            isLoading:    false,
          })
        } catch (err) {
          set({ isLoading: false })
          throw err
        }
      },

      logout: () => {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        set({ user: null, accessToken: null, refreshToken: null })
        window.location.href = '/login'
      },

      setUser: (user) => set({ user }),
    }),
    {
      name:    'auth-store',
      partialize: (state) => ({
        user:         state.user,
        accessToken:  state.accessToken,
        refreshToken: state.refreshToken,
      }),
    },
  ),
)

// Seletor para verificar role
export const useRole = () => useAuthStore((s) => s.user?.role)
export const useUser = () => useAuthStore((s) => s.user)
export const useIsAuthenticated = () => useAuthStore((s) => !!s.user && !!s.accessToken)
