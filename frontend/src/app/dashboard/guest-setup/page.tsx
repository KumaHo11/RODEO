'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { Check, Eye, EyeOff, Loader2, User, Lock } from 'lucide-react'
import RodeoLogo from '@/components/RodeoLogo'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/usePermissions'

export default function GuestSetupPage() {
  const supabase = createClient()
  const { user, profile } = useAuth()
  const router = useRouter()

  const [step, setStep] = useState<'name' | 'password' | 'done'>('name')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [showPwd, setShowPwd]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  const teamRole = profile?.team_role as string | null
  const roleLabel = teamRole ? (ROLE_LABELS[teamRole] ?? teamRole) : 'Invitado'
  const roleColor = teamRole ? (ROLE_COLORS[teamRole] ?? ROLE_COLORS.OWNER) : ROLE_COLORS.OWNER

  // Pre-fill from profile if already set
  useEffect(() => {
    if (profile?.first_name) setFirstName(profile.first_name)
    if (profile?.last_name)  setLastName(profile.last_name)
  }, [profile])

  // If already set up, redirect
  useEffect(() => {
    if (profile && profile.onboarding_step !== -1 && profile.team_role) {
      router.replace('/dashboard')
    }
  }, [profile, router])

  // ── Step 1: Save name ───────────────────────────────────────────────────────
  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!firstName.trim()) { setError('Ingresá tu nombre'); return }
    setSaving(true)
    setError('')

    const { error: err } = await supabase.from('profiles').update({
      first_name: firstName.trim(),
      last_name: lastName.trim() || null,
    }).eq('id', user!.id)

    if (err) { setError('Error al guardar. Intentalo nuevamente.'); setSaving(false); return }
    setSaving(false)
    setStep('password')
  }

  // ── Step 2: Set password ────────────────────────────────────────────────────
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    setSaving(true)
    setError('')

    const { error: pwErr } = await supabase.auth.updateUser({ password })
    if (pwErr) { setError('Error al actualizar contraseña. Intentalo de nuevo.'); setSaving(false); return }

    // Mark setup complete
    await supabase.from('profiles').update({ onboarding_step: 3 }).eq('id', user!.id)

    setSaving(false)
    setStep('done')
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  // ── Done state ──────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-2">¡Todo listo, {firstName}!</h2>
          <p className="text-sm text-gray-500">Entrando al panel...</p>
          <div className="mt-4 flex justify-center">
            <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <RodeoLogo variant="light" size="lg" />
          </div>
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-black px-3 py-1 rounded-full ${roleColor.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${roleColor.dot}`} />
            {roleLabel}
          </span>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">

          {/* Green header */}
          <div className="bg-gradient-to-r from-green-700 to-emerald-600 px-8 py-6">
            <p className="text-[10px] font-black text-green-200 uppercase tracking-widest mb-1">
              {step === 'name' ? 'Paso 1 de 2' : 'Paso 2 de 2'}
            </p>
            <h1 className="text-xl font-black text-white">
              {step === 'name' ? '¿Cómo te llamás?' : 'Creá tu contraseña'}
            </h1>
            <p className="text-green-100 text-sm mt-1">
              {step === 'name'
                ? 'Así te van a ver tus compañeros de equipo.'
                : 'Elegí una contraseña segura para ingresar a Rodeo.'}
            </p>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-gray-100">
            <div
              className="h-full bg-green-500 transition-all duration-500"
              style={{ width: step === 'name' ? '50%' : '100%' }}
            />
          </div>

          <div className="p-8">

            {step === 'name' ? (
              <form onSubmit={handleNameSubmit} className="space-y-5">
                {/* First name */}
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">
                    Nombre *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      required
                      autoFocus
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      placeholder="Tu nombre"
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-green-500 focus:border-green-400 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Last name */}
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">
                    Apellido
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Tu apellido (opcional)"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-green-500 focus:border-green-400 outline-none transition-all"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={saving || !firstName.trim()}
                  className="w-full py-3.5 bg-green-600 text-white font-black rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Continuar →
                </button>
              </form>

            ) : (
              <form onSubmit={handlePasswordSubmit} className="space-y-5">
                {/* Password */}
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">
                    Nueva contraseña *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type={showPwd ? 'text' : 'password'}
                      required
                      autoFocus
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      className="w-full pl-10 pr-12 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-green-500 focus:border-green-400 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* Strength indicator */}
                  {password.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {[...Array(4)].map((_, i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            password.length >= (i + 1) * 2
                              ? password.length >= 8 ? 'bg-green-500' : 'bg-amber-400'
                              : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Confirm */}
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">
                    Confirmar contraseña *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type={showPwd ? 'text' : 'password'}
                      required
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="Repetí tu contraseña"
                      className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl text-sm font-bold focus:ring-2 focus:ring-green-500 outline-none transition-all ${
                        confirm && confirm !== password
                          ? 'border-red-300 focus:border-red-400'
                          : confirm && confirm === password
                          ? 'border-green-400'
                          : 'border-gray-200 focus:border-green-400'
                      }`}
                    />
                    {confirm && confirm === password && (
                      <Check className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                    )}
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setStep('name'); setError('') }}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors text-sm"
                  >
                    ← Atrás
                  </button>
                  <button
                    type="submit"
                    disabled={saving || password.length < 8 || password !== confirm}
                    className="flex-1 py-3 bg-green-600 text-white font-black rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Ingresar al panel
                  </button>
                </div>

                <p className="text-center text-[10px] text-gray-400">
                  Esta contraseña es tuya y privada. Rodeo no la comparte con el propietario del campo.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
