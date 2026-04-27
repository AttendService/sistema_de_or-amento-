// ============================================================
// Página de Login
// ============================================================
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Receipt, Eye, EyeOff, LogIn, CheckCircle } from 'lucide-react'
import { useAuthStore } from '../store/auth.store'
import { api, extractApiError } from '../lib/api'
import { Alert, Spinner, Modal } from '../components/ui'

const schema = z.object({
  email:    z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const navigate  = useNavigate()
  const login     = useAuthStore(s => s.login)
  const isLoading = useAuthStore(s => s.isLoading)
  const [showPwd, setShowPwd]   = useState(false)
  const [apiError, setApiError] = useState('')
  const [forgotModal, setForgotModal] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent,  setForgotSent]  = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setApiError('')
    try {
      await login(data.email, data.password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setApiError(extractApiError(err))
    }
  }

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
      {/* Fundo decorativo */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-brand-300/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-500 shadow-lg mb-4">
            <Receipt className="text-white" size={22} />
          </div>
          <h1 className="text-xl font-bold text-surface-900">Portal de Orçamentos</h1>
          <p className="text-sm text-surface-400 mt-1">Acesse sua conta para continuar</p>
        </div>

        {/* Card */}
        <div className="card">
          <div className="card-body">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {apiError && <Alert type="error" message={apiError} />}

              <div>
                <label className="form-label">E-mail</label>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="seu@email.com"
                  className={`form-input ${errors.email ? 'error' : ''}`}
                  autoComplete="email"
                  autoFocus
                />
                {errors.email && <p className="form-error">{errors.email.message}</p>}
              </div>

              <div>
                <label className="form-label">Senha</label>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPwd ? 'text' : 'password'}
                    placeholder="••••••••"
                    className={`form-input pr-10 ${errors.password ? 'error' : ''}`}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                  >
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <p className="form-error">{errors.password.message}</p>}
              </div>

              <button type="submit" className="btn-primary w-full mt-2" disabled={isLoading}>
                {isLoading ? <Spinner size="sm" /> : <LogIn size={16} />}
                {isLoading ? 'Entrando...' : 'Entrar'}
              </button>

              <button type="button"
                onClick={() => { setForgotModal(true); setForgotSent(false); setForgotEmail('') }}
                className="w-full text-center text-xs text-brand-500 hover:text-brand-700 mt-1 transition-colors">
                Esqueci minha senha
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-surface-400 mt-6">
          Problemas de acesso? Contate o administrador.
        </p>
      </div>

      {/* Modal — Esqueci minha senha */}
      <Modal open={forgotModal} onClose={() => setForgotModal(false)} title="Recuperar senha"
        footer={
          forgotSent
            ? <button className="btn-secondary" onClick={() => setForgotModal(false)}>Fechar</button>
            : (
              <>
                <button className="btn-secondary" onClick={() => setForgotModal(false)}>Cancelar</button>
                <button className="btn-primary" disabled={forgotLoading}
                  onClick={async () => {
                    setForgotLoading(true)
                    try {
                      await api.post('/auth/forgot-password', { email: forgotEmail })
                      setForgotSent(true)
                    } catch {
                      setForgotSent(true) // mostra msg genérica de qualquer forma
                    } finally {
                      setForgotLoading(false)
                    }
                  }}
                >
                  {forgotLoading ? <Spinner size="sm" /> : null}
                  Enviar instruções
                </button>
              </>
            )
        }
      >
        {forgotSent
          ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle size={32} className="text-emerald-500" />
              <p className="text-sm text-surface-700">
                Se o e-mail estiver cadastrado, você receberá as instruções de recuperação em breve.
              </p>
              <p className="text-xs text-surface-400">Verifique também a pasta de spam.</p>
            </div>
          )
          : (
            <div className="space-y-3">
              <p className="text-sm text-surface-600">
                Informe seu e-mail cadastrado e enviaremos as instruções para redefinir sua senha.
              </p>
              <div>
                <label className="form-label">E-mail</label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  className="form-input"
                  placeholder="seu@email.com"
                  autoFocus
                />
              </div>
            </div>
          )
        }
      </Modal>
    </div>
  )
}
