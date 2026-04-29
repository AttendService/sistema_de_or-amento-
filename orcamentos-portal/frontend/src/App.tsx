import React from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthHydrated, useAuthStore, useIsAuthenticated, useRole } from './store/auth.store'

import AppLayout from './layouts/AppLayout'
import ClientsPage from './pages/ClientsPage'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import NewRequestPage from './pages/NewRequestPage'
import PriceTablesPage from './pages/PriceTablesPage'
import ProfilePage from './pages/ProfilePage'
import QuotesListPage from './pages/QuotesListPage'
import ReportsPage from './pages/ReportsPage'
import RequestDetailPage from './pages/RequestDetailPage'
import RequestsPage from './pages/RequestsPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import ServiceTypesPage from './pages/ServiceTypesPage'
import UsersPage from './pages/UsersPage'
import ProposalsDashboardPage from './pages/ProposalsDashboardPage'
import ProposalRequestsPage from './pages/ProposalRequestsPage'
import ProposalRequestDetailPage from './pages/ProposalRequestDetailPage'
import NewProposalRequestPage from './pages/NewProposalRequestPage'
import ProposalPresalesQueuePage from './pages/ProposalPresalesQueuePage'
import ProposalApprovalsPage from './pages/ProposalApprovalsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000

function BootLoader() {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center">
      <div className="text-sm text-surface-500">Carregando...</div>
    </div>
  )
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const hydrated = useAuthHydrated()
  const isAuth = useIsAuthenticated()
  const location = useLocation()

  if (!hydrated) return <BootLoader />
  if (!isAuth) return <Navigate to="/login" state={{ from: location }} replace />

  return <>{children}</>
}

function RequireRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const hydrated = useAuthHydrated()
  const role = useRole()
  const isAuth = useIsAuthenticated()
  const isProposalRole = ['COMMERCIAL', 'COMMERCIAL_MANAGER', 'PRESALES', 'PRESALES_MANAGER'].includes(role ?? '')
  const homePath = isProposalRole ? '/proposals/dashboard' : '/dashboard'

  if (!hydrated) return <BootLoader />
  if (!isAuth) return null
  if (role === 'SUPER_ADMIN') return <>{children}</>
  if (!role || !roles.includes(role)) return <Navigate to={homePath} replace />

  return <>{children}</>
}

function AppRoutes() {
  const hydrated = useAuthHydrated()
  const isAuth = useIsAuthenticated()
  const role = useRole()
  const logout = useAuthStore((state) => state.logout)
  const isProposalRole = ['COMMERCIAL', 'COMMERCIAL_MANAGER', 'PRESALES', 'PRESALES_MANAGER'].includes(role ?? '')
  const homePath = isProposalRole ? '/proposals/dashboard' : '/dashboard'

  React.useEffect(() => {
    if (!hydrated || !isAuth) return

    let timeoutId: number | null = null

    const resetTimer = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
      timeoutId = window.setTimeout(() => {
        logout()
      }, INACTIVITY_TIMEOUT_MS)
    }

    const onActivity = () => {
      resetTimer()
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        resetTimer()
      }
    }

    const events: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ]

    events.forEach((eventName) => {
      window.addEventListener(eventName, onActivity, { passive: true })
    })
    document.addEventListener('visibilitychange', onVisibilityChange)
    resetTimer()

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
      events.forEach((eventName) => {
        window.removeEventListener(eventName, onActivity)
      })
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [hydrated, isAuth, logout])

  if (!hydrated) {
    return <BootLoader />
  }

  return (
    <Routes>
      <Route path="/" element={isAuth ? <Navigate to={homePath} replace /> : <Navigate to="/login" replace />} />
      <Route path="/login" element={isAuth ? <Navigate to={homePath} replace /> : <LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route path="/dashboard" element={(
          <RequireRole roles={['CLIENT', 'ANALYST', 'ADMIN']}>
            <DashboardPage />
          </RequireRole>
        )} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/requests" element={(
          <RequireRole roles={['CLIENT', 'ANALYST', 'ADMIN']}>
            <RequestsPage />
          </RequireRole>
        )} />
        <Route path="/requests/new" element={(
          <RequireRole roles={['CLIENT', 'ANALYST', 'ADMIN']}>
            <NewRequestPage />
          </RequireRole>
        )} />
        <Route path="/requests/:id" element={(
          <RequireRole roles={['CLIENT', 'ANALYST', 'ADMIN']}>
            <RequestDetailPage />
          </RequireRole>
        )} />
        <Route path="/quotes" element={(
          <RequireRole roles={['CLIENT', 'ANALYST', 'ADMIN']}>
            <QuotesListPage />
          </RequireRole>
        )} />

        <Route
          path="/clients"
          element={(
            <RequireRole roles={['ANALYST', 'ADMIN']}>
              <ClientsPage />
            </RequireRole>
          )}
        />

        <Route
          path="/price-tables"
          element={(
            <RequireRole roles={['ADMIN']}>
              <PriceTablesPage />
            </RequireRole>
          )}
        />

        <Route
          path="/service-types"
          element={(
            <RequireRole roles={['ADMIN']}>
              <ServiceTypesPage />
            </RequireRole>
          )}
        />

        <Route
          path="/reports"
          element={(
            <RequireRole roles={['ANALYST', 'ADMIN']}>
              <ReportsPage />
            </RequireRole>
          )}
        />

        <Route
          path="/users"
          element={(
            <RequireRole roles={['ADMIN']}>
              <UsersPage />
            </RequireRole>
          )}
        />

        <Route
          path="/proposals/dashboard"
          element={(
            <RequireRole roles={['COMMERCIAL', 'COMMERCIAL_MANAGER', 'PRESALES', 'PRESALES_MANAGER', 'ADMIN']}>
              <ProposalsDashboardPage />
            </RequireRole>
          )}
        />
        <Route
          path="/proposals/requests"
          element={(
            <RequireRole roles={['COMMERCIAL', 'COMMERCIAL_MANAGER', 'PRESALES', 'PRESALES_MANAGER', 'ADMIN']}>
              <ProposalRequestsPage />
            </RequireRole>
          )}
        />
        <Route
          path="/proposals/requests/new"
          element={(
            <RequireRole roles={['COMMERCIAL', 'COMMERCIAL_MANAGER', 'ADMIN']}>
              <NewProposalRequestPage />
            </RequireRole>
          )}
        />
        <Route
          path="/proposals/requests/:id"
          element={(
            <RequireRole roles={['COMMERCIAL', 'COMMERCIAL_MANAGER', 'PRESALES', 'PRESALES_MANAGER', 'ADMIN']}>
              <ProposalRequestDetailPage />
            </RequireRole>
          )}
        />
        <Route
          path="/proposals/presales/queue"
          element={(
            <RequireRole roles={['PRESALES', 'PRESALES_MANAGER', 'ADMIN']}>
              <ProposalPresalesQueuePage />
            </RequireRole>
          )}
        />
        <Route
          path="/proposals/approvals"
          element={(
            <RequireRole roles={['COMMERCIAL_MANAGER', 'PRESALES_MANAGER', 'ADMIN']}>
              <ProposalApprovalsPage />
            </RequireRole>
          )}
        />

        <Route path="*" element={<Navigate to={homePath} replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
