import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '../lib/api'

export interface AuthClient {
  id: string
  name: string
  isDefault: boolean
}

export interface AuthUser {
  id: string
  name: string
  email: string
  role:
    | 'CLIENT'
    | 'ANALYST'
    | 'ADMIN'
    | 'COMMERCIAL'
    | 'COMMERCIAL_MANAGER'
    | 'PRESALES'
    | 'PRESALES_MANAGER'
  clientIds: string[]
  defaultClientId: string | null
  clients: AuthClient[]
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  setUser: (user: AuthUser) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true })

        try {
          const { data } = await api.post('/auth/login', { email, password })

          localStorage.setItem('accessToken', data.accessToken)
          localStorage.setItem('refreshToken', data.refreshToken)

          set({
            user: data.user,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            isLoading: false,
          })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      logout: () => {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        set({ user: null, accessToken: null, refreshToken: null })
        window.location.replace('/login')
      },

      setUser: (user) => set({ user }),
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    },
  ),
)

export const useRole = () => useAuthStore((state) => state.user?.role)
export const useUser = () => useAuthStore((state) => state.user)
export const useIsAuthenticated = () => useAuthStore((state) => !!state.user && !!state.accessToken)

export function useAuthHydrated() {
  const [hydrated, setHydrated] = useState(useAuthStore.persist.hasHydrated())

  useEffect(() => {
    const unsubscribeHydrate = useAuthStore.persist.onHydrate(() => setHydrated(false))
    const unsubscribeFinish = useAuthStore.persist.onFinishHydration(() => setHydrated(true))

    setHydrated(useAuthStore.persist.hasHydrated())

    return () => {
      unsubscribeHydrate()
      unsubscribeFinish()
    }
  }, [])

  return hydrated
}
