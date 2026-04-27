// ============================================================
// App.tsx — Roteamento completo + Guards
// ============================================================
import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useIsAuthenticated, useRole } from './store/auth.store'

import AppLayout          from './layouts/AppLayout'
import LoginPage          from './pages/LoginPage'
import DashboardPage      from './pages/DashboardPage'
import RequestsPage       from './pages/RequestsPage'
import NewRequestPage     from './pages/NewRequestPage'
import RequestDetailPage  from './pages/RequestDetailPage'
import QuotesListPage     from './pages/QuotesListPage'
import PriceTablesPage    from './pages/PriceTablesPage'
import UsersPage          from './pages/UsersPage'
import ClientsPage        from './pages/ClientsPage'
import ServiceTypesPage   from './pages/ServiceTypesPage'
import ReportsPage        from './pages/ReportsPage'
import ProfilePage        from './pages/ProfilePage'
import QuoteDetailPage    from './pages/QuoteDetailPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
})

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuth   = useIsAuthenticated()
  const location = useLocation()
  if (!isAuth) return <Navigate to="/login" state={{ from: location }} replace />
  return <>{children}</>
}

function RequireRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const role   = useRole()
  const isAuth = useIsAuthenticated()
  // Aguarda hidratação do Zustand persist antes de avaliar permissão
  if (!isAuth) return null
  if (!role || !roles.includes(role)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function AppRoutes() {
  const isAuth = useIsAuthenticated()
  return (
    <Routes>
      <Route path="/" element={isAuth ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />
      <Route path="/login" element={isAuth ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        {/* Comuns a todos */}
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/profile"   element={<ProfilePage />} />

        {/* Solicitações */}
        <Route path="/requests"     element={<RequestsPage />} />
        <Route path="/requests/new" element={<NewRequestPage />} />
        <Route path="/requests/:id" element={<RequestDetailPage />} />
        <Route path="/requests/:requestId/quotes/:quoteId" element={<QuoteDetailPage />} />

        {/* Orçamentos — lista dedicada */}
        <Route path="/quotes" element={<QuotesListPage />} />

        {/* Clientes — analista e admin */}
        <Route path="/clients" element={
          <RequireRole roles={['ANALYST','ADMIN']}>
            <ClientsPage />
          </RequireRole>
        } />

        {/* Tabela de preços — admin */}
        <Route path="/price-tables" element={
          <RequireRole roles={['ADMIN']}>
            <PriceTablesPage />
          </RequireRole>
        } />

        {/* Tipos de serviço — admin */}
        <Route path="/service-types" element={
          <RequireRole roles={['ADMIN']}>
            <ServiceTypesPage />
          </RequireRole>
        } />

        {/* Relatórios — analista e admin */}
        <Route path="/reports" element={
          <RequireRole roles={['ANALYST','ADMIN']}>
            <ReportsPage />
          </RequireRole>
        } />

        {/* Usuários — admin */}
        <Route path="/users" element={
          <RequireRole roles={['ADMIN']}>
            <UsersPage />
          </RequireRole>
        } />

        {/* Configurações — admin (placeholder mantido) */}
        <Route path="/settings" element={
          <RequireRole roles={['ADMIN']}>
            <SettingsPage />
          </RequireRole>
        } />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}

// Configurações — placeholder simples (fora de escopo v1)
function SettingsPage() {
  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="font-semibold text-surface-900">Configurações</h1>
      </div>
      <div className="page-body max-w-lg">
        <div className="card card-body">
          <p className="text-sm text-surface-500 text-center py-6">
            Configurações do sistema estarão disponíveis em versões futuras.
          </p>
        </div>
      </div>
    </div>
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
