'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import {
  Loader2, Check, X, Users, Eye, EyeOff, Lock, ArrowRight
} from 'lucide-react'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/usePermissions'
import RodeoLogo from '@/components/RodeoLogo'
import {
  getAuth, createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth'
import firebaseApp from '@/lib/firebase/client'
import clsx from 'clsx'

type Step = 'loading' | 'error' | 'set-password' | 'login' | 'accepting' | 'done'

function JoinContent() {
  const { user, isLoading, refreshProfile } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  const [invitation, setInvitation] = useState<any>(null)
  const [step, setStep] = useState<Step>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  // Password setup fields
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [busy, setBusy] = useState(false)

  // ── Load invitation ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isLoading) return
    const init = async () => {
      if (!token) { setErrorMsg('Link de invitación inválido.'); setStep('error'); return }

      const res = await fetch(`/api/invitations?token=${token}`)
      const data = await res.json()

      if (!res.ok || !data.invitation) {
        setErrorMsg(data.error || 'Esta invitación no es válida o ya fue utilizada.')
        setStep('error')
        return
      }
      if (new Date(data.invitation.expires_at) < new Date()) {
        setErrorMsg('Esta invitación expiró. Pedí al propietario que envíe una nueva.')
        setStep('error')
        return
      }

      setInvitation(data.invitation)

      // If already logged in → accept directly
      if (user) {
        acceptInvitation(user, data.invitation)
      } else {
        // New user: ask them to create a password
        setStep('set-password')
      }
    }
    init()
  }, [token, isLoading])  

  // ── Accept invitation (calls API) ──────────────────────────────────────────
  const acceptInvitation = async (firebaseUser: any, inv: any) => {
    setStep('accepting')
    try {
      const idToken = await firebaseUser.getIdToken(true)
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ token }),
      })
      if (!res.ok) {
        const d = await res.json()
        setErrorMsg(d.error || 'Error al aceptar la invitación.')
        setStep('error')
        return
      }
      await refreshProfile()
      setStep('done')

      // Redirect to the first permitted route (never hardcode /dashboard)
      const ORDERED_ROUTES: { key: string; path: string }[] = [
        { key: 'dashboard',     path: '/dashboard' },
        { key: 'mi_campo',      path: '/dashboard/mi-campo' },
        { key: 'rebanhos',      path: '/dashboard/herds' },
        { key: 'agenda',        path: '/dashboard/agenda' },
        { key: 'planificador',  path: '/dashboard/grazing' },
        { key: 'bitacora',      path: '/dashboard/bitacora' },
        { key: 'insights',      path: '/dashboard/insights' },
        { key: 'tareas',        path: '/dashboard/tareas' },
        { key: 'equipo',        path: '/dashboard/equipo' },
      ]
      const perms = inv?.permissions ?? {}
      const firstRoute = ORDERED_ROUTES.find(r => perms[r.key] === true)?.path ?? '/dashboard'
      setTimeout(() => router.push(firstRoute), 1800)
    } catch (err: any) {
      setErrorMsg(err.message || 'Error inesperado.')
      setStep('error')
    }
  }

  // ── Create account + accept ────────────────────────────────────────────────
  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setErrorMsg('Mínimo 8 caracteres'); return }
    if (password !== confirm) { setErrorMsg('Las contraseñas no coinciden'); return }
    setBusy(true)
    setErrorMsg('')

    const auth = getAuth(firebaseApp)
    const email = invitation.email

    try {
      let firebaseUser
      let isNewAccount = false

      // Try to create account first
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password)
        firebaseUser = cred.user
        isNewAccount = true
      } catch (createErr: any) {
        if (createErr.code === 'auth/email-already-in-use') {
          // Account exists → sign in
          try {
            const cred = await signInWithEmailAndPassword(auth, email, password)
            firebaseUser = cred.user
          } catch {
            setErrorMsg('Ya tenés una cuenta con este email. Usá tu contraseña existente o recuperala.')
            setBusy(false)
            return
          }
        } else {
          setErrorMsg(createErr.message || 'Error al crear la cuenta.')
          setBusy(false)
          return
        }
      }

      // For new accounts, wait briefly for Firebase to propagate the user
      // before calling getIdToken(true) — this prevents the 400 token error
      if (isNewAccount) {
        await new Promise(res => setTimeout(res, 1200))
      }

      // Get a fresh token (force refresh)
      let idToken: string
      try {
        idToken = await firebaseUser.getIdToken(true)
      } catch {
        // If force-refresh fails, try without force (use cached token)
        idToken = await firebaseUser.getIdToken(false)
      }

      // Ensure profile exists in DB (minimal, no org — accept will assign org/role)
      await fetch('/api/auth/ensure-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ email }),
      })

      await acceptInvitation(firebaseUser, invitation)
    } catch (err: any) {
      setErrorMsg(err.message || 'Error inesperado.')
      setBusy(false)
    }
  }


  // ── Derived ────────────────────────────────────────────────────────────────
  const orgName = invitation?.org_name || 'el campo'
  const roleLabel = invitation ? (ROLE_LABELS[invitation.team_role] ?? invitation.team_role) : ''
  const roleColors = invitation ? (ROLE_COLORS[invitation.team_role] ?? ROLE_COLORS.OWNER) : ROLE_COLORS.OWNER
  const moduleLabels: Record<string, string> = {
    dashboard: 'Panel', mi_campo: 'Mi campo', rebanhos: 'Rodeos',
    agenda: 'Agenda', planificador: 'Planificador', bitacora: 'Bitácora',
    insights: 'Insights', tareas: 'Tareas',
  }
  const enabledModules = invitation?.permissions
    ? Object.entries(invitation.permissions).filter(([, v]) => v === true).map(([k]) => k)
    : []

  // ── Renders ────────────────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 p-10 text-center">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-7 h-7 text-red-600" />
          </div>
          <h2 className="text-lg font-black text-gray-900 mb-2">Invitación inválida</h2>
          <p className="text-sm text-gray-500 mb-6">{errorMsg}</p>
          <button onClick={() => router.push('/login')}
            className="px-6 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors text-sm">
            Ir al login
          </button>
        </div>
      </div>
    )
  }

  if (step === 'accepting' || step === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${step === 'done' ? 'bg-green-100' : 'bg-gray-100'}`}>
            {step === 'done'
              ? <Check className="w-8 h-8 text-green-600" />
              : <Loader2 className="w-8 h-8 text-green-600 animate-spin" />}
          </div>
          <h2 className="text-lg font-black text-gray-900 mb-1">
            {step === 'done' ? '¡Bienvenido al equipo!' : 'Configurando tu acceso...'}
          </h2>
          <p className="text-sm text-gray-500">
            {step === 'done' ? 'Entrando al panel...' : 'Un momento...'}
          </p>
        </div>
      </div>
    )
  }

  // step === 'set-password': new user creates password
  return (
    <div className="flex min-h-screen bg-white font-sans">
      {/* Visual panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-green-700 items-center justify-center p-12 relative overflow-hidden">
        <div className="relative z-10 flex flex-col items-center gap-6 text-center">
          <RodeoLogo variant="dark" size="xl" showTagline />
          <div className="mt-2 space-y-2">
            <p className="text-green-100 text-sm font-medium">Fuiste invitado a colaborar en</p>
            <p className="text-white text-2xl font-black">{orgName}</p>
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-full ${roleColors.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${roleColors.dot}`} />
              {roleLabel}
            </span>
          </div>
          {enabledModules.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5 justify-center max-w-xs">
              {enabledModules.map(k => (
                <span key={k} className="flex items-center gap-1 text-[10px] font-bold bg-white/20 text-white px-2.5 py-1 rounded-full">
                  <Check className="w-2.5 h-2.5" /> {moduleLabels[k] || k}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, white 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-24">
        <div className="w-full max-w-sm">
          {/* Mobile header */}
          <div className="lg:hidden text-center mb-8">
            <RodeoLogo variant="light" size="lg" />
            <p className="text-sm text-gray-500 mt-3">Invitación de <strong>{orgName}</strong></p>
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-full mt-2 ${roleColors.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${roleColors.dot}`} />{roleLabel}
            </span>
          </div>

          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-green-600" />
              <span className={`inline-flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-full ${roleColors.badge}`}>
                {roleLabel}
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-gray-950 mb-2">
              Creá tu contraseña
            </h1>
            <p className="text-gray-500 text-sm">
              Tu cuenta será <strong>{invitation?.email}</strong>. Elegí una contraseña para ingresar a Rodeo.
            </p>
          </div>

          <form onSubmit={handleSetPassword} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Nueva contraseña *</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPwd ? 'text' : 'password'} required autoFocus
                  value={password} onChange={e => { setPassword(e.target.value); setErrorMsg('') }}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-green-500/30 focus:border-green-500 outline-none transition-all"
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="flex gap-1 mt-1">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                      password.length >= (i + 1) * 2
                        ? password.length >= 8 ? 'bg-green-500' : 'bg-amber-400'
                        : 'bg-gray-200'
                    }`} />
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Confirmar contraseña *</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPwd ? 'text' : 'password'} required
                  value={confirm} onChange={e => { setConfirm(e.target.value); setErrorMsg('') }}
                  placeholder="Repetí tu contraseña"
                  className={`w-full pl-10 pr-10 py-3 bg-gray-50 border rounded-xl text-sm font-medium focus:ring-2 focus:ring-green-500/30 outline-none transition-all ${
                    confirm && confirm !== password ? 'border-red-300' : confirm && confirm === password ? 'border-green-400' : 'border-gray-200 focus:border-green-500'
                  }`}
                />
                {confirm && confirm === password && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                )}
              </div>
            </div>

            {errorMsg && (
              <p className="text-red-600 text-xs bg-red-50 border border-red-100 rounded-xl px-4 py-3">{errorMsg}</p>
            )}

            <button type="submit"
              disabled={busy || password.length < 8 || password !== confirm}
              className="w-full py-3 bg-green-600 text-white font-black rounded-xl hover:bg-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-lg shadow-green-600/20">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Crear cuenta y unirme <ArrowRight className="w-4 h-4" />
            </button>

            <p className="text-center text-[10px] text-gray-400 leading-relaxed">
              Al crear tu cuenta aceptás los términos de uso de Rodeo. Tu contraseña es privada y no la comparte con el dueño del campo.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      </div>
    }>
      <JoinContent />
    </Suspense>
  )
}
