import React, { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react'
import { api, extractApiError } from '../lib/api'
import { Alert, Spinner } from '../components/ui'

const schema = z.object({
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  confirmPassword: z.string().min(8, 'Confirme a nova senha'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
})

type FormData = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [apiError, setApiError] = useState('')
  const [success, setSuccess] = useState(false)
  const invalidToken = useMemo(() => token.trim().length === 0, [token])

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setApiError('')
    try {
      await api.post('/auth/reset-password', {
        token,
        password: data.password,
      })
      setSuccess(true)
      window.setTimeout(() => navigate('/login', { replace: true }), 1800)
    } catch (error) {
      setApiError(extractApiError(error))
    }
  }

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-brand-300/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-500 shadow-lg mb-4">
            <KeyRound className="text-white" size={22} />
          </div>
          <h1 className="text-xl font-bold text-surface-900">Redefinir senha</h1>
          <p className="text-sm text-surface-400 mt-1">Defina uma nova senha para voltar ao sistema</p>
        </div>

        <div className="card">
          <div className="card-body">
            {success ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <CheckCircle size={36} className="text-emerald-500" />
                <p className="text-sm text-surface-700">
                  Senha alterada com sucesso. Você será redirecionado para o login.
                </p>
              </div>
            ) : invalidToken ? (
              <div className="space-y-4 text-center">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 text-amber-600">
                  <ShieldCheck size={18} />
                </div>
                <p className="text-sm text-surface-700">
                  O link de recuperação está incompleto ou inválido.
                </p>
                <Link to="/login" className="btn-secondary w-full justify-center">
                  Voltar ao login
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {apiError && <Alert type="error" message={apiError} />}

                <div>
                  <label className="form-label">Nova senha</label>
                  <div className="relative">
                    <input
                      {...register('password')}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className={`form-input pr-10 ${errors.password ? 'error' : ''}`}
                      autoComplete="new-password"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && <p className="form-error">{errors.password.message}</p>}
                </div>

                <div>
                  <label className="form-label">Confirmar nova senha</label>
                  <div className="relative">
                    <input
                      {...register('confirmPassword')}
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className={`form-input pr-10 ${errors.confirmPassword ? 'error' : ''}`}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((current) => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="form-error">{errors.confirmPassword.message}</p>}
                </div>

                <button type="submit" className="btn-primary w-full mt-2" disabled={isSubmitting}>
                  {isSubmitting ? <Spinner size="sm" /> : <ShieldCheck size={16} />}
                  {isSubmitting ? 'Salvando...' : 'Atualizar senha'}
                </button>

                <Link to="/login" className="btn-secondary w-full justify-center">
                  Voltar ao login
                </Link>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
