// ============================================================
// Layout principal — Sidebar + Header
// ============================================================
import React from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FileText, PlusCircle, Receipt, Users,
  Settings, DollarSign, Tags, LogOut, ChevronRight, Bell,
  BarChart2, Briefcase,
} from 'lucide-react'
import { useAuthStore, useRole } from '../store/auth.store'

interface NavItem {
  to:    string
  icon:  React.ReactNode
  label: string
}

const CLIENT_NAV: NavItem[] = [
  { to: '/dashboard',     icon: <LayoutDashboard size={16} />, label: 'Dashboard'           },
  { to: '/requests/new',  icon: <PlusCircle       size={16} />, label: 'Nova solicitação'    },
  { to: '/requests',      icon: <FileText         size={16} />, label: 'Minhas solicitações' },
  { to: '/quotes',        icon: <Receipt          size={16} />, label: 'Orçamentos'          },
  { to: '/profile',       icon: <Users            size={16} />, label: 'Perfil'              },
]

const ANALYST_NAV: NavItem[] = [
  { to: '/dashboard',     icon: <LayoutDashboard size={16} />, label: 'Dashboard'            },
  { to: '/requests',      icon: <FileText         size={16} />, label: 'Fila de solicitações' },
  { to: '/quotes',        icon: <Receipt          size={16} />, label: 'Orçamentos'           },
  { to: '/clients',       icon: <Briefcase        size={16} />, label: 'Clientes'             },
  { to: '/reports',       icon: <BarChart2        size={16} />, label: 'Relatórios'           },
  { to: '/profile',       icon: <Users            size={16} />, label: 'Perfil'               },
]

const ADMIN_NAV: NavItem[] = [
  { to: '/dashboard',     icon: <LayoutDashboard size={16} />, label: 'Dashboard'            },
  { to: '/requests',      icon: <FileText         size={16} />, label: 'Solicitações'         },
  { to: '/quotes',        icon: <Receipt          size={16} />, label: 'Orçamentos'           },
  { to: '/clients',       icon: <Briefcase        size={16} />, label: 'Clientes'             },
  { to: '/users',         icon: <Users            size={16} />, label: 'Usuários'             },
  { to: '/price-tables',  icon: <DollarSign       size={16} />, label: 'Tabela de preços'    },
  { to: '/service-types', icon: <Tags             size={16} />, label: 'Tipos de serviço'    },
  { to: '/reports',       icon: <BarChart2        size={16} />, label: 'Relatórios'           },
  { to: '/settings',      icon: <Settings         size={16} />, label: 'Configurações'        },
  { to: '/profile',       icon: <Users            size={16} />, label: 'Perfil'               },
]

export default function AppLayout() {
  const role   = useRole()
  const user   = useAuthStore(s => s.user)
  const logout = useAuthStore(s => s.logout)

  const nav = role === 'CLIENT' ? CLIENT_NAV : role === 'ADMIN' ? ADMIN_NAV : ANALYST_NAV

  const roleLabel = role === 'CLIENT' ? 'Cliente' : role === 'ADMIN' ? 'Administrador' : 'Analista'

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-brand-500 flex items-center justify-center">
              <Receipt size={14} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-tight">Portal</p>
              <p className="text-xs text-surface-400 leading-tight">Orçamentos</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/dashboard'}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-brand-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-brand-300">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-surface-400">{roleLabel}</p>
            </div>
            <button onClick={logout} className="btn-ghost p-1.5 text-surface-400 hover:text-white"
              title="Sair">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="main-content flex-1">
        <Outlet />
      </div>
    </div>
  )
}
