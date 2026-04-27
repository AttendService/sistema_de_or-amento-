// ============================================================
// Clientes — Analista/Admin
// ============================================================
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, Eye, Edit3, Building2, Users, FileText,
} from 'lucide-react'
import { useClients, useClient, useCreateUser } from '../hooks/queries'
import { useRole } from '../store/auth.store'
import { api, extractApiError } from '../lib/api'
import {
  Modal, FormField, Alert, Spinner, PageLoader, EmptyState, Pagination,
} from '../components/ui'
import { formatDate } from '../lib/constants'
import { useQueryClient } from '@tanstack/react-query'

export default function ClientsPage() {
  const navigate  = useNavigate()
  const role      = useRole()
  const qc        = useQueryClient()

  const [page,  setPage]  = useState(1)
  const [q,     setQ]     = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [createModal, setCreateModal] = useState(false)
  const [apiError, setApiError]       = useState('')

  const { data, isLoading } = useClients({ page, limit: 20, q: q || undefined })
  const clients    = data?.data ?? []
  const totalPages = data?.meta?.totalPages ?? 1
  const total      = data?.meta?.total ?? 0

  const { data: detail, isLoading: loadingDetail } = useClient(selected ?? '')

  const [form, setForm] = useState({
    name: '', tradeName: '', document: '', email: '', phone: '',
  })

  const handleCreate = async () => {
    setApiError('')
    try {
      await api.post('/api/v1/clients', form)
      qc.invalidateQueries({ queryKey: ['clients'] })
      setCreateModal(false)
      setForm({ name: '', tradeName: '', document: '', email: '', phone: '' })
    } catch (err) {
      setApiError(extractApiError(err))
    }
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="font-semibold text-surface-900">Clientes</h1>
          {!isLoading && <p className="text-xs text-surface-400">{total} clientes</p>}
        </div>
        {role === 'ADMIN' && (
          <button className="btn-primary btn-sm" onClick={() => setCreateModal(true)}>
            <Plus size={14} /> Novo cliente
          </button>
        )}
      </div>

      <div className="page-body">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Lista */}
          <div className="lg:col-span-1 space-y-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
              <input
                value={q}
                onChange={e => { setQ(e.target.value); setPage(1) }}
                placeholder="Buscar cliente..."
                className="form-input pl-9"
              />
            </div>

            <div className="card overflow-hidden">
              {isLoading ? <PageLoader /> : clients.length === 0
                ? <EmptyState title="Nenhum cliente encontrado" />
                : (
                  <div>
                    {clients.map((c: any) => (
                      <button
                        key={c.id}
                        onClick={() => setSelected(c.id)}
                        className={`w-full text-left px-4 py-3 border-b border-surface-50 last:border-0 transition-all
                          ${selected === c.id ? 'bg-brand-50 border-l-2 border-l-brand-500' : 'hover:bg-surface-50'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center flex-shrink-0">
                            <Building2 size={14} className="text-surface-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-surface-800 truncate">{c.name}</p>
                            {c.tradeName && (
                              <p className="text-xs text-surface-400 truncate">{c.tradeName}</p>
                            )}
                            <p className="text-xs text-surface-400">
                              {c._count?.requests ?? 0} solicitação{c._count?.requests !== 1 ? 'ões' : ''}
                            </p>
                          </div>
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${c.isActive ? 'bg-emerald-400' : 'bg-surface-300'}`} />
                        </div>
                      </button>
                    ))}
                  </div>
                )
              }
            </div>
            <Pagination page={page} totalPages={totalPages} onPage={setPage} />
          </div>

          {/* Detalhe */}
          <div className="lg:col-span-2">
            {!selected
              ? (
                <div className="card h-64 flex items-center justify-center">
                  <EmptyState
                    icon={<Building2 className="w-full h-full" />}
                    title="Selecione um cliente"
                    desc="Clique em um cliente para ver os detalhes"
                  />
                </div>
              )
              : loadingDetail
              ? <PageLoader />
              : detail && (
                <div className="space-y-4 fade-in">
                  {/* Cabeçalho */}
                  <div className="card">
                    <div className="card-header">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-brand-100 flex items-center justify-center">
                          <Building2 size={18} className="text-brand-600" />
                        </div>
                        <div>
                          <h2 className="font-semibold text-surface-900">{detail.name}</h2>
                          {detail.tradeName && <p className="text-sm text-surface-500">{detail.tradeName}</p>}
                        </div>
                      </div>
                      <span className={`badge ${detail.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-surface-100 text-surface-500'}`}>
                        {detail.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    <div className="card-body">
                      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                        {detail.document && (
                          <div>
                            <dt className="text-xs text-surface-400">Documento</dt>
                            <dd className="font-mono">{detail.document}</dd>
                          </div>
                        )}
                        {detail.email && (
                          <div>
                            <dt className="text-xs text-surface-400">E-mail</dt>
                            <dd>{detail.email}</dd>
                          </div>
                        )}
                        {detail.phone && (
                          <div>
                            <dt className="text-xs text-surface-400">Telefone</dt>
                            <dd>{detail.phone}</dd>
                          </div>
                        )}
                        <div>
                          <dt className="text-xs text-surface-400">Cadastrado em</dt>
                          <dd>{formatDate(detail.createdAt)}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  {/* Usuários vinculados */}
                  <div className="card">
                    <div className="card-header">
                      <span className="text-sm font-semibold flex items-center gap-2">
                        <Users size={14} className="text-surface-400" />
                        Usuários ({detail.clientUsers?.length ?? 0})
                      </span>
                    </div>
                    <div className="card-body">
                      {detail.clientUsers?.length === 0
                        ? <p className="text-sm text-surface-400 text-center py-3">Nenhum usuário vinculado</p>
                        : (
                          <div className="space-y-2">
                            {detail.clientUsers?.map((cu: any) => (
                              <div key={cu.userId} className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-xs font-semibold text-brand-600">
                                  {cu.user.name.charAt(0)}
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-medium">{cu.user.name}</p>
                                  <p className="text-xs text-surface-400">{cu.user.email}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {cu.isDefault && (
                                    <span className="badge bg-brand-50 text-brand-700 text-xs">Padrão</span>
                                  )}
                                  <span className={`text-xs ${cu.user.status === 'ACTIVE' ? 'text-emerald-600' : 'text-surface-400'}`}>
                                    {cu.user.status === 'ACTIVE' ? '● Ativo' : '○ Inativo'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      }
                    </div>
                  </div>

                  {/* Tabelas de preços */}
                  <div className="card">
                    <div className="card-header">
                      <span className="text-sm font-semibold">Tabelas de preços</span>
                      {role === 'ADMIN' && (
                        <button className="btn-ghost btn-sm text-xs"
                          onClick={() => navigate('/price-tables')}>
                          Gerenciar →
                        </button>
                      )}
                    </div>
                    <div className="card-body">
                      {detail.priceTables?.length === 0
                        ? <p className="text-sm text-surface-400 text-center py-3">Nenhuma tabela de preços</p>
                        : (
                          <div className="space-y-2">
                            {detail.priceTables?.map((pt: any) => (
                              <div key={pt.id} className="flex items-center justify-between text-sm">
                                <div>
                                  <p className="font-medium">{pt.name}</p>
                                  <p className="text-xs text-surface-400">v{pt.version} · {formatDate(pt.createdAt)}</p>
                                </div>
                                <span className={`badge ${pt.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-surface-100 text-surface-500'}`}>
                                  {pt.status === 'ACTIVE' ? 'Ativa' : pt.status === 'ARCHIVED' ? 'Arquivada' : 'Inativa'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )
                      }
                    </div>
                  </div>

                  {/* Atalho para solicitações */}
                  <button
                    className="btn-secondary w-full"
                    onClick={() => navigate(`/requests?clientId=${detail.id}`)}
                  >
                    <FileText size={14} /> Ver solicitações deste cliente
                  </button>
                </div>
              )
            }
          </div>
        </div>
      </div>

      {/* Modal criar cliente */}
      <Modal open={createModal} onClose={() => { setCreateModal(false); setApiError('') }}
        title="Novo cliente"
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setCreateModal(false); setApiError('') }}>Cancelar</button>
            <button className="btn-primary" onClick={handleCreate}>
              <Plus size={14} /> Criar
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {apiError && <Alert type="error" message={apiError} />}
          <FormField label="Razão social / Nome" required>
            <input value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))}
              className="form-input" placeholder="Nome do cliente" />
          </FormField>
          <FormField label="Nome fantasia">
            <input value={form.tradeName} onChange={e => setForm(v => ({ ...v, tradeName: e.target.value }))}
              className="form-input" placeholder="Nome fantasia" />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="CNPJ / CPF">
              <input value={form.document} onChange={e => setForm(v => ({ ...v, document: e.target.value }))}
                className="form-input font-mono" placeholder="00.000.000/0001-00" />
            </FormField>
            <FormField label="Telefone">
              <input value={form.phone} onChange={e => setForm(v => ({ ...v, phone: e.target.value }))}
                className="form-input" placeholder="(11) 99999-9999" />
            </FormField>
          </div>
          <FormField label="E-mail">
            <input type="email" value={form.email} onChange={e => setForm(v => ({ ...v, email: e.target.value }))}
              className="form-input" placeholder="contato@empresa.com" />
          </FormField>
        </div>
      </Modal>
    </div>
  )
}
