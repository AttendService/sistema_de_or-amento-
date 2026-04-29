// ============================================================
// Usuários — Admin
// ============================================================
import React, { useState } from 'react'
import { Plus, Edit3, Search, Shield } from 'lucide-react'
import { useUsers, useCreateUser, useUpdateUser, useClients } from '../hooks/queries'
import { Modal, FormField, Alert, Spinner, PageLoader, EmptyState, Pagination } from '../components/ui'
import { formatDateTime } from '../lib/constants'
import { api, extractApiError } from '../lib/api'

const ROLE_LABEL: Record<string, string> = {
  CLIENT: 'Cliente',
  ANALYST: 'Analista',
  ADMIN: 'Administrador',
  SUPER_ADMIN: 'Super Administrador',
}
const ROLE_COLOR: Record<string, string> = {
  CLIENT: 'bg-blue-50 text-blue-700',
  ANALYST: 'bg-purple-50 text-purple-700',
  ADMIN: 'bg-amber-50 text-amber-700',
  SUPER_ADMIN: 'bg-red-50 text-red-700',
}
const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'text-emerald-600', INACTIVE: 'text-surface-400', SUSPENDED: 'text-red-500',
}

export default function UsersPage() {
  const [page,  setPage]  = useState(1)
  const [q,     setQ]     = useState('')
  const [role,  setRole]  = useState('')

  const { data, isLoading } = useUsers({ page, limit: 20, q: q || undefined, role: role || undefined })
  const users      = data?.data ?? []
  const totalPages = data?.meta?.totalPages ?? 1

  const createUser = useCreateUser()
  const updateUser = useUpdateUser()

  const { data: clientsData } = useClients({ limit: 100 })
  const clients = clientsData?.data ?? []

  const [modal,    setModal]    = useState<{ open: boolean; user?: any }>({ open: false })
  const [apiError, setApiError] = useState('')

  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'CLIENT' as string,
    status: 'ACTIVE' as string,
    clientIds: [] as string[],
  })

  const openCreate = () => {
    setForm({ name: '', email: '', password: '', role: 'CLIENT', status: 'ACTIVE', clientIds: [] })
    setModal({ open: true })
  }
  const openEdit = (user: any) => {
    const linkedClientIds = user.clientUsers?.map((cu: any) => cu.clientId) || []
    setForm({ 
      name: user.name, email: user.email, password: '', 
      role: user.role, status: user.status, clientIds: linkedClientIds 
    })
    setModal({ open: true, user })
  }

  const handleSubmit = async () => {
    setApiError('')
    try {
      if (form.role === 'CLIENT' && form.clientIds.length === 0) {
        setApiError('Selecione ao menos um cliente para vincular.')
        return
      }

      if (modal.user) {
        const data: Record<string, unknown> = { name: form.name, email: form.email, role: form.role, status: form.status }
        if (form.password) data.password = form.password
        await updateUser.mutateAsync({ id: modal.user.id, data })

        // Sincronizar clientes de forma determinística para evitar conflitos
        if (form.role === 'CLIENT') {
          await api.put(`/api/v1/users/${modal.user.id}/clients`, {
            clientIds: form.clientIds,
            defaultClientId: form.clientIds[0],
          })
        }
      } else {
        await createUser.mutateAsync(form)
      }
      setModal({ open: false })
    } catch (err) {
      setApiError(extractApiError(err))
    }
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="font-semibold text-surface-900">Usuários</h1>
          {!isLoading && <p className="text-xs text-surface-400">{data?.meta?.total ?? 0} usuários</p>}
        </div>
        <button className="btn-primary btn-sm" onClick={openCreate}>
          <Plus size={14} /> Novo usuário
        </button>
      </div>

      <div className="page-body space-y-4">
        {/* Filtros */}
        <div className="flex gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input value={q} onChange={e => { setQ(e.target.value); setPage(1) }}
              placeholder="Buscar por nome ou e-mail..."
              className="form-input pl-9" />
          </div>
          <select value={role} onChange={e => { setRole(e.target.value); setPage(1) }}
            className="form-input appearance-none max-w-[160px]">
            <option value="">Todos os perfis</option>
            <option value="CLIENT">Cliente</option>
            <option value="ANALYST">Analista</option>
            <option value="ADMIN">Administrador</option>
          </select>
        </div>

        <div className="card overflow-hidden">
          {isLoading ? <PageLoader /> : users.length === 0
            ? <EmptyState title="Nenhum usuário encontrado"
                action={<button className="btn-primary btn-sm" onClick={openCreate}><Plus size={13} /> Criar usuário</button>} />
            : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Perfil</th>
                    <th>Status</th>
                    <th>Clientes vinculados</th>
                    <th>Último acesso</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u: any) => (
                    <tr key={u.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-xs font-semibold text-brand-600 flex-shrink-0">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-surface-800">{u.name}</p>
                            <p className="text-xs text-surface-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${ROLE_COLOR[u.role]}`}>
                          <Shield size={10} /> {ROLE_LABEL[u.role]}
                        </span>
                      </td>
                      <td>
                        <span className={`text-xs font-medium ${STATUS_COLOR[u.status]}`}>
                          {u.status === 'ACTIVE' ? '● Ativo' : u.status === 'INACTIVE' ? '○ Inativo' : '⊘ Suspenso'}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {u.clientUsers?.slice(0, 2).map((cu: any) => (
                            <span key={cu.clientId} className="text-xs bg-surface-100 text-surface-600 px-1.5 py-0.5 rounded">
                              {cu.client.name}{cu.isDefault ? ' ★' : ''}
                            </span>
                          ))}
                          {u.clientUsers?.length > 2 && (
                            <span className="text-xs text-surface-400">+{u.clientUsers.length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className="text-xs text-surface-500">{formatDateTime(u.lastLoginAt)}</td>
                      <td>
                        <button className="btn-ghost btn-sm p-1.5" onClick={() => openEdit(u)}>
                          <Edit3 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </div>

        <Pagination page={page} totalPages={totalPages} onPage={setPage} />
      </div>

      {/* Modal */}
      <Modal open={modal.open} onClose={() => { setModal({ open: false }); setApiError('') }}
        title={modal.user ? 'Editar usuário' : 'Novo usuário'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setModal({ open: false }); setApiError('') }}>Cancelar</button>
            <button className="btn-primary" onClick={handleSubmit}
              disabled={createUser.isPending || updateUser.isPending}>
              {(createUser.isPending || updateUser.isPending) ? <Spinner size="sm" /> : null}
              {modal.user ? 'Salvar' : 'Criar usuário'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {apiError && <Alert type="error" message={apiError} />}
          <FormField label="Nome completo" required>
            <input value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))}
              className="form-input" placeholder="Nome do usuário" />
          </FormField>
          <FormField label="E-mail" required>
            <input type="email" value={form.email} onChange={e => setForm(v => ({ ...v, email: e.target.value }))}
              className="form-input" placeholder="usuario@email.com" />
          </FormField>
          <FormField label={modal.user ? 'Nova senha (deixe em branco para manter)' : 'Senha'} required={!modal.user}>
            <input type="password" value={form.password}
              onChange={e => setForm(v => ({ ...v, password: e.target.value }))}
              className="form-input" placeholder="Mínimo 8 caracteres" />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Perfil">
              <select value={form.role} onChange={e => setForm(v => ({ ...v, role: e.target.value, clientIds: [] }))}
                className="form-input appearance-none">
                <option value="CLIENT">Cliente</option>
                <option value="ANALYST">Analista</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </FormField>
            <FormField label="Status">
              <select value={form.status} onChange={e => setForm(v => ({ ...v, status: e.target.value }))}
                className="form-input appearance-none">
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
                <option value="SUSPENDED">Suspenso</option>
              </select>
            </FormField>
          </div>
          {form.role === 'CLIENT' && (
            <FormField label="Cliente a vincular" required error={form.clientIds.length === 0 ? "Selecione ao menos um cliente" : ""}>
              <select 
                value={form.clientIds[0] || ""} 
                onChange={e => setForm(v => ({ ...v, clientIds: e.target.value ? [e.target.value] : [] }))}
                className="form-input appearance-none">
                <option value="">Selecione o Cliente</option>
                {clients.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </FormField>
          )}
        </div>
      </Modal>
    </div>
  )
}
