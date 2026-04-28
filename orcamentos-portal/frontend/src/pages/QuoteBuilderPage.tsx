// ============================================================
// QuoteBuilder — Montagem do orçamento (analista)
// ============================================================
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, Plus, Trash2, Search, Send, Save,
  Edit3, Check, X,
} from 'lucide-react'
import {
  useRequest, useQuote, usePriceTables, usePriceTable,
  useAddQuoteItem, useUpdateQuoteItem, useDeleteQuoteItem,
  useUpdateQuote, useSendQuote,
} from '../hooks/queries'
import { Alert, Spinner, Modal, FormField } from '../components/ui'
import { formatCurrency } from '../lib/constants'
import { extractApiError } from '../lib/api'

interface Props {
  requestId: string
  quoteId:   string
  onBack?:   () => void
}

type PriceItemDraft = {
  quantity: number
  unitValue: number
}

export default function QuoteBuilderPage({ requestId, quoteId, onBack }: Props) {
  const navigate  = useNavigate()

  const { data: request } = useRequest(requestId)
  const { data: quote, isLoading } = useQuote(requestId, quoteId)

  const addItem      = useAddQuoteItem()
  const updateItem   = useUpdateQuoteItem()
  const deleteItem   = useDeleteQuoteItem()
  const updateQuote  = useUpdateQuote()
  const sendQuote    = useSendQuote()

  // Tabela de preços
  const { data: priceTables = [] } = usePriceTables(request?.clientId ?? '', false)
  const activeTable = priceTables.find((t: any) => t.status === 'ACTIVE') ?? priceTables[0]
  const [selectedTableId,  setSelectedTableId]  = useState<string>('')
  const [priceSearch,      setPriceSearch]      = useState('')
  const [selectedSTFilter, setSelectedSTFilter] = useState('')
  const [priceItemDrafts, setPriceItemDrafts] = useState<Record<string, PriceItemDraft>>({})
  const tableId = selectedTableId || activeTable?.id

  const { data: priceTableData } = usePriceTable(
    request?.clientId ?? '', tableId ?? '',
    { q: priceSearch || undefined, serviceTypeId: selectedSTFilter || undefined },
  )
  const priceItems = priceTableData?.items ?? []

  // Item manual
  const [manualModal, setManualModal] = useState(false)
  const [manualItem,  setManualItem]  = useState({
    description: '', unit: 'un', quantity: 1, unitValue: 0, serviceTypeId: '', code: '',
  })

  // Edição inline de item
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Record<string, unknown>>({})

  // Notas + data estimada
  const [notesOpen,     setNotesOpen]     = useState(false)
  const [technicalNote, setTechnicalNote] = useState(quote?.technicalNotes ?? '')
  const [commercialNote, setCommercialNote] = useState(quote?.commercialNotes ?? '')
  const [estimatedDate, setEstimatedDate]  = useState(quote?.request?.estimatedDate ?? '')
  const [discount,      setDiscount]       = useState(quote?.discount ?? 0)

  const [sendConfirm, setSendConfirm] = useState(false)
  const [apiError,    setApiError]    = useState('')

  if (isLoading || !quote) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Spinner size="lg" className="text-brand-400" />
    </div>
  )

  const isDraft = quote.status === 'DRAFT'
  const items   = quote.items ?? []

  const getDraftForPriceItem = (priceItem: any): PriceItemDraft => {
    const existing = priceItemDrafts[priceItem.id]
    if (existing) return existing
    return {
      quantity: 1,
      unitValue: Number(parseFloat(priceItem.unitValue).toFixed(2)),
    }
  }

  const setDraftForPriceItem = (priceItemId: string, patch: Partial<PriceItemDraft>) => {
    setPriceItemDrafts((prev) => {
      const current = prev[priceItemId] ?? { quantity: 1, unitValue: 0 }
      return {
        ...prev,
        [priceItemId]: {
          ...current,
          ...patch,
        },
      }
    })
  }

  const handleAddFromTable = async (priceItem: any) => {
    const draft = getDraftForPriceItem(priceItem)
    const quantity = Number(draft.quantity)
    const unitValue = Number(draft.unitValue)

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setApiError('Informe uma quantidade maior que zero para adicionar o item.')
      return
    }

    if (!Number.isFinite(unitValue) || unitValue <= 0) {
      setApiError('Informe um valor unitário maior que zero para adicionar o item.')
      return
    }

    try {
      await addItem.mutateAsync({
        requestId, quoteId,
        data: {
          priceItemId:   priceItem.id,
          serviceTypeId: priceItem.serviceTypeId,
          origin:        'TABLE',
          code:          priceItem.code,
          description:   priceItem.description,
          unit:          priceItem.unit,
          quantity,
          unitValue,
        },
      })
    } catch (err) { setApiError(extractApiError(err)) }
  }

  const handleAddManual = async () => {
    try {
      await addItem.mutateAsync({
        requestId, quoteId,
        data: { ...manualItem, origin: 'MANUAL', unitValue: Number(manualItem.unitValue) },
      })
      setManualModal(false)
      setManualItem({ description: '', unit: 'un', quantity: 1, unitValue: 0, serviceTypeId: '', code: '' })
    } catch (err) { setApiError(extractApiError(err)) }
  }

  const handleInlineEdit = async (itemId: string) => {
    try {
      await updateItem.mutateAsync({ requestId, quoteId, itemId, data: editValues })
      setEditingId(null)
    } catch (err) { setApiError(extractApiError(err)) }
  }

  const handleDelete = async (itemId: string) => {
    try {
      await deleteItem.mutateAsync({ requestId, quoteId, itemId })
    } catch (err) { setApiError(extractApiError(err)) }
  }

  const handleSaveNotes = async () => {
    try {
      await updateQuote.mutateAsync({
        requestId, quoteId,
        data: { technicalNotes: technicalNote, commercialNotes: commercialNote, discount: Number(discount), estimatedDate: estimatedDate || null },
      })
      setNotesOpen(false)
    } catch (err) { setApiError(extractApiError(err)) }
  }

  const handleSend = async () => {
    try {
      await sendQuote.mutateAsync({ requestId, quoteId })
      setSendConfirm(false)
      onBack?.()
    } catch (err) {
      setApiError(extractApiError(err))
      setSendConfirm(false)
    }
  }

  const serviceTypes = request?.serviceTypes?.map((st: any) => st.serviceType) ?? []

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="flex items-center gap-2">
          <button onClick={onBack ?? (() => navigate(-1))} className="btn-ghost p-1.5">
            <ChevronLeft size={16} />
          </button>
          <div>
            <h1 className="font-semibold text-surface-900">Montagem de Orçamento</h1>
            <p className="text-xs text-surface-400">{request?.requestNumber} · {request?.finalClientName}</p>
          </div>
        </div>
        {isDraft && (
          <div className="flex items-center gap-2">
            <button className="btn-secondary btn-sm" onClick={() => setNotesOpen(true)}>
              <Edit3 size={14} /> Notas / Data
            </button>
            <button className="btn-primary btn-sm" onClick={() => setSendConfirm(true)}
              disabled={items.length === 0}>
              <Send size={14} /> Enviar ao cliente
            </button>
          </div>
        )}
      </div>

      <div className="page-body">
        {apiError && <div className="mb-4"><Alert type="error" message={apiError} /></div>}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* Coluna esquerda — Tabela de preços */}
          {isDraft && (
            <div className="lg:col-span-2 space-y-3">
              <div className="card">
                <div className="card-header">
                  <span className="text-sm font-semibold">Tabela de preços</span>
                  {priceTables.length > 1 && (
                    <select
                      value={selectedTableId}
                      onChange={e => setSelectedTableId(e.target.value)}
                      className="text-xs border border-surface-200 rounded px-2 py-1 text-surface-600"
                    >
                      {priceTables.map((t: any) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="card-body space-y-2">
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-400" />
                    <input
                      value={priceSearch}
                      onChange={e => setPriceSearch(e.target.value)}
                      placeholder="Buscar item..."
                      className="form-input pl-8 text-xs py-1.5"
                    />
                  </div>
                  <select
                    value={selectedSTFilter}
                    onChange={e => setSelectedSTFilter(e.target.value)}
                    className="form-input text-xs py-1.5 appearance-none"
                  >
                    <option value="">Todos os tipos</option>
                    {serviceTypes.map((st: any) => (
                      <option key={st.id} value={st.id}>{st.name}</option>
                    ))}
                  </select>

                  <div className="max-h-[420px] overflow-y-auto space-y-1 pr-1">
                    {priceItems.length === 0
                      ? <p className="text-xs text-surface-400 text-center py-6">Nenhum item encontrado</p>
                      : priceItems.map((item: any) => (
                        <div
                          key={item.id}
                          className="p-2.5 rounded border border-surface-100 hover:border-brand-200 hover:bg-brand-50/40 transition-all"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-surface-800 truncate">{item.description}</p>
                            <p className="text-xs text-surface-400">{item.code} · {item.unit}</p>
                          </div>
                          <div className="mt-2 grid grid-cols-12 gap-2 items-end">
                            <div className="col-span-3">
                              <p className="text-[10px] uppercase tracking-wide text-surface-400">Qtd</p>
                              <input
                                type="number"
                                min="0.001"
                                step="0.001"
                                value={getDraftForPriceItem(item).quantity}
                                onChange={(e) => setDraftForPriceItem(item.id, { quantity: Number(e.target.value) })}
                                className="form-input text-xs py-1.5"
                              />
                            </div>
                            <div className="col-span-5">
                              <p className="text-[10px] uppercase tracking-wide text-surface-400">Valor unit.</p>
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={getDraftForPriceItem(item).unitValue}
                                onChange={(e) => setDraftForPriceItem(item.id, { unitValue: Number(e.target.value) })}
                                className="form-input text-xs py-1.5"
                              />
                            </div>
                            <div className="col-span-4 flex justify-end">
                              <button
                                className="btn-sm p-1.5 btn-primary"
                                onClick={() => handleAddFromTable(item)}
                                disabled={addItem.isPending}
                                title="Adicionar ao orçamento"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          </div>
                          <p className="mt-1 text-[11px] text-brand-700 font-semibold">
                            Total: {formatCurrency(getDraftForPriceItem(item).quantity * getDraftForPriceItem(item).unitValue)}
                          </p>
                        </div>
                      ))
                    }
                  </div>

                  <button className="btn-secondary btn-sm w-full" onClick={() => setManualModal(true)}>
                    <Plus size={13} /> Item manual
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Coluna direita — Itens do orçamento */}
          <div className={isDraft ? 'lg:col-span-3' : 'lg:col-span-5'}>
            <div className="card">
              <div className="card-header">
                <span className="text-sm font-semibold">Itens do orçamento</span>
                <span className="text-xs text-surface-400">{items.length} item{items.length !== 1 ? 's' : ''}</span>
              </div>

              {items.length === 0
                ? (
                  <div className="card-body">
                    <div className="empty-state py-10">
                      <p className="empty-state-title">Nenhum item adicionado</p>
                      <p className="empty-state-desc">Use a tabela de preços ou adicione um item manual</p>
                    </div>
                  </div>
                )
                : (
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th className="w-8">#</th>
                          <th>Descrição</th>
                          <th>Tipo</th>
                          <th className="text-right w-20">Qtd</th>
                          <th className="text-right w-28">Valor unit.</th>
                          <th className="text-right w-28">Total</th>
                          {isDraft && <th className="w-20">Ações</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item: any, idx: number) => (
                          <tr key={item.id}>
                            <td className="text-surface-400 text-xs">{idx + 1}</td>
                            <td>
                              {editingId === item.id
                                ? (
                                  <input
                                    defaultValue={item.description}
                                    className="form-input text-xs py-1"
                                    onChange={e => setEditValues(v => ({ ...v, description: e.target.value }))}
                                  />
                                )
                                : (
                                  <div>
                                    <p className="text-sm font-medium">{item.description}</p>
                                    <p className="text-xs text-surface-400">
                                      {item.code ? `${item.code} · ` : ''}
                                      {item.unit}
                                      {item.origin === 'MANUAL' && <span className="ml-1 text-amber-500">manual</span>}
                                      {item.wasManuallyEdited && <span className="ml-1 text-orange-500" title="Valor editado manualmente">✏️</span>}
                                    </p>
                                  </div>
                                )
                              }
                            </td>
                            <td className="text-xs text-surface-500">
                              {item.serviceType?.name ?? '—'}
                            </td>
                            <td className="text-right">
                              {editingId === item.id
                                ? (
                                  <input
                                    type="number" min="0.001" step="0.001"
                                    defaultValue={item.quantity}
                                    className="form-input text-xs py-1 w-20 text-right"
                                    onChange={e => setEditValues(v => ({ ...v, quantity: Number(e.target.value) }))}
                                  />
                                )
                                : <span className="text-sm">{item.quantity}</span>
                              }
                            </td>
                            <td className="text-right">
                              {editingId === item.id
                                ? (
                                  <input
                                    type="number" min="0" step="0.01"
                                    defaultValue={item.unitValue}
                                    className="form-input text-xs py-1 w-28 text-right"
                                    onChange={e => setEditValues(v => ({ ...v, unitValue: Number(e.target.value) }))}
                                  />
                                )
                                : <span className="text-sm font-medium">{formatCurrency(item.unitValue)}</span>
                              }
                            </td>
                            <td className="text-right font-semibold text-sm">
                              {formatCurrency(item.totalValue)}
                            </td>
                            {isDraft && (
                              <td>
                                <div className="flex items-center gap-1">
                                  {editingId === item.id
                                    ? (
                                      <>
                                        <button className="btn-sm p-1 text-emerald-600 hover:bg-emerald-50"
                                          onClick={() => handleInlineEdit(item.id)}>
                                          <Check size={12} />
                                        </button>
                                        <button className="btn-sm p-1 text-surface-400 hover:bg-surface-100"
                                          onClick={() => { setEditingId(null); setEditValues({}) }}>
                                          <X size={12} />
                                        </button>
                                      </>
                                    )
                                    : (
                                      <>
                                        <button className="btn-ghost btn-sm p-1"
                                          onClick={() => { setEditingId(item.id); setEditValues({}) }}>
                                          <Edit3 size={12} />
                                        </button>
                                        <button className="btn-ghost btn-sm p-1 text-red-400 hover:text-red-600"
                                          onClick={() => handleDelete(item.id)}>
                                          <Trash2 size={12} />
                                        </button>
                                      </>
                                    )
                                  }
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              }

              {/* Resumo financeiro */}
              <div className="px-5 py-4 bg-surface-50 border-t border-surface-100">
                <div className="flex flex-col items-end gap-1.5 text-sm max-w-xs ml-auto">
                  <div className="flex justify-between w-full text-surface-600">
                    <span>Subtotal</span>
                    <span className="font-medium">{formatCurrency(quote.subtotal ?? 0)}</span>
                  </div>
                  {(quote.discount ?? 0) > 0 && (
                    <div className="flex justify-between w-full text-emerald-600">
                      <span>Desconto</span>
                      <span className="font-medium">− {formatCurrency(quote.discount ?? 0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between w-full font-bold text-base border-t border-surface-200 pt-1.5 mt-0.5">
                    <span className="text-surface-900">Total</span>
                    <span className="text-brand-600">{formatCurrency(quote.totalValue ?? 0)}</span>
                  </div>
                </div>
              </div>

              {/* Notas */}
              {(quote.technicalNotes || quote.commercialNotes) && (
                <div className="px-5 py-4 border-t border-surface-100 space-y-2">
                  {quote.technicalNotes && (
                    <div>
                      <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-1">Observações técnicas</p>
                      <p className="text-sm text-surface-700">{quote.technicalNotes}</p>
                    </div>
                  )}
                  {quote.commercialNotes && (
                    <div>
                      <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-1">Observações comerciais</p>
                      <p className="text-sm text-surface-700">{quote.commercialNotes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal — Item manual */}
      <Modal open={manualModal} onClose={() => setManualModal(false)} title="Adicionar item manual"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setManualModal(false)}>Cancelar</button>
            <button className="btn-primary" onClick={handleAddManual} disabled={addItem.isPending}>
              {addItem.isPending ? <Spinner size="sm" /> : <Plus size={14} />} Adicionar
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <FormField label="Código (opcional)">
            <input value={manualItem.code} onChange={e => setManualItem(v => ({ ...v, code: e.target.value }))}
              className="form-input" placeholder="MAN-001" />
          </FormField>
          <FormField label="Descrição" required>
            <input value={manualItem.description}
              onChange={e => setManualItem(v => ({ ...v, description: e.target.value }))}
              className="form-input" placeholder="Descrição do serviço ou material" />
          </FormField>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Unidade">
              <select value={manualItem.unit} onChange={e => setManualItem(v => ({ ...v, unit: e.target.value }))}
                className="form-input appearance-none">
                {['un','m','m²','m³','h','cx','kg','l','vb'].map(u => <option key={u}>{u}</option>)}
                <option>km</option>
              </select>
            </FormField>
            <FormField label="Quantidade">
              <input type="number" min="0.001" step="0.001" value={manualItem.quantity}
                onChange={e => setManualItem(v => ({ ...v, quantity: Number(e.target.value) }))}
                className="form-input" />
            </FormField>
            <FormField label="Valor unitário (R$)">
              <input type="number" min="0" step="0.01" value={manualItem.unitValue}
                onChange={e => setManualItem(v => ({ ...v, unitValue: Number(e.target.value) }))}
                className="form-input" />
            </FormField>
          </div>
        </div>
      </Modal>

      {/* Modal — Notas e data */}
      <Modal open={notesOpen} onClose={() => setNotesOpen(false)} title="Notas e data de execução"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setNotesOpen(false)}>Cancelar</button>
            <button className="btn-primary" onClick={handleSaveNotes} disabled={updateQuote.isPending}>
              {updateQuote.isPending ? <Spinner size="sm" /> : <Save size={14} />} Salvar
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Data provável de execução">
            <input type="date" value={estimatedDate}
              onChange={e => setEstimatedDate(e.target.value)} className="form-input" />
          </FormField>
          <FormField label="Desconto (R$)">
            <input type="number" min="0" step="0.01" value={discount}
              onChange={e => setDiscount(Number(e.target.value))} className="form-input" />
          </FormField>
          <FormField label="Observações técnicas">
            <textarea rows={3} value={technicalNote} onChange={e => setTechnicalNote(e.target.value)}
              className="form-input resize-none" placeholder="Detalhes técnicos do orçamento..." />
          </FormField>
          <FormField label="Observações comerciais">
            <textarea rows={3} value={commercialNote} onChange={e => setCommercialNote(e.target.value)}
              className="form-input resize-none" placeholder="Condições comerciais, prazo de validade..." />
          </FormField>
        </div>
      </Modal>

      {/* Modal — Confirmar envio */}
      <Modal open={sendConfirm} onClose={() => setSendConfirm(false)} title="Enviar orçamento ao cliente"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setSendConfirm(false)}>Cancelar</button>
            <button className="btn-primary" onClick={handleSend} disabled={sendQuote.isPending}>
              {sendQuote.isPending ? <Spinner size="sm" /> : <Send size={14} />} Confirmar envio
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {items.length === 0 && (
            <Alert type="warning" message="O orçamento não possui itens. Adicione pelo menos um item antes de enviar." />
          )}
          <p className="text-sm text-surface-600">
            O orçamento com <strong>{items.length} item{items.length !== 1 ? 's' : ''}</strong> e
            total de <strong>{formatCurrency(quote.totalValue ?? 0)}</strong> será enviado ao cliente para aprovação.
          </p>
          <p className="text-xs text-surface-400">Após o envio, o orçamento não poderá mais ser editado.</p>
        </div>
      </Modal>
    </div>
  )
}
