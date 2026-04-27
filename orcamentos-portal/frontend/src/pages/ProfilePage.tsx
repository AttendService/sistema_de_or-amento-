// ============================================================
// Perfil do usuário
// ============================================================
import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User, Lock, Building2, CheckCircle } from 'lucide-react'
import { useAuthStore } from '../store/auth.store'
import { api, extractApiError } from '../lib/api'
import { Alert, FormField, Spinner } from '../components/ui'

const profileSchema = z.object({
  name:  z.string().min(2, 'Nome obrigatório'),
  email: z.string().email('E-mail inválido'),
})

const passwordSchema = z.object({
  password:        z.string().min(8, 'Mínimo 8 caracteres'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'As senhas não coincidem',
  path:    ['confirmPassword'],
})

type ProfileData  = z.infer<typeof profileSchema>
type PasswordData = z.infer<typeof passwordSchema>

export default function ProfilePage() {
  const user    = useAuthStore(s => s.user)
  const setUser = useAuthStore(s => s.setUser)

  const [profileSuccess,  setProfileSuccess]  = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [profileError,    setProfileError]    = useState('')
  const [passwordError,   setPasswordError]   = useState('')
  const [savingProfile,   setSavingProfile]   = useState(false)
  const [savingPassword,  setSavingPassword]  = useState(false)

  const profileForm = useForm<ProfileData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name ?? '', email: user?.email ?? '' },
  })

  const passwordForm = useForm<PasswordData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const onProfileSubmit = async (data: ProfileData) => {
    setProfileError('')
    setProfileSuccess(false)
    setSavingProfile(true)
    try {
      const res = await api.patch(`/api/v1/users/${user?.id}`, data)
      if (user) setUser({ ...user, name: res.data.name, email: res.data.email })
      setProfileSuccess(true)
      setTimeout(() => setProfileSuccess(false), 3000)
    } catch (err) {
      setProfileError(extractApiError(err))
    } finally {
      setSavingProfile(false)
    }
  }

  const onPasswordSubmit = async (data: PasswordData) => {
    setPasswordError('')
    setPasswordSuccess(false)
    setSavingPassword(true)
    try {
      await api.patch(`/api/v1/users/${user?.id}`, { password: data.password })
      setPasswordSuccess(true)
      passwordForm.reset()
      setTimeout(() => setPasswordSuccess(false), 3000)
    } catch (err) {
      setPasswordError(extractApiError(err))
    } finally {
      setSavingPassword(false)
    }
  }

  const roleLabel = user?.role === 'CLIENT' ? 'Cliente'
    : user?.role === 'ADMIN' ? 'Administrador' : 'Analista'

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="font-semibold text-surface-900">Meu perfil</h1>
      </div>

      <div className="page-body max-w-xl space-y-5">
        {/* Avatar + info */}
        <div className="card">
          <div className="card-body flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-brand-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl font-bold text-brand-600">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-lg font-semibold text-surface-900">{user?.name}</p>
              <p className="text-sm text-surface-500">{user?.email}</p>
              <span className="badge bg-brand-50 text-brand-700 mt-1">{roleLabel}</span>
            </div>
          </div>
        </div>

        {/* Clientes vinculados */}
        {user?.role === 'CLIENT' && user.clients && user.clients.length > 0 && (
          <div className="card">
            <div className="card-header">
              <span className="text-sm font-semibold flex items-center gap-2">
                <Building2 size={14} className="text-surface-400" /> Clientes vinculados
              </span>
            </div>
            <div className="card-body space-y-2">
              {user.clients.map(c => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{c.name}</span>
                  {c.isDefault && (
                    <span className="badge bg-brand-50 text-brand-700">Padrão</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dados do perfil */}
        <div className="card">
          <div className="card-header">
            <span className="text-sm font-semibold flex items-center gap-2">
              <User size={14} className="text-surface-400" /> Dados pessoais
            </span>
          </div>
          <div className="card-body">
            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
              {profileError   && <Alert type="error"   message={profileError} />}
              {profileSuccess && (
                <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
                  <CheckCircle size={16} /> Perfil atualizado com sucesso!
                </div>
              )}
              <FormField label="Nome completo" error={profileForm.formState.errors.name?.message}>
                <input {...profileForm.register('name')} className="form-input" />
              </FormField>
              <FormField label="E-mail" error={profileForm.formState.errors.email?.message}>
                <input {...profileForm.register('email')} type="email" className="form-input" />
              </FormField>
              <div className="flex justify-end">
                <button type="submit" className="btn-primary btn-sm" disabled={savingProfile}>
                  {savingProfile ? <Spinner size="sm" /> : null}
                  Salvar alterações
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Alterar senha */}
        <div className="card">
          <div className="card-header">
            <span className="text-sm font-semibold flex items-center gap-2">
              <Lock size={14} className="text-surface-400" /> Alterar senha
            </span>
          </div>
          <div className="card-body">
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
              {passwordError   && <Alert type="error"   message={passwordError} />}
              {passwordSuccess && (
                <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
                  <CheckCircle size={16} /> Senha alterada com sucesso!
                </div>
              )}
              <FormField label="Nova senha" error={passwordForm.formState.errors.password?.message}
                hint="Mínimo 8 caracteres">
                <input {...passwordForm.register('password')} type="password"
                  className="form-input" placeholder="••••••••" />
              </FormField>
              <FormField label="Confirmar nova senha" error={passwordForm.formState.errors.confirmPassword?.message}>
                <input {...passwordForm.register('confirmPassword')} type="password"
                  className="form-input" placeholder="••••••••" />
              </FormField>
              <div className="flex justify-end">
                <button type="submit" className="btn-primary btn-sm" disabled={savingPassword}>
                  {savingPassword ? <Spinner size="sm" /> : null}
                  Alterar senha
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
