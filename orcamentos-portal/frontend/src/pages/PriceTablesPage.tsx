// ============================================================
// Tabela de Preços — CRUD (Admin)
// ============================================================
import React, { useEffect, useMemo, useState } from 'react'
import {
  Plus, Edit3, Trash2, Search, Check, Copy,
} from 'lucide-react'
import {
  useClients, usePriceTables, usePriceTable,
  useCreatePriceTable, useCreatePriceItem, useUpdatePriceItem, useDeletePriceItem, useDeletePriceTable,
} from '../hooks/queries'
import { useServiceTypes } from '../hooks/queries'
import {
  Modal, FormField, Alert, Spinner, EmptyState, PageLoader,
} from '../components/ui'
import { formatCurrency } from '../lib/constants'
import { extractApiError } from '../lib/api'
import { api } from '../lib/api'
import { useQueryClient } from '@tanstack/react-query'

export default function PriceTablesPage() {
  const [selectedClientId, setSelectedClientId] = useState('')
  const [selectedTableId,  setSelectedTableId]  = useState('')
  const [searchItems,      setSearchItems]       = useState('')
  const [stFilter,         setSTFilter]          = useState('')
  const [apiError,         setApiError]          = useState('')

  const qc = useQueryClient()

  const { data: clientsData } = useClients({ limit: 100 })
  const clients = useMemo(() => clientsData?.data ?? [], [clientsData?.data])

  useEffect(() => {
    if (!clients.length) {
      return
    }

    const selectedClientStillExists = clients.some((client: any) => client.id === selectedClientId)

    if (!selectedClientId || !selectedClientStillExists) {
      setSelectedClientId(clients[0].id)
      setSelectedTableId('')
    }
  }, [clients, selectedClientId])

  const { data: tables = [], isLoading: loadingTables } = usePriceTables(selectedClientId, true)
  const defaultTable = tables.find((t: any) => t.status === 'ACTIVE') ?? tables[0]
  const activeTable = tables.find((t: any) => t.id === selectedTableId) ?? defaultTable

  const { data: tableDetail, isLoading: loadingItems } = usePriceTable(
    selectedClientId, activeTable?.id ?? '',
    { q: searchItems || undefined, serviceTypeId: stFilter || undefined, includeInactive: false },
  )
  const priceItems = tableDetail?.items ?? []

  const { data: serviceTypes = [] } = useServiceTypes()
  const createTable = useCreatePriceTable()
  const createItem  = useCreatePriceItem()
  const updateItem  = useUpdatePriceItem()
  const deleteItem  = useDeletePriceItem()
  const deleteTable = useDeletePriceTable()

  // Modais
  const [tableModal, setTableModal] = useState<{ open: boolean; mode: 'create' | 'edit' }>({ open: false, mode: 'create' })
  const [itemModal,  setItemModal]  = useState<{ open: boolean; item?: any }>({ open: false })
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; itemId: string } | null>(null)
  const [deleteTableConfirm, setDeleteTableConfirm] = useState(false)

  const [tableForm, setTableForm] = useState({ name: '', description: '' })
  const [itemForm,  setItemForm]  = useState({
    code: '', description: '', unit: 'un', unitValue: '', serviceTypeId: '', notes: '', sortOrder: 0,
  })

  const handleCreateTable = async () => {
    if (!selectedClientId) return
    try {
      const templateTable = activeTable ?? defaultTable
      let result: any

      // Regra: nova tabela já nasce com o modelo padrão para acelerar cadastro.
      if (templateTable?.id) {
        result = await api
          .post(`/api/v1/clients/${selectedClientId}/price-tables/${templateTable.id}/clone`, {
            newName: tableForm.name,
          })
          .then((r) => r.data)
      } else {
        result = await createTable.mutateAsync({ clientId: selectedClientId, data: tableForm })
      }

      setSelectedTableId(result.id)
      setTableModal({ open: false, mode: 'create' })
      setTableForm({ name: '', description: '' })
      await qc.invalidateQueries({ queryKey: ['price-tables', selectedClientId] })
      await qc.invalidateQueries({ queryKey: ['price-tables', selectedClientId, result.id] })
    } catch (err) { setApiError(extractApiError(err)) }
  }

  const handleCreateItem = async () => {
    if (!activeTable?.id) return
    try {
      if (itemModal.item) {
        await updateItem.mutateAsync({
          clientId: selectedClientId, tableId: activeTable.id,
          itemId: itemModal.item.id,
          data: { ...itemForm, unitValue: Number(itemForm.unitValue) },
        })
      } else {
        await createItem.mutateAsync({
          clientId: selectedClientId, tableId: activeTable.id,
          data: { ...itemForm, unitValue: Number(itemForm.unitValue) },
        })
      }
      setItemModal({ open: false })
      setItemForm({ code: '', description: '', unit: 'un', unitValue: '', serviceTypeId: '', notes: '', sortOrder: 0 })
    } catch (err) { setApiError(extractApiError(err)) }
  }

  const handleDeleteItem = async () => {
    if (!deleteConfirm || !activeTable?.id) return
    try {
      await deleteItem.mutateAsync({ clientId: selectedClientId, tableId: activeTable.id, itemId: deleteConfirm.itemId })
      setDeleteConfirm(null)
    } catch (err) { setApiError(extractApiError(err)) }
  }

  const openEditItem = (item: any) => {
    setItemForm({
      code:          item.code ?? '',
      description:   item.description,
      unit:          item.unit,
      unitValue:     String(item.unitValue),
      serviceTypeId: item.serviceTypeId ?? '',
      notes:         item.notes ?? '',
      sortOrder:     item.sortOrder ?? 0,
    })
    setItemModal({ open: true, item })
  }

  const handleCloneTable = async () => {
    if (!activeTable?.id) return
    try {
      await api.post(`/api/v1/clients/${selectedClientId}/price-tables/${activeTable.id}/clone`, {
        newName: `${activeTable.name} (cópia)`,
      })
      qc.invalidateQueries({ queryKey: ['price-tables', selectedClientId] })
    } catch (err) { setApiError(extractApiError(err)) }
  }

  const handleDeleteTable = async () => {
    if (!activeTable?.id || !selectedClientId) return
    try {
      await deleteTable.mutateAsync({ clientId: selectedClientId, tableId: activeTable.id })
      setDeleteTableConfirm(false)
      setSelectedTableId('')
      await qc.invalidateQueries({ queryKey: ['price-tables', selectedClientId] })
    } catch (err) {
      setApiError(extractApiError(err))
    }
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="font-semibold text-surface-900">Tabela de Preços</h1>
      </div>

      <div className="page-body space-y-5">
        {apiError && <Alert type="error" message={apiError} />}

        {/* Seleção de cliente */}
        <div className="card">
          <div className="card-body">
            <FormField label="Selecione o cliente">
              <select
                value={selectedClientId}
                onChange={e => { setSelectedClientId(e.target.value); setSelectedTableId('') }}
                className="form-input appearance-none max-w-sm"
              >
                <option value="">— Selecione um cliente —</option>
                {clients.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </FormField>
          </div>
        </div>

        {selectedClientId && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            {/* Lista de tabelas */}
            <div className="lg:col-span-1">
              <div className="card">
                <div className="card-header">
                  <span className="text-sm font-semibold">Tabelas</span>
                  <button className="btn-primary btn-sm p-1.5"
                    onClick={() => { setTableModal({ open: true, mode: 'create' }); setTableForm({ name: '', description: '' }) }}>
                    <Plus size={14} />
                  </button>
                </div>
                <div className="card-body p-2">
                  {loadingTables ? <Spinner size="sm" className="text-brand-400 mx-auto block my-4" /> :
                    tables.length === 0
                    ? <p className="text-xs text-center text-surface-400 py-4">Nenhuma tabela</p>
                    : tables.map((t: any) => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTableId(t.id)}
                        className={`w-full text-left px-3 py-2.5 rounded text-sm transition-all
                          ${(selectedTableId === t.id || (!selectedTableId && t.id === defaultTable?.id))
                            ? 'bg-brand-50 text-brand-700 font-medium'
                            : 'hover:bg-surface-50 text-surface-700'}`}
                      >
                        <p className="font-medium truncate">{t.name}</p>
                        <p className="text-xs text-surface-400">
                          v{t.version} · {t.status === 'ACTIVE' ? '✅ Ativa' : t.status === 'ARCHIVED' ? '📦 Arquivada' : '⏸️ Inativa'}
                        </p>
                      </button>
                    ))
                  }
                </div>
              </div>
            </div>

            {/* Itens da tabela */}
            <div className="lg:col-span-3">
              {!activeTable
                ? <EmptyState title="Selecione ou crie uma tabela de preços" />
                : (
                  <div className="card">
                    <div className="card-header">
                      <div>
                        <span className="text-sm font-semibold">{activeTable.name}</span>
                        <p className="text-xs text-surface-400">v{activeTable.version} · {priceItems.length} itens ativos</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="btn-ghost btn-sm" onClick={handleCloneTable} title="Clonar tabela">
                          <Copy size={14} />
                        </button>
                        <button
                          className="btn-ghost btn-sm text-red-500 hover:text-red-600"
                          onClick={() => setDeleteTableConfirm(true)}
                          title="Excluir tabela"
                        >
                          <Trash2 size={14} />
                        </button>
                        <button className="btn-primary btn-sm"
                          onClick={() => { setItemModal({ open: true }); setItemForm({ code: '', description: '', unit: 'un', unitValue: '', serviceTypeId: '', notes: '', sortOrder: 0 }) }}>
                          <Plus size={14} /> Novo item
                        </button>
                      </div>
                    </div>
                    <div className="card-body space-y-3">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-400" />
                          <input value={searchItems} onChange={e => setSearchItems(e.target.value)}
                            placeholder="Buscar por código ou descrição..."
                            className="form-input pl-8 text-sm" />
                        </div>
                        <select value={stFilter} onChange={e => setSTFilter(e.target.value)}
                          className="form-input appearance-none text-sm max-w-[180px]">
                          <option value="">Todos os tipos</option>
                          {serviceTypes.map((st: any) => (
                            <option key={st.id} value={st.id}>{st.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {loadingItems ? <PageLoader /> :
                      priceItems.length === 0
                      ? (
                        <div className="card-body">
                          <EmptyState
                            title="Nenhum item encontrado"
                            desc="Crie itens para esta tabela de preços"
                            action={
                              <button className="btn-primary btn-sm"
                                onClick={() => setItemModal({ open: true })}>
                                <Plus size={13} /> Criar primeiro item
                              </button>
                            }
                          />
                        </div>
                      )
                      : (
                        <div className="overflow-x-auto">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Código</th>
                                <th>Descrição</th>
                                <th>Tipo de serviço</th>
                                <th>Unidade</th>
                                <th className="text-right">Valor</th>
                                <th>Ações</th>
                              </tr>
                            </thead>
                            <tbody>
                              {priceItems.map((item: any) => (
                                <tr key={item.id}>
                                  <td className="font-mono text-xs text-surface-500">{item.code}</td>
                                  <td>
                                    <p className="text-sm font-medium">{item.description}</p>
                                    {item.notes && <p className="text-xs text-surface-400">{item.notes}</p>}
                                  </td>
                                  <td className="text-xs text-surface-500">{item.serviceType?.name ?? '—'}</td>
                                  <td className="text-xs">{item.unit}</td>
                                  <td className="text-right font-semibold text-sm text-brand-600">
                                    {formatCurrency(parseFloat(item.unitValue))}
                                  </td>
                                  <td>
                                    <div className="flex items-center gap-1">
                                      <button className="btn-ghost btn-sm p-1" onClick={() => openEditItem(item)}>
                                        <Edit3 size={13} />
                                      </button>
                                      <button className="btn-ghost btn-sm p-1 text-red-400 hover:text-red-600"
                                        onClick={() => setDeleteConfirm({ open: true, itemId: item.id })}>
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    }
                  </div>
                )
              }
            </div>
          </div>
        )}
      </div>

      {/* Modal — Criar tabela */}
      <Modal open={tableModal.open} onClose={() => setTableModal({ open: false, mode: 'create' })}
        title="Nova tabela de preços"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setTableModal({ open: false, mode: 'create' })}>Cancelar</button>
            <button className="btn-primary" onClick={handleCreateTable} disabled={createTable.isPending}>
              {createTable.isPending ? <Spinner size="sm" /> : <Plus size={14} />} Criar
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <FormField label="Nome da tabela" required>
            <input value={tableForm.name} onChange={e => setTableForm(v => ({ ...v, name: e.target.value }))}
              className="form-input" placeholder="Ex: Tabela 2024 — Instalações" />
          </FormField>
          <FormField label="Descrição">
            <textarea rows={2} value={tableForm.description}
              onChange={e => setTableForm(v => ({ ...v, description: e.target.value }))}
              className="form-input resize-none" />
          </FormField>
          <p className="text-xs text-surface-400">
            A nova tabela será criada com base no modelo padrão atual e você poderá ajustar os itens depois.
          </p>
        </div>
      </Modal>

      {/* Modal — Criar/editar item */}
      <Modal open={itemModal.open} onClose={() => setItemModal({ open: false })}
        title={itemModal.item ? 'Editar item' : 'Novo item'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setItemModal({ open: false })}>Cancelar</button>
            <button className="btn-primary" onClick={handleCreateItem}
              disabled={createItem.isPending || updateItem.isPending}>
              {(createItem.isPending || updateItem.isPending) ? <Spinner size="sm" /> : <Check size={14} />}
              {itemModal.item ? 'Salvar' : 'Criar'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Código">
              <input value={itemForm.code} onChange={e => setItemForm(v => ({ ...v, code: e.target.value }))}
                className="form-input font-mono" placeholder="ATV-001" />
            </FormField>
            <FormField label="Tipo de serviço">
              <select value={itemForm.serviceTypeId}
                onChange={e => setItemForm(v => ({ ...v, serviceTypeId: e.target.value }))}
                className="form-input appearance-none">
                <option value="">Geral</option>
                {serviceTypes.map((st: any) => (
                  <option key={st.id} value={st.id}>{st.name}</option>
                ))}
              </select>
            </FormField>
          </div>
          <FormField label="Descrição" required>
            <input value={itemForm.description}
              onChange={e => setItemForm(v => ({ ...v, description: e.target.value }))}
              className="form-input" placeholder="Descrição do item ou serviço" />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Unidade">
              <select value={itemForm.unit} onChange={e => setItemForm(v => ({ ...v, unit: e.target.value }))}
                className="form-input appearance-none">
                {['un','m','m²','m³','h','cx','kg','l','vb','km'].map(u => <option key={u}>{u}</option>)}
              </select>
            </FormField>
            <FormField label="Valor unitário (R$)" required>
              <input type="number" min="0" step="0.01"
                value={itemForm.unitValue}
                onChange={e => setItemForm(v => ({ ...v, unitValue: e.target.value }))}
                className="form-input" placeholder="0,00" />
            </FormField>
          </div>
          <FormField label="Observações">
            <input value={itemForm.notes} onChange={e => setItemForm(v => ({ ...v, notes: e.target.value }))}
              className="form-input" placeholder="Informações adicionais sobre o item..." />
          </FormField>
        </div>
      </Modal>

      {/* Confirmação de exclusão */}
      {deleteConfirm?.open && (
        <Modal open onClose={() => setDeleteConfirm(null)} title="Desativar item"
          footer={
            <>
              <button className="btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button className="btn-danger" onClick={handleDeleteItem} disabled={deleteItem.isPending}>
                {deleteItem.isPending ? <Spinner size="sm" /> : <Trash2 size={14} />} Desativar
              </button>
            </>
          }
        >
          <p className="text-sm text-surface-600">O item será desativado e não aparecerá mais na tabela. Orçamentos existentes não serão afetados.</p>
        </Modal>
      )}

      {deleteTableConfirm && activeTable && (
        <Modal
          open
          onClose={() => setDeleteTableConfirm(false)}
          title="Excluir tabela de preços"
          footer={
            <>
              <button className="btn-secondary" onClick={() => setDeleteTableConfirm(false)}>Cancelar</button>
              <button className="btn-danger" onClick={handleDeleteTable} disabled={deleteTable.isPending}>
                {deleteTable.isPending ? <Spinner size="sm" /> : <Trash2 size={14} />} Excluir tabela
              </button>
            </>
          }
        >
          <p className="text-sm text-surface-600">
            A tabela <strong>{activeTable.name}</strong> será arquivada e não aparecerá mais como opção ativa.
          </p>
        </Modal>
      )}
    </div>
  )
}
