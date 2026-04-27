// ============================================================
// Nova Solicitação — formulário completo
// ============================================================
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronLeft, ChevronRight, Check, MapPin, User, Briefcase, Wrench, Send } from 'lucide-react'
import { useCreateRequest, useServiceTypes, useClients } from '../hooks/queries'
import { useAuthStore, useRole } from '../store/auth.store'
import { Alert, FormField, Spinner } from '../components/ui'
import { extractApiError } from '../lib/api'

const schema = z.object({
  clientId:            z.string().uuid('Selecione um cliente'),
  requesterName:       z.string().min(2, 'Nome obrigatório'),
  requesterEmail:      z.string().email('E-mail inválido'),
  requesterPhone:      z.string().optional(),
  finalClientName:     z.string().min(2, 'Nome do cliente final obrigatório'),
  finalClientCompany:  z.string().optional(),
  finalClientDocument: z.string().optional(),
  finalClientContact:  z.string().optional(),
  finalClientPhone:    z.string().optional(),
  zipCode:             z.string().optional(),
  street:              z.string().optional(),
  streetNumber:        z.string().optional(),
  complement:          z.string().optional(),
  neighborhood:        z.string().optional(),
  city:                z.string().optional(),
  state:               z.string().max(2).optional(),
  reference:           z.string().optional(),
  latitude:            z.coerce.number().optional().nullable(),
  longitude:           z.coerce.number().optional().nullable(),
  serviceTypeIds:      z.array(z.string().uuid()).min(1, 'Selecione pelo menos um tipo'),
  description:         z.string().optional(),
  observations:        z.string().optional(),
  requestedDate:       z.string().optional(),
  isUrgent:            z.boolean().default(false),
})

type FormData = z.input<typeof schema>

const STEPS = [
  { id: 1, label: 'Solicitante',   icon: <User     size={14} /> },
  { id: 2, label: 'Cliente final', icon: <Briefcase size={14} /> },
  { id: 3, label: 'Localidade',    icon: <MapPin   size={14} /> },
  { id: 4, label: 'Serviço',       icon: <Wrench   size={14} /> },
]

