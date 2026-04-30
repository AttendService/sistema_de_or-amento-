// ============================================================
// Nova Solicitação — layout compacto 2 colunas
// ============================================================
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ChevronLeft, Send, User, Building2, MapPin, Wrench, Zap, Plus, Trash2,
} from 'lucide-react'
import { useCreateRequest, useServiceTypes, useClients, useFinalClients } from '../hooks/queries'
import { useAuthStore, useRole } from '../store/auth.store'
import { Alert, FormField, Spinner } from '../components/ui'
import { extractApiError } from '../lib/api'

// ── Zod schema ──────────────────────────────────────────────
const uuidLike = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  'Selecione um cliente',
)
const optionalStr = z.preprocess(
  v => (v === '' || v === null || v === undefined ? undefined : v),
  z.string().max(500).optional(),
)
const optionalDate = z.preprocess(
  v => (v === '' ? undefined : v),
  z.string().date().optional(),
)
const optionalLatitude = z.preprocess(
  v => (v === '' || v === null || v === undefined ? null : Number(v)),
  z.number().min(-90).max(90).optional().nullable(),
)
const optionalLongitude = z.preprocess(
  v => (v === '' || v === null || v === undefined ? null : Number(v)),
  z.number().min(-180).max(180).optional().nullable(),
)
const optionalQuantity = z.preprocess(
  v => (v === '' || v === null || v === undefined ? undefined : Number(v)),
  z.number().int('Use número inteiro').min(0, 'Quantidade inválida').optional(),
)
const technologyOptions = ['Starlink', 'Vsat', 'Roteador', 'Sdwan', 'Outros'] as const

const schema = z.object({
  clientId:            uuidLike,
  requesterName:       z.string().min(2, 'Obrigatório'),
  requesterEmail:      z.string().email('E-mail inválido'),
  requesterPhone:      optionalStr,
  finalClientName:     z.string().min(2, 'Obrigatório'),
  finalClientCompany:  optionalStr,
  finalClientDocument: optionalStr,
  finalClientContact:  optionalStr,
  finalClientPhone:    optionalStr,
  zipCode:             optionalStr,
  street:              optionalStr,
  streetNumber:        optionalStr,
  complement:          optionalStr,
  neighborhood:        optionalStr,
  city:                optionalStr,
  state:               z.preprocess(
    v => (v === '' || v === null || v === undefined ? undefined : String(v).toUpperCase().slice(0, 2)),
    z.string().length(2).optional(),
  ),
  reference:           optionalStr,
  latitude:            optionalLatitude,
  longitude:           optionalLongitude,
  serviceTypeIds:      z.array(uuidLike).min(1, 'Selecione pelo menos um tipo de serviço'),
  technology:          z.array(z.enum(technologyOptions)).optional(),
  serviceProducts:     z.array(z.object({ value: optionalStr, quantity: optionalQuantity })).optional(),
  description:         optionalStr,
  observations:        optionalStr,
  requestedDate:       optionalDate,
  isUrgent:            z.boolean().default(false),
})

type FormData  = z.infer<typeof schema>
type FormInput = z.input<typeof schema>

// ── Section label ────────────────────────────────────────────
function SectionLabel({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-surface-100 bg-surface-50/60">
      <span className="text-brand-500">{icon}</span>
      <span className="text-[11px] font-bold text-surface-500 uppercase tracking-widest">{title}</span>
    </div>
  )
}

// ── Compact form field ───────────────────────────────────────
function Field({
  label, required, error, hint, children,
}: {
  label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-surface-600 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-0.5 text-[11px] text-red-500">{error}</p>}
      {!error && hint && <p className="mt-0.5 text-[11px] text-surface-400">{hint}</p>}
    </div>
  )
}

const inputCls = (err?: string) =>
  `w-full rounded-md border text-sm px-3 py-1.5 bg-surface-0 placeholder:text-surface-300
   focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200 transition-all
   ${err ? 'border-red-400 focus:border-red-400 focus:ring-red-500/20' : 'border-surface-200'}`

