'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch } from '@/lib/apiFetch'
import { Check, Eye, EyeOff, Loader2, User, Lock, ArrowRight } from 'lucide-react'
import RodeoLogo from '@/components/RodeoLogo'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/usePermissions'
import { motion } from 'framer-motion'

export default function GuestSetupPage() {
  const { user, profile, refreshProfile } = useAuth()
  const router = useRouter()

  const [step, setStep] = useState<'name' | 'password' | 'done'>('name')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [showPwd, setShowPwd]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  const teamRole  = profile?.team_role as string | null
  const roleLabel = teamRole ? (ROLE_LABELS[teamRole] ?? teamRole) : 'Invitado'
  const roleColor = teamRole ? (ROLE_COLORS[teamRole] ?? ROLE_COLORS.OWNER) : ROLE_COLORS.OWNER

  // Pre-fill from profile
  useEffect(() => {
    if (profile?.first_name) setFirstName(profile.first_name)
    if (profile?.last_name)  setLastName(profile.last_name)
  }, [profile])

  // If already fully set up (first_name exists AND step != -1), redirect to dashboard
  useEffect(() => {
    if (profile && profile.onboarding_step !== -1 && profile.team_role && profile.first_name) {
      router.replace('/dashboard')
    }
  }, [profile, router])

  // ── Step 1: Save name ───────────────────────────────────────────────────────
  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!firstName.trim()) { setError('Ingresá tu nombre'); return }
    setSaving(true)
    setError('')

    const res = await apiFetch('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
      }),
    })

    if (!res.ok) { setError('Error al guardar. Intentalo nuevamente.'); setSaving(false); return }
    setSaving(false)
    setStep('password')
  }

  // ── Step 2: Set password via Admin SDK API ──────────────────────────────────
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    setSaving(true)
    setError('')

    try {
      // Use Admin SDK API route — no re-auth required
      const res = await apiFetch('/api/auth/set-password', {
        method: 'POST',
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Error al actualizar contraseña.')
        setSaving(false)
        return
      }
    } catch {
      setError('Error al actualizar contraseña. Intentalo de nuevo.')
      setSaving(false)
      return
    }

    // Mark setup complete: set onboarding_step to 0 (guest, done with setup)
    await apiFetch('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({ onboarding_step: 0 }),
    })

    // Refresh cached profile before navigating
    await refreshProfile()

    setSaving(false)
    setStep('done')
    setTimeout(() => router.push('/dashboard'), 1800)
  }

  // ── Done state ──────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-2">¡Todo listo, {firstName}!</h2>
          <p className="text-sm text-gray-500">Entrando al panel...</p>
          <div className="mt-4 flex justify-center">
            <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-white font-sans">

      {/* Visual side */}
      <div className="hidden lg:flex lg:w-1/2 bg-green-700 items-center justify-center p-12 relative overflow-hidden shadow-[inset_-20px_0_40px_rgba(0,0,0,0.05)]">
        <div className="relative z-10 flex flex-col items-center gap-4">
          <RodeoLogo variant="dark" size="xl" showTagline={true} />
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-full ${roleColor.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${roleColor.dot}`} />
            {roleLabel}
          </span>
        </div>
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, white 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
      </div>

      {/* Form side */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-24">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <RodeoLogo variant="light" size="lg" />
            <div className="mt-3">
              <span className={`inline-flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-full ${roleColor.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${roleColor.dot}`} />
                {roleLabel}
              </span>
            </div>
          </div>

          {/* Progress stepper */}
          <div className="flex items-center gap-2 mb-8">
            {['Nombre', 'Contraseña'].map((label, i) => {
              const isActive = (i === 0 && step === 'name') || (i === 1 && step === 'password')
              const isDone = (i === 0 && step === 'password')
              return (
                <div key={label} className="flex items-center gap-2 flex-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 transition-all ${
                    isDone ? 'bg-green-600 text-white' : isActive ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {isDone ? <Check className="w-3 h-3" /> : i + 1}
                  </div>
                  <span className={`text-xs font-bold ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>{label}</span>
                  {i < 1 && <div className={`flex-1 h-px ${isDone ? 'bg-green-600' : 'bg-gray-100'}`} />}
                </div>
              )
            })}
          </div>

          {step === 'name' ? (
            <motion.div key="name" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <div className="mb-8">
                <h2 className="text-3xl font-black tracking-tight text-gray-950 mb-2">¿Cómo te llamás?</h2>
                <p className="text-gray-500 text-sm">Así te van a ver tus compañeros en el equipo.</p>
              </div>

              <form onSubmit={handleNameSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Nombre *</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text" required autoFocus
                      value={firstName} onChange={e => setFirstName(e.target.value)}
                      placeholder="Tu nombre"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-green-500/30 focus:border-green-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Apellido</label>
                  <input
                    type="text"
                    value={lastName} onChange={e => setLastName(e.target.value)}
                    placeholder="Tu apellido (opcional)"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-green-500/30 focus:border-green-500 outline-none transition-all"
                  />
                </div>

                {error && <p className="text-red-600 text-xs bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>}

                <button
                  type="submit" disabled={saving || !firstName.trim()}
                  className="w-full py-3 bg-green-600 text-white font-black rounded-xl hover:bg-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-lg shadow-green-600/20"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Continuar <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div key="password" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <div className="mb-8">
                <h2 className="text-3xl font-black tracking-tight text-gray-950 mb-2">Creá tu contraseña</h2>
                <p className="text-gray-500 text-sm">Elegí una contraseña segura para ingresar a Rodeo.</p>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Nueva contraseña *</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type={showPwd ? 'text' : 'password'} required autoFocus
                      value={password} onChange={e => setPassword(e.target.value)}
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
                      value={confirm} onChange={e => setConfirm(e.target.value)}
                      placeholder="Repetí tu contraseña"
                      className={`w-full pl-10 pr-10 py-3 bg-gray-50 border rounded-xl text-sm font-medium focus:ring-2 focus:ring-green-500/30 outline-none transition-all ${
                        confirm && confirm !== password ? 'border-red-300 focus:border-red-400'
                        : confirm && confirm === password ? 'border-green-400' : 'border-gray-200 focus:border-green-500'
                      }`}
                    />
                    {confirm && confirm === password && (
                      <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                    )}
                  </div>
                </div>

                {error && <p className="text-red-600 text-xs bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>}

                <div className="flex gap-3">
                  <button type="button" onClick={() => { setStep('name'); setError('') }}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all text-sm">
                    ← Atrás
                  </button>
                  <button type="submit" disabled={saving || password.length < 8 || password !== confirm}
                    className="flex-1 py-3 bg-green-600 text-white font-black rounded-xl hover:bg-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-lg shadow-green-600/20">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Ingresar al panel
                  </button>
                </div>

                <p className="text-center text-[10px] text-gray-400">
                  Esta contraseña es tuya y privada. Rodeo no la comparte con el propietario del campo.
                </p>
              </form>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