export default function NewRequestPage() {
  const navigate  = useNavigate()
  const role      = useRole()
  const user      = useAuthStore(s => s.user)
  const [step, setStep]     = useState(1)
  const [apiError, setApiError] = useState('')

  const createRequest = useCreateRequest()
  const { data: serviceTypes = [] } = useServiceTypes()
  const { data: clientsData }       = useClients({ limit: 100 })
  const clients = clientsData?.data ?? []

  const {
    register, handleSubmit, control, watch, trigger,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      clientId:       user?.defaultClientId ?? '',
      requesterName:  user?.name  ?? '',
      requesterEmail: user?.email ?? '',
      isUrgent: false,
      serviceTypeIds: [],
    },
  })

  const watchedServiceTypeIds = watch('serviceTypeIds') ?? []

  const STEP_FIELDS: Record<number, (keyof FormData)[]> = {
    1: ['clientId', 'requesterName', 'requesterEmail'],
    2: ['finalClientName'],
    3: [],
    4: ['serviceTypeIds'],
  }

  const next = async () => {
    const valid = await trigger(STEP_FIELDS[step])
    if (valid) setStep(s => Math.min(4, s + 1))
  }
  const prev = () => setStep(s => Math.max(1, s - 1))

  const onSubmit = async (data: FormData) => {
    setApiError('')
    try {
      const result = await createRequest.mutateAsync(data)
      navigate(`/requests/${result.id}`)
    } catch (err) {
      setApiError(extractApiError(err))
      setStep(1)
    }
  }

  const toggleServiceType = (id: string, current: string[], onChange: (v: string[]) => void) => {
    if (current.includes(id)) onChange(current.filter(x => x !== id))
    else onChange([...current, id])
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="btn-ghost p-1.5">
            <ChevronLeft size={16} />
          </button>
          <h1 className="font-semibold text-surface-900">Nova solicitação</h1>
        </div>
      </div>

      <div className="page-body max-w-2xl mx-auto">
        {/* Stepper */}
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <div className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all
                  ${step > s.id  ? 'bg-emerald-500 text-white'
                  : step === s.id ? 'bg-brand-500 text-white shadow-glow'
                  : 'bg-surface-100 text-surface-400'}`}>
                  {step > s.id ? <Check size={14} /> : s.icon}
                </div>
                <span className={`text-xs font-medium hidden sm:block
                  ${step === s.id ? 'text-brand-600' : 'text-surface-400'}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-2 transition-all ${step > s.id ? 'bg-emerald-300' : 'bg-surface-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          {apiError && <Alert type="error" message={apiError} />}

          {/* Step 1 — Dados do solicitante */}
          {step === 1 && (
            <div className="card fade-in">
              <div className="card-header">
                <span className="text-sm font-semibold">Dados do solicitante</span>
              </div>
              <div className="card-body space-y-4">
                {(role === 'ANALYST' || role === 'ADMIN') && (
                  <FormField label="Cliente" required error={errors.clientId?.message}>
                    <select {...register('clientId')} className="form-input appearance-none">
                      <option value="">Selecione o cliente</option>
                      {clients.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </FormField>
                )}
                {role === 'CLIENT' && user?.clients && user.clients.length > 1 && (
                  <FormField label="Cliente" required error={errors.clientId?.message}>
                    <select {...register('clientId')} className="form-input appearance-none">
                      {user.clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </FormField>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Nome do solicitante" required error={errors.requesterName?.message}>
                    <input {...register('requesterName')} className={`form-input ${errors.requesterName ? 'error' : ''}`} placeholder="Seu nome completo" />
                  </FormField>
                  <FormField label="E-mail" required error={errors.requesterEmail?.message}>
                    <input {...register('requesterEmail')} type="email" className={`form-input ${errors.requesterEmail ? 'error' : ''}`} placeholder="seu@email.com" />
                  </FormField>
                </div>
                <FormField label="Telefone" error={errors.requesterPhone?.message}>
                  <input {...register('requesterPhone')} className="form-input" placeholder="(11) 99999-9999" />
                </FormField>
              </div>
            </div>
          )}

          {/* Step 2 — Cliente final */}
          {step === 2 && (
            <div className="card fade-in">
              <div className="card-header">
                <span className="text-sm font-semibold">Dados do cliente final</span>
              </div>
              <div className="card-body space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Nome do cliente final" required error={errors.finalClientName?.message}>
                    <input {...register('finalClientName')} className={`form-input ${errors.finalClientName ? 'error' : ''}`} placeholder="Nome completo" />
                  </FormField>
                  <FormField label="Empresa" error={errors.finalClientCompany?.message}>
                    <input {...register('finalClientCompany')} className="form-input" placeholder="Razão social" />
                  </FormField>
                  <FormField label="Documento" error={errors.finalClientDocument?.message}>
                    <input {...register('finalClientDocument')} className="form-input" placeholder="CPF ou CNPJ" />
                  </FormField>
                  <FormField label="Contato local" error={errors.finalClientContact?.message}>
                    <input {...register('finalClientContact')} className="form-input" placeholder="Nome do contato no local" />
                  </FormField>
                  <FormField label="Telefone local" error={errors.finalClientPhone?.message}>
                    <input {...register('finalClientPhone')} className="form-input" placeholder="(11) 99999-9999" />
                  </FormField>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — Localidade */}
          {step === 3 && (
            <div className="card fade-in">
              <div className="card-header">
                <span className="text-sm font-semibold">Dados da localidade</span>
              </div>
              <div className="card-body space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <FormField label="CEP">
                      <input {...register('zipCode')} className="form-input" placeholder="00000-000" />
                    </FormField>
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <FormField label="Endereço">
                      <input {...register('street')} className="form-input" placeholder="Rua, avenida..." />
                    </FormField>
                  </div>
                  <div>
                    <FormField label="Número">
                      <input {...register('streetNumber')} className="form-input" placeholder="123" />
                    </FormField>
                  </div>
                  <div className="col-span-3">
                    <FormField label="Complemento">
                      <input {...register('complement')} className="form-input" placeholder="Apto, sala, bloco..." />
                    </FormField>
                  </div>
                  <div className="col-span-2">
                    <FormField label="Bairro">
                      <input {...register('neighborhood')} className="form-input" />
                    </FormField>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <FormField label="Cidade">
                      <input {...register('city')} className="form-input" />
                    </FormField>
                  </div>
                  <div>
                    <FormField label="Estado (UF)">
                      <input {...register('state')} className="form-input" maxLength={2} placeholder="SP" />
                    </FormField>
                  </div>
                </div>
                <FormField label="Referência / Ponto de referência">
                  <textarea {...register('reference')} rows={2} className="form-input resize-none" placeholder="Próximo ao..." />
                </FormField>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Latitude" hint="Coordenada geográfica">
                    <input {...register('latitude')} type="number" step="any" className="form-input font-mono text-sm" placeholder="-23.5505" />
                  </FormField>
                  <FormField label="Longitude" hint="Coordenada geográfica">
                    <input {...register('longitude')} type="number" step="any" className="form-input font-mono text-sm" placeholder="-46.6333" />
                  </FormField>
                </div>
              </div>
            </div>
          )}

          {/* Step 4 — Serviço */}
          {step === 4 && (
            <div className="card fade-in">
              <div className="card-header">
                <span className="text-sm font-semibold">Dados do serviço</span>
              </div>
              <div className="card-body space-y-5">
                <FormField label="Tipos de serviço" required error={errors.serviceTypeIds?.message}>
                  <Controller
                    name="serviceTypeIds"
                    control={control}
                    render={({ field }) => (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                        {serviceTypes.map((st: any) => {
                          const selected = field.value?.includes(st.id)
                          return (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => toggleServiceType(st.id, field.value ?? [], field.onChange)}
                              className={`text-left px-3 py-2.5 rounded border text-sm font-medium transition-all
                                ${selected
                                  ? 'bg-brand-50 border-brand-400 text-brand-700'
                                  : 'bg-white border-surface-200 text-surface-600 hover:border-surface-300'}`}
                            >
                              {selected && <Check size={12} className="inline mr-1 text-brand-500" />}
                              {st.name}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  />
                </FormField>

                <FormField label="Descrição detalhada da necessidade">
                  <textarea {...register('description')} rows={4} className="form-input resize-none"
                    placeholder="Descreva com detalhes o que precisa ser feito..." />
                </FormField>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Data prevista para execução">
                    <input {...register('requestedDate')} type="date" className="form-input" />
                  </FormField>
                  <FormField label="Urgência">
                    <Controller
                      name="isUrgent"
                      control={control}
                      render={({ field }) => (
                        <button
                          type="button"
                          onClick={() => field.onChange(!field.value)}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded border text-sm font-medium transition-all
                            ${field.value
                              ? 'bg-amber-50 border-amber-400 text-amber-700'
                              : 'bg-white border-surface-200 text-surface-600 hover:border-surface-300'}`}
                        >
                          <span className="text-lg">⚡</span>
                          {field.value ? 'Marcado como urgente' : 'Marcar como urgente'}
                        </button>
                      )}
                    />
                  </FormField>
                </div>

                <FormField label="Observações adicionais">
                  <textarea {...register('observations')} rows={3} className="form-input resize-none"
                    placeholder="Informações complementares..." />
                </FormField>
              </div>
            </div>
          )}

          {/* Botões de navegação */}
          <div className="flex items-center justify-between mt-6">
            <button type="button" onClick={prev} disabled={step === 1}
              className="btn-secondary disabled:opacity-0">
              <ChevronLeft size={16} /> Anterior
            </button>

            {step < 4
              ? (
                <button type="button" onClick={next} className="btn-primary">
                  Próximo <ChevronRight size={16} />
                </button>
              )
              : (
                <button type="submit" className="btn-primary"
                  disabled={createRequest.isPending}>
                  {createRequest.isPending ? <Spinner size="sm" /> : <Send size={16} />}
                  {createRequest.isPending ? 'Enviando...' : 'Enviar solicitação'}
                </button>
              )
            }
          </div>
        </form>
      </div>
    </div>
  )
}
