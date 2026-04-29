// ============================================================
// Tipos de Serviço — CRUD Admin
// ============================================================
import React, { useState } from 'react'
import { Plus, Edit3, Tags } from 'lucide-react'
import { useServiceTypes } from '../hooks/queries'
import { api, extractApiError } from '../lib/api'
import { Modal, FormField, Alert, Spinner, PageLoader } from '../components/ui'
import { useQueryClient } from '@tanstack/react-query'

export default function ServiceTypesPage() {
  const qc = useQueryClient()
  const { data: types = [], isLoading } = useServiceTypes(true)

  const [modal,    setModal]    = useState<{ open: boolean; item?: any }>({ open: false })
  const [apiError, setApiError] = useState('')
  const [saving,   setSaving]   = useState(false)

  const [form, setForm] = useState({
    name: '', description: '', sortOrder: 0, status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  })

  const openCreate = () => {
    setForm({ name: '', description: '', sortOrder: (types.length * 10), status: 'ACTIVE' })
    setModal({ open: true })
  }

  const openEdit = (item: any) => {
    setForm({
      name:        item.name,
      description: item.description ?? '',
      sortOrder:   item.sortOrder,
      status:      item.status,
    })
    setModal({ open: true, item })
  }

  const handleSubmit = async () => {
    setApiError('')
    setSaving(true)
    try {
      if (modal.item) {
        await api.patch(`/api/v1/service-types/${modal.item.id}`, form)
      } else {
        await api.post('/api/v1/service-types', form)
      }
      qc.invalidateQueries({ queryKey: ['service-types'] })
      setModal({ open: false })
    } catch (err) {
      setApiError(extractApiError(err))
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (item: any) => {
    try {
      await api.patch(`/api/v1/service-types/${item.id}`, {
        status: item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      })
      qc.invalidateQueries({ queryKey: ['service-types'] })
    } catch (err) {
      setApiError(extractApiError(err))
    }
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="font-semibold text-surface-900">Tipos de Serviço</h1>
          <p className="text-xs text-surface-400">{types.length} tipos cadastrados</p>
        </div>
        <button className="btn-primary btn-sm" onClick={openCreate}>
          <Plus size={14} /> Novo tipo
        </button>
      </div>

      <div className="page-body">
        {apiError && <div className="mb-4"><Alert type="error" message={apiError} /></div>}

        <div className="card overflow-hidden w-full">
          {isLoading ? <PageLoader /> : types.length === 0
            ? (
              <div className="card-body text-center py-12">
                <Tags size={32} className="mx-auto text-surface-300 mb-3" />
                <p className="text-sm text-surface-500">Nenhum tipo de serviço cadastrado</p>
                <button className="btn-primary btn-sm mt-4" onClick={openCreate}>
                  <Plus size={13} /> Criar primeiro tipo
                </button>
              </div>
            )
            : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-12">Ordem</th>
                      <th className="w-[26%]">Nome</th>
                      <th>Descrição</th>
                      <th className="w-28">Status</th>
                      <th className="w-20">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(types as any[])
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((t: any) => (
                      <tr key={t.id}>
                        <td className="text-xs text-surface-400 font-mono">{t.sortOrder}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-brand-100 flex items-center justify-center">
                              <Tags size={12} className="text-brand-600" />
                            </div>
                            <span className="font-medium text-sm">{t.name}</span>
                          </div>
                        </td>
                        <td className="text-sm text-surface-500">{t.description || '—'}</td>
                        <td>
                          <button
                            onClick={() => handleToggle(t)}
                            className={`badge cursor-pointer transition-all hover:opacity-80
                              ${t.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-surface-100 text-surface-400'}`}
                          >
                            <span className={`badge-dot ${t.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-surface-400'}`} />
                            {t.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                          </button>
                        </td>
                        <td>
                          <button className="btn-ghost btn-sm p-1.5" onClick={() => openEdit(t)}>
                            <Edit3 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </div>

        <p className="text-xs text-surface-400 mt-3">
          Clique no status para ativar/desativar. Tipos inativos não aparecem na abertura de solicitações.
        </p>
      </div>

      {/* Modal */}
      <Modal open={modal.open} onClose={() => { setModal({ open: false }); setApiError('') }}
        title={modal.item ? 'Editar tipo de serviço' : 'Novo tipo de serviço'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setModal({ open: false }); setApiError('') }}>Cancelar</button>
            <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? <Spinner size="sm" /> : null}
              {modal.item ? 'Salvar' : 'Criar'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {apiError && <Alert type="error" message={apiError} />}
          <FormField label="Nome" required>
            <input value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))}
              className="form-input" placeholder="Ex: Ativação" />
          </FormField>
          <FormField label="Descrição" hint="Aparece como dica para o usuário na abertura da solicitação">
            <textarea rows={2} value={form.description}
              onChange={e => setForm(v => ({ ...v, description: e.target.value }))}
              className="form-input resize-none" placeholder="Descreva quando usar este tipo..." />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Ordem de exibição" hint="Menor = aparece primeiro">
              <input type="number" min="0" value={form.sortOrder}
                onChange={e => setForm(v => ({ ...v, sortOrder: Number(e.target.value) }))}
                className="form-input" />
            </FormField>
            {modal.item && (
              <FormField label="Status">
                <select value={form.status} onChange={e => setForm(v => ({ ...v, status: e.target.value as 'ACTIVE' | 'INACTIVE' }))}
                  className="form-input appearance-none">
                  <option value="ACTIVE">Ativo</option>
                  <option value="INACTIVE">Inativo</option>
                </select>
              </FormField>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
