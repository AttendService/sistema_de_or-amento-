// ============================================================
// Layout principal — Sidebar + Header
// ============================================================
import React from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard, FileText, PlusCircle, Receipt, Users,
  DollarSign, Tags, LogOut, BarChart2, Briefcase, Sun, Moon, CheckCircle
} from 'lucide-react'
import { useAuthStore, useRole } from '../store/auth.store'

interface NavItem {
  to: string
  icon: React.ReactNode
  label: string
}

const CLIENT_NAV: NavItem[] = [
  { to: '/dashboard', icon: <LayoutDashboard size={16} />, label: 'Dashboard' },
  { to: '/requests/new', icon: <PlusCircle size={16} />, label: 'Nova solicitação' },
  { to: '/requests', icon: <FileText size={16} />, label: 'Minhas solicitações' },
  { to: '/quotes', icon: <Receipt size={16} />, label: 'Orçamentos' },
  { to: '/profile', icon: <Users size={16} />, label: 'Perfil' },
]

const ANALYST_NAV: NavItem[] = [
  { to: '/dashboard', icon: <LayoutDashboard size={16} />, label: 'Dashboard' },
  { to: '/requests', icon: <FileText size={16} />, label: 'Fila de solicitações' },
  { to: '/quotes', icon: <Receipt size={16} />, label: 'Orçamentos' },
  { to: '/clients', icon: <Briefcase size={16} />, label: 'Clientes' },
  { to: '/reports', icon: <BarChart2 size={16} />, label: 'Relatórios' },
  { to: '/profile', icon: <Users size={16} />, label: 'Perfil' },
]

const ADMIN_NAV: NavItem[] = [
  { to: '/dashboard', icon: <LayoutDashboard size={16} />, label: 'Dashboard' },
  { to: '/requests', icon: <FileText size={16} />, label: 'Solicitações' },
  { to: '/quotes', icon: <Receipt size={16} />, label: 'Orçamentos' },
  { to: '/clients', icon: <Briefcase size={16} />, label: 'Clientes' },
  { to: '/users', icon: <Users size={16} />, label: 'Usuários' },
  { to: '/price-tables', icon: <DollarSign size={16} />, label: 'Tabela de preços' },
  { to: '/service-types', icon: <Tags size={16} />, label: 'Tipos de serviço' },
  { to: '/reports', icon: <BarChart2 size={16} />, label: 'Relatórios' },
  { to: '/profile', icon: <Users size={16} />, label: 'Perfil' },
]

const COMMERCIAL_NAV: NavItem[] = [
  { to: '/proposals/dashboard', icon: <LayoutDashboard size={16} />, label: 'Dashboard' },
  { to: '/proposals/requests', icon: <FileText size={16} />, label: 'Solicitações de Proposta' },
  { to: '/proposals/approvals', icon: <CheckCircle size={16} />, label: 'Aprovações' },
]

const PRESALES_NAV: NavItem[] = [
  { to: '/proposals/dashboard', icon: <LayoutDashboard size={16} />, label: 'Dashboard Técnico' },
  { to: '/proposals/presales/queue', icon: <FileText size={16} />, label: 'Fila de Análises' },
  { to: '/proposals/requests', icon: <Receipt size={16} />, label: 'Demandas em Andamento' },
]

export default function AppLayout() {
  const role = useRole()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const isCommercial = role === 'COMMERCIAL' || role === 'COMMERCIAL_MANAGER'
  const isPresales = role === 'PRESALES' || role === 'PRESALES_MANAGER'
  const nav = isCommercial
    ? COMMERCIAL_NAV
    : isPresales
    ? PRESALES_NAV
    : role === 'CLIENT'
    ? CLIENT_NAV
    : role === 'ADMIN'
    ? ADMIN_NAV
    : ANALYST_NAV

  const roleLabel = role === 'CLIENT'
    ? 'Cliente'
    : role === 'ADMIN'
    ? 'Administrador'
    : role === 'ANALYST'
    ? 'Analista'
    : role === 'COMMERCIAL'
    ? 'Comercial'
    : role === 'COMMERCIAL_MANAGER'
    ? 'Gestor Comercial'
    : role === 'PRESALES'
    ? 'Pré-vendas'
    : role === 'PRESALES_MANAGER'
    ? 'Gestor Pré-vendas'
    : 'Usuário'

  const [isDark, setIsDark] = React.useState(false)

  React.useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark')
      setIsDark(true)
    } else if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark')
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark')
      setIsDark(true)
    }
  }, [])

  const toggleTheme = () => {
    const root = document.documentElement
    if (isDark) {
      root.classList.remove('dark')
      localStorage.setItem('theme', 'light')
      setIsDark(false)
    } else {
      root.classList.add('dark')
      localStorage.setItem('theme', 'dark')
      setIsDark(true)
    }
  }

  return (
    <div className="flex min-h-screen">
      <aside className="sidebar">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-brand-500 flex items-center justify-center">
              <Receipt size={14} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-tight">Portal</p>
              <p className="text-xs text-slate-400 leading-tight">Orçamentos</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-white">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-slate-400">{roleLabel}</p>
            </div>
            
            <button onClick={toggleTheme} className="btn-ghost p-1.5 text-slate-400 hover:text-white" title="Trocar Tema">
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            <button
              onClick={logout}
              className="btn-ghost p-1.5 text-slate-400 hover:text-white"
              title="Sair"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      <div className="main-content flex-1">
        <Outlet />
      </div>
    </div>
  )
}
