'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Check, X, Users, LogIn } from 'lucide-react'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/usePermissions'
import RodeoLogo from '@/components/RodeoLogo'
import clsx from 'clsx'

function JoinContent() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  const [invitation, setInvitation] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [accepting, setAccepting] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const init = async () => {
      if (!token) { setError('Link de invitación inválido.'); setLoading(false); return }

      const { data: { user: currentUser } } = await supabase.auth.getUser()
      setUser(currentUser)

      const { data: inv, error: invErr } = await supabase
        .from('team_invitations')
        .select('*, organizations(name)')
        .eq('token', token)
        .eq('status', 'PENDING')
        .single()

      if (invErr || !inv) {
        setError('Esta invitación no es válida o ya fue utilizada.')
        setLoading(false)
        return
      }

      if (new Date(inv.expires_at) < new Date()) {
        setError('Esta invitación expiró. Pedí al propietario que te envíe una nueva.')
        setLoading(false)
        return
      }

      setInvitation(inv)
      setLoading(false)
    }
    init()
  }, [token, supabase])

  const handleAccept = async () => {
    if (!invitation || !user) return
    setAccepting(true)

    // 1. Link user to org + set role + permissions
    //    onboarding_step = -1 signals that guest-setup is pending
    await supabase.from('profiles').update({
      organization_id: invitation.org_id,
      team_role: invitation.team_role,
      permissions: invitation.permissions,
      onboarding_step: -1,
    }).eq('id', user.id)

    // 2. Mark invitation as accepted
    await supabase.from('team_invitations').update({ status: 'ACCEPTED' }).eq('id', invitation.id)

    // 3. Create welcome notification
    await supabase.from('notifications').insert([{
      org_id: invitation.org_id,
      user_id: user.id,
      type: 'INVITACION',
      title: `¡Bienvenido al equipo de ${invitation.organizations?.name || 'Rodeo'}!`,
      body: `Tu rol es ${ROLE_LABELS[invitation.team_role] || invitation.team_role}. Configurá tu cuenta para empezar.`,
    }])

    setAccepted(true)
    setAccepting(false)
    // Redirect to guest-setup (middleware will also enforce this via onboarding_step = -1)
    setTimeout(() => router.push('/dashboard/guest-setup'), 2000)
  }

  const orgName = invitation?.organizations?.name || 'el campo'
  const role = invitation ? (ROLE_LABELS[invitation.team_role] || invitation.team_role) : ''
  const roleColors = invitation ? (ROLE_COLORS[invitation.team_role] ?? ROLE_COLORS.OWNER) : ROLE_COLORS.OWNER

  const goToLogin = () => {
    router.push(`/login?next=/join?token=${token}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-1">
            <RodeoLogo variant="light" size="lg" />
          </div>
          <p className="text-xs text-gray-400 font-bold mt-1 tracking-widest uppercase">Gestión Ganadera Regenerativa</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">

          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 text-green-600 animate-spin mx-auto mb-4" />
              <p className="font-bold text-gray-500">Verificando invitación...</p>
            </div>

          ) : error ? (
            <div className="p-10 text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <X className="w-7 h-7 text-red-600" />
              </div>
              <h2 className="text-lg font-black text-gray-900 mb-2">Invitación inválida</h2>
              <p className="text-sm text-gray-500">{error}</p>
              <button
                onClick={() => router.push('/login')}
                className="mt-6 px-6 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors text-sm"
              >
                Ir al login
              </button>
            </div>

          ) : accepted ? (
            <div className="p-10 text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-7 h-7 text-green-600" />
              </div>
              <h2 className="text-lg font-black text-gray-900 mb-2">¡Bienvenido al equipo!</h2>
              <p className="text-sm text-gray-500">Configurando tu cuenta...</p>
              <div className="mt-4 flex justify-center">
                <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
              </div>
            </div>

          ) : (
            <>
              {/* Header con gradiente verde */}
              <div className="bg-gradient-to-r from-green-700 to-emerald-600 px-8 py-7 text-center">
                <Users className="w-10 h-10 text-green-100 mx-auto mb-3" />
                <h2 className="text-xl font-black text-white">Invitación al equipo</h2>
                <p className="text-green-100 text-sm mt-1">Fuiste invitado a colaborar en <strong>{orgName}</strong></p>
              </div>

              <div className="p-8 space-y-6">

                {/* Info de role */}
                <div className="bg-gray-50 rounded-2xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-green-600 flex items-center justify-center text-white font-black text-base shrink-0">
                      {orgName[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-900">{orgName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={clsx('text-[10px] font-black px-2.5 py-1 rounded-full', roleColors.badge)}>
                          {role}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Permissions preview */}
                {invitation?.permissions && (
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Módulos habilitados</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(invitation.permissions)
                        .filter(([, v]) => v === true)
                        .map(([key]) => {
                          const labels: Record<string, string> = {
                            dashboard: 'Panel', mi_campo: 'Mi campo', rebanhos: 'Rebaños',
                            agenda: 'Agenda', planificador: 'Planificador', bitacora: 'Bitácora',
                            insights: 'Insights', equipo: 'Equipo', tareas: 'Tareas',
                          }
                          return (
                            <span key={key} className="flex items-center gap-1 text-[10px] font-bold bg-green-100 text-green-800 px-2.5 py-1 rounded-full">
                              <Check className="w-3 h-3" /> {labels[key] || key}
                            </span>
                          )
                        })}
                    </div>
                  </div>
                )}

                {/* ── State: not logged in ── */}
                {!user ? (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-500 text-center leading-relaxed">
                      Para aceptar esta invitación, necesitás ingresar a tu cuenta.
                    </p>
                    <button
                      onClick={goToLogin}
                      className="w-full py-3.5 bg-green-600 text-white font-black rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <LogIn className="w-4 h-4" /> Iniciar sesión para aceptar
                    </button>
                    <p className="text-center text-xs text-gray-400">
                      ¿No tenés cuenta?{' '}
                      <button
                        onClick={() => router.push(`/register`)}
                        className="text-green-600 font-bold hover:underline"
                      >
                        Registrate aquí
                      </button>
                    </p>
                  </div>

                ) : (
                  /* ── State: logged in ── */
                  <button
                    onClick={handleAccept}
                    disabled={accepting}
                    className="w-full py-3.5 bg-green-600 text-white font-black rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {accepting
                      ? <><Loader2 className="w-4 h-4 animate-spin" />Procesando...</>
                      : <><Check className="w-4 h-4" />Aceptar invitación</>
                    }
                  </button>
                )}
              </div>
            </>
          )}
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
