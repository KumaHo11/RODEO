'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { usePermissions, ROLE_LABELS, ROLE_COLORS } from '@/lib/usePermissions'
import { Check, ArrowRight, Loader2, Sprout, MapPin, ClipboardList, Users, Calendar, BookOpen, BarChart2, CheckSquare } from 'lucide-react'
import RodeoLogo from '@/components/RodeoLogo'

const MODULE_META: Record<string, { label: string; icon: React.ComponentType<any>; color: string }> = {
  dashboard:    { label: 'Panel principal',  icon: BarChart2,    color: 'bg-green-100 text-green-700' },
  mi_campo:     { label: 'Mi campo',         icon: MapPin,       color: 'bg-emerald-100 text-emerald-700' },
  rebanhos:     { label: 'Rebaños',          icon: Sprout,       color: 'bg-lime-100 text-lime-700' },
  agenda:       { label: 'Agenda',           icon: Calendar,     color: 'bg-blue-100 text-blue-700' },
  planificador: { label: 'Planificador',     icon: ClipboardList,color: 'bg-violet-100 text-violet-700' },
  bitacora:     { label: 'Bitácora',         icon: BookOpen,     color: 'bg-amber-100 text-amber-700' },
  insights:     { label: 'Insights',         icon: BarChart2,    color: 'bg-cyan-100 text-cyan-700' },
  equipo:       { label: 'Equipo',           icon: Users,        color: 'bg-pink-100 text-pink-700' },
  tareas:       { label: 'Tareas',           icon: CheckSquare,  color: 'bg-orange-100 text-orange-700' },
}

interface WelcomeScreenProps {
  orgName?: string
  onDismiss: () => void
}

export function WelcomeScreen({ orgName, onDismiss }: WelcomeScreenProps) {
  const { user, profile, refreshProfile } = useAuth()
  const { teamRole, roleLabel, roleColors, permissions } = usePermissions()
  const [dismissing, setDismissing] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Animate in after mount
    const t = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(t)
  }, [])

  const firstName = profile?.first_name || user?.email?.split('@')[0] || 'Bienvenido'

  const enabledModules = permissions
    ? Object.entries(permissions).filter(([, v]) => v === true).map(([k]) => k)
    : ['dashboard']

  const handleStart = async () => {
    setDismissing(true)
    try {
      if (user) {
        const idToken = await user.getIdToken()
        await fetch('/api/auth/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ is_first_login: false }),
        })
        await refreshProfile()
      }
    } catch (err) {
      console.warn('Could not mark first login:', err)
    }
    onDismiss()
  }

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center transition-all duration-700 ${
        mounted ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ background: 'linear-gradient(135deg, #052e16 0%, #14532d 40%, #166534 100%)' }}
    >
      {/* Decorative background pattern */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Animated dots decoration */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-green-400/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-emerald-300/10 rounded-full blur-3xl" />

      <div
        className={`relative z-10 w-full max-w-lg mx-4 transition-all duration-700 delay-100 ${
          mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
        }`}
      >
        {/* Card */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 text-white shadow-2xl">

          {/* Logo */}
          <div className="flex justify-center mb-6">
            <RodeoLogo variant="dark" size="xl" />
          </div>

          {/* Role badge */}
          {teamRole && (
            <div className="flex justify-center mb-4">
              <span className={`inline-flex items-center gap-2 text-xs font-black px-4 py-1.5 rounded-full ${roleColors.badge}`}>
                <span className={`w-2 h-2 rounded-full ${roleColors.dot}`} />
                {roleLabel}
              </span>
            </div>
          )}

          {/* Greeting */}
          <div className="text-center mb-6">
            <h1 className="text-3xl font-black tracking-tight mb-2">
              ¡Hola, {firstName}! 👋
            </h1>
            <p className="text-green-200 text-sm leading-relaxed">
              Fuiste invitado a colaborar en{' '}
              <span className="font-bold text-white">{orgName || 'el campo'}</span>
              .<br />Ya tenés acceso a los siguientes módulos:
            </p>
          </div>

          {/* Enabled modules grid */}
          <div className="grid grid-cols-3 gap-2 mb-8">
            {enabledModules.slice(0, 9).map((key) => {
              const meta = MODULE_META[key]
              if (!meta) return null
              const Icon = meta.icon
              return (
                <div
                  key={key}
                  className="flex flex-col items-center gap-1.5 bg-white/10 hover:bg-white/15 transition-colors rounded-2xl p-3"
                >
                  <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-[10px] font-bold text-green-100 text-center leading-tight">
                    {meta.label}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Tips */}
          <div className="bg-white/10 rounded-2xl p-4 mb-6 space-y-2">
            {[
              'Tu contraseña es privada — ni el dueño del campo puede verla.',
              'Podés completar tu perfil en cualquier momento desde el menú superior.',
              'Las notas y registros que crees quedan vinculados a tu usuario.',
            ].map((tip, i) => (
              <div key={i} className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-green-200 leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={handleStart}
            disabled={dismissing}
            className="w-full py-4 bg-white text-green-800 font-black rounded-2xl text-base hover:bg-green-50 transition-all shadow-xl disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {dismissing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Empezar a trabajar
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