// ── Main component ───────────────────────────────────────────
export default function NewRequestPage() {
  const navigate = useNavigate()
  const role     = useRole()
  const user     = useAuthStore(s => s.user)
  const [apiError, setApiError] = useState('')
  const [cepLoading, setCepLoading] = useState(false)
  const [cepError, setCepError] = useState('')

  const createRequest = useCreateRequest()
  const { data: serviceTypesData } = useServiceTypes()
  const serviceTypes = serviceTypesData ?? []

  const { data: clientsData } = useClients(undefined, { enabled: role !== 'CLIENT' })
  const clients = clientsData?.data ?? clientsData ?? []

  const defaultClientId = user?.defaultClientId ?? user?.clientIds?.[0] ?? user?.clients?.[0]?.id ?? ''
  const missingClientLink = role === 'CLIENT' && !defaultClientId

  const {
    register, handleSubmit, control, setValue, watch,
    formState: { errors },
  } = useForm<FormInput, unknown, FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      clientId:       defaultClientId,
      requesterName:  user?.name  ?? '',
      requesterEmail: user?.email ?? '',
      isUrgent:       false,
      serviceTypeIds: [],
      technology: [],
      serviceProducts: [{ value: '', quantity: undefined }],
    },
  })
  const { fields: serviceProductFields, append: appendServiceProduct, remove: removeServiceProduct } = useFieldArray({
    control,
    name: 'serviceProducts',
  })

  useEffect(() => {
    if (role === 'CLIENT' && defaultClientId) {
      setValue('clientId', defaultClientId, { shouldValidate: true })
    }
  }, [defaultClientId, role, setValue])

  const selectedClientId = watch('clientId')
  const { data: finalClients = [] } = useFinalClients(
    { clientId: selectedClientId || undefined },
    { enabled: !!selectedClientId },
  )
  const [selectedFinalClientKey, setSelectedFinalClientKey] = useState('')

  useEffect(() => {
    setSelectedFinalClientKey('')
  }, [selectedClientId])

  const onSubmit = async (data: FormData) => {
    setApiError('')
    try {
      const serviceProducts = (data.serviceProducts ?? [])
        .map((item) => ({
          description: item?.value?.trim() ?? '',
          quantity: typeof item?.quantity === 'number' ? item.quantity : undefined,
        }))
        .filter((item) => item.description.length > 0)
      const payload: any = { ...data, serviceProducts }
      if (Array.isArray(payload.technology) && payload.technology.length > 0) {
        payload.description = `[Tecnologia: ${payload.technology.join(', ')}]\n\n${payload.description || ''}`
      }
      // Remove o campo technology para não causar erro no backend
      delete (payload as any).technology

      const result = await createRequest.mutateAsync(payload)
      navigate(`/requests/${result.id}`)
    } catch (err) {
      setApiError(extractApiError(err))
    }
  }

  const handleZipCodeBlur = async (rawZipCode: string) => {
    const zipCode = rawZipCode.replace(/\D/g, '')
    if (!zipCode) {
      setCepError('')
      return
    }

    if (zipCode.length !== 8) {
      setCepError('CEP inválido. Informe 8 dígitos.')
      return
    }

    setCepError('')
    setCepLoading(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${zipCode}/json/`)
      const data = await res.json()

      if (!res.ok || data?.erro) {
        setCepError('CEP não encontrado.')
        return
      }

      setValue('street', data.logradouro ?? '', { shouldValidate: true })
      setValue('neighborhood', data.bairro ?? '', { shouldValidate: true })
      setValue('city', data.localidade ?? '', { shouldValidate: true })
      setValue('state', data.uf ?? '', { shouldValidate: true })
    } catch (_error) {
      setCepError('Não foi possível consultar o CEP no momento.')
    } finally {
      setCepLoading(false)
    }
  }

  const toggle = (id: string, cur: string[], onChange: (v: string[]) => void) =>
    onChange(cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id])

  return (
    <div className="fade-in">

      {/* ── Sticky header ──────────────────────────────── */}
      <div className="page-header">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate(-1)} className="btn-ghost p-1.5 -ml-1">
            <ChevronLeft size={16} />
          </button>
          <div>
            <h1 className="font-semibold text-surface-900 text-base">Nova solicitação</h1>
            <p className="text-[11px] text-surface-400">Campos marcados com * são obrigatórios</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate(-1)} className="btn-ghost btn-sm">
            Cancelar
          </button>
          <button
            type="submit"
            form="new-request-form"
            className="btn-primary btn-sm px-5"
            disabled={createRequest.isPending || missingClientLink}
          >
            {createRequest.isPending ? <Spinner size="sm" /> : <Send size={13} />}
            {createRequest.isPending ? 'Enviando...' : 'Enviar solicitação'}
          </button>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────── */}
      <div className="page-body">

        {/* Alerts */}
        {apiError && <div className="mb-4"><Alert type="error" message={apiError} /></div>}
        {missingClientLink && (
          <div className="mb-4">
            <Alert type="error" message="Seu usuário não está vinculado a um cliente. Contate o administrador." />
          </div>
        )}

        <form id="new-request-form" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">

            {/* ══ Coluna Esquerda ══════════════════ */}
            <div className="space-y-4">

              {/* Solicitante */}
              <div className="card overflow-hidden">
                <SectionLabel icon={<User size={13} />} title="Dados do solicitante" />
                <div className="p-4 space-y-3">

                  {/* Seletor cliente (ANALYST/ADMIN) */}
                  {(role === 'ANALYST' || role === 'ADMIN' || role === 'SUPER_ADMIN') && (
                    <Field label="Empresa / Cliente" required error={errors.clientId?.message}>
                      <select {...register('clientId')} className={inputCls(errors.clientId?.message)}>
                        <option value="">Selecione...</option>
                        {clients.map((c: any) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </Field>
                  )}
                  {role === 'CLIENT' && user?.clients && user.clients.length > 1 && (
                    <Field label="Empresa" required error={errors.clientId?.message}>
                      <select {...register('clientId')} className={inputCls(errors.clientId?.message)}>
                        {user.clients.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </Field>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Nome completo" required error={errors.requesterName?.message}>
                      <input {...register('requesterName')} className={inputCls(errors.requesterName?.message)} placeholder="Seu nome" />
                    </Field>
                    <Field label="E-mail" required error={errors.requesterEmail?.message}>
                      <input {...register('requesterEmail')} type="email" className={inputCls(errors.requesterEmail?.message)} placeholder="seu@email.com" />
                    </Field>
                  </div>
                  <Field label="Telefone / WhatsApp">
                    <input {...register('requesterPhone')} className={inputCls()} placeholder="(11) 99999-9999" />
                  </Field>
                </div>
              </div>

              {/* Cliente final */}
              <div className="card overflow-hidden">
                <SectionLabel icon={<Building2 size={13} />} title="Cliente final" />
                <div className="p-4 space-y-3">
                  <Field label="Cliente final já cadastrado nesta conta">
                    <select
                      value={selectedFinalClientKey}
                      onChange={(e) => {
                        const selectedKey = e.target.value
                        setSelectedFinalClientKey(selectedKey)
                        const selected = (finalClients as any[]).find((fc) => (
                          `${fc.finalClientName}::${fc.finalClientDocument ?? ''}` === selectedKey
                        ))
                        if (!selected) return
                        setValue('finalClientName', selected.finalClientName ?? '', { shouldValidate: true })
                        setValue('finalClientCompany', selected.finalClientCompany ?? '', { shouldValidate: true })
                        setValue('finalClientDocument', selected.finalClientDocument ?? '', { shouldValidate: true })
                        setValue('finalClientContact', selected.finalClientContact ?? '', { shouldValidate: true })
                        setValue('finalClientPhone', selected.finalClientPhone ?? '', { shouldValidate: true })
                      }}
                      className={inputCls()}
                    >
                      <option value="">Selecione para preencher automaticamente</option>
                      {(finalClients as any[]).map((fc) => {
                        const key = `${fc.finalClientName}::${fc.finalClientDocument ?? ''}`
                        return (
                          <option key={key} value={key}>
                            {fc.finalClientName}{fc.finalClientDocument ? ` · ${fc.finalClientDocument}` : ''}
                          </option>
                        )
                      })}
                    </select>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Nome" required error={errors.finalClientName?.message}>
                      <input {...register('finalClientName')} className={inputCls(errors.finalClientName?.message)} placeholder="Nome completo" />
                    </Field>
                    <Field label="Empresa">
                      <input {...register('finalClientCompany')} className={inputCls()} placeholder="Razão social" />
                    </Field>
                    <Field label="CPF / CNPJ">
                      <input {...register('finalClientDocument')} className={inputCls()} placeholder="000.000.000-00" />
                    </Field>
                    <Field label="Contato local">
                      <input {...register('finalClientContact')} className={inputCls()} placeholder="Nome do responsável" />
                    </Field>
                  </div>
                  <Field label="Telefone local">
                    <input {...register('finalClientPhone')} className={inputCls()} placeholder="(11) 99999-9999" />
                  </Field>
                </div>
              </div>

              {/* Localidade */}
              <div className="card overflow-hidden">
                <SectionLabel icon={<MapPin size={13} />} title="Localidade" />
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-4 gap-2">
                    <div className="col-span-1">
                      <Field label="CEP">
                        <input
                          {...register('zipCode', {
                            onBlur: (e) => {
                              void handleZipCodeBlur(e.target.value)
                            },
                          })}
                          className={inputCls()}
                          placeholder="00000-000"
                        />
                      </Field>
                      {cepLoading && <p className="mt-0.5 text-[11px] text-surface-400">Consultando CEP...</p>}
                      {!cepLoading && cepError && <p className="mt-0.5 text-[11px] text-red-500">{cepError}</p>}
                    </div>
                    <div className="col-span-3">
                      <Field label="Endereço">
                        <input {...register('street')} className={inputCls()} placeholder="Rua, avenida, estrada..." />
                      </Field>
                    </div>
                    <div className="col-span-1">
                      <Field label="Número">
                        <input {...register('streetNumber')} className={inputCls()} placeholder="123" />
                      </Field>
                    </div>
                    <div className="col-span-3">
                      <Field label="Complemento">
                        <input {...register('complement')} className={inputCls()} placeholder="Apto, sala, bloco..." />
                      </Field>
                    </div>
                    <div className="col-span-2">
                      <Field label="Bairro">
                        <input {...register('neighborhood')} className={inputCls()} />
                      </Field>
                    </div>
                    <div className="col-span-1">
                      <Field label="Cidade">
                        <input {...register('city')} className={inputCls()} />
                      </Field>
                    </div>
                    <div className="col-span-1">
                      <Field label="UF">
                        <input {...register('state')} className={inputCls()} maxLength={2} placeholder="SP" />
                      </Field>
                    </div>
                  </div>
                  <Field label="Ponto de referência">
                    <input {...register('reference')} className={inputCls()} placeholder="Próximo ao..." />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Latitude" hint="Opcional" error={errors.latitude?.message}>
                      <input {...register('latitude')} type="number" step="any" className={`${inputCls(errors.latitude?.message)} font-mono`} placeholder="-23.5505" />
                    </Field>
                    <Field label="Longitude" hint="Opcional" error={errors.longitude?.message}>
                      <input {...register('longitude')} type="number" step="any" className={`${inputCls(errors.longitude?.message)} font-mono`} placeholder="-46.6333" />
                    </Field>
                  </div>
                </div>
              </div>

            </div>

            {/* ══ Coluna Direita ═══════════════════ */}
            <div>
              <div className="card overflow-hidden">
                <SectionLabel icon={<Wrench size={13} />} title="Serviço solicitado" />
                <div className="p-4 space-y-4">

                  {/* Tipos de serviço e Tecnologia */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-surface-600 mb-2">
                        Tipo de serviço<span className="text-red-400 ml-0.5">*</span>
                      </label>
                      <Controller
                        name="serviceTypeIds"
                        control={control}
                        render={({ field }) => (
                          <>
                            <div className="space-y-2">
                              <div className={`${inputCls(errors.serviceTypeIds?.message)} p-2 max-h-44 overflow-y-auto`}>
                                {serviceTypes.length === 0 ? (
                                  <p className="text-xs text-surface-400">Nenhum tipo de serviço ativo.</p>
                                ) : (
                                  <div className="space-y-1">
                                    {serviceTypes.map((st: any) => {
                                      const checked = field.value?.includes(st.id) ?? false
                                      return (
                                        <label key={st.id} className="flex items-center gap-2 text-sm cursor-pointer p-1 rounded hover:bg-surface-50">
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggle(st.id, field.value ?? [], field.onChange)}
                                          />
                                          <span>{st.name}</span>
                                        </label>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                              <p className="text-[11px] text-surface-400">Selecione um ou mais tipos de serviço.</p>
                            </div>
                            {errors.serviceTypeIds?.message && (
                              <p className="mt-1.5 text-[11px] text-red-500">{errors.serviceTypeIds.message}</p>
                            )}
                          </>
                        )}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-surface-600 mb-2">
                        Tecnologia
                      </label>
                      <Controller
                        name="technology"
                        control={control}
                        render={({ field }) => (
                          <div className="space-y-2">
                            <div className={`${inputCls()} p-2 max-h-44 overflow-y-auto`}>
                              <div className="space-y-1">
                                {technologyOptions.map((tech) => {
                                  const checked = field.value?.includes(tech) ?? false
                                  return (
                                    <label key={tech} className="flex items-center gap-2 text-sm cursor-pointer p-1 rounded hover:bg-surface-50">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggle(tech, field.value ?? [], field.onChange)}
                                      />
                                      <span>{tech}</span>
                                    </label>
                                  )
                                })}
                              </div>
                            </div>
                            <p className="text-[11px] text-surface-400">Selecione uma ou mais tecnologias.</p>
                          </div>
                        )}
                      />
                    </div>
                  </div>

                  {/* Descrição */}
                  <Field label="Serviço/Produto">
                    <div className="space-y-2">
                      {serviceProductFields.map((field, index) => (
                        <div key={field.id} className="flex items-center gap-2">
                          <div className="w-full max-w-[560px]">
                            <input
                              {...register(`serviceProducts.${index}.value`)}
                              className={inputCls()}
                              placeholder="Informe o serviço/produto desejado (opcional)"
                            />
                          </div>
                          <div className="w-[120px]">
                            <input
                              {...register(`serviceProducts.${index}.quantity`)}
                              type="number"
                              step={1}
                              min={0}
                              className={inputCls()}
                              placeholder="Qtd (opc.)"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeServiceProduct(index)}
                            className="h-[34px] w-[34px] rounded-md border border-surface-200 text-surface-500 hover:bg-surface-50 disabled:opacity-40"
                            disabled={serviceProductFields.length <= 1}
                            title="Remover item"
                          >
                            <Trash2 size={14} className="mx-auto" />
                          </button>
                          {index === serviceProductFields.length - 1 && (
                            <button
                              type="button"
                              onClick={() => appendServiceProduct({ value: '', quantity: undefined })}
                              className="h-[34px] w-[34px] rounded-md border border-brand-300 text-brand-600 hover:bg-brand-50"
                              title="Adicionar novo item"
                            >
                              <Plus size={14} className="mx-auto" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </Field>

                  <Field label="Descrição detalhada da necessidade">
                    <textarea
                      {...register('description')}
                      rows={4}
                      className={`${inputCls()} resize-none`}
                      placeholder="Descreva com detalhes o que precisa ser feito, condições do local, equipamentos envolvidos..."
                    />
                  </Field>

                  {/* Data + Urgência */}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Data prevista para execução">
                      <input {...register('requestedDate')} type="date" className={inputCls()} />
                    </Field>
                    <Field label="Marcação de urgência">
                      <Controller
                        name="isUrgent"
                        control={control}
                        render={({ field }) => (
                          <button
                            type="button"
                            onClick={() => field.onChange(!field.value)}
                            className={`w-full h-[34px] flex items-center justify-center gap-1.5 rounded-md border text-xs font-semibold transition-all duration-150
                              ${field.value
                                ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                                : 'bg-white border-surface-200 text-surface-500 hover:border-amber-300 hover:bg-amber-50'
                              }`}
                          >
                            <Zap size={12} />
                            {field.value ? 'Marcado como urgente' : 'Marcar como urgente'}
                          </button>
                        )}
                      />
                    </Field>
                  </div>

                  {/* Observações */}
                  <Field label="Observações adicionais">
                    <textarea
                      {...register('observations')}
                      rows={3}
                      className={`${inputCls()} resize-none`}
                      placeholder="Restrições de acesso, janelas de manutenção, informações complementares..."
                    />
                  </Field>

                  {/* Divider + CTAs inline no card */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-100">
                    <button type="button" onClick={() => navigate(-1)} className="btn-ghost btn-sm">
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn-primary btn-sm px-6"
                      disabled={createRequest.isPending || missingClientLink}
                    >
                      {createRequest.isPending ? <Spinner size="sm" /> : <Send size={13} />}
                      {createRequest.isPending ? 'Enviando...' : 'Enviar solicitação'}
                    </button>
                  </div>

                </div>
              </div>
            </div>

          </div>
        </form>
      </div>
    </div>
  )
}
