'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { usePermissions } from '@/lib/usePermissions'
import {
  Users, Plus, Mail, Trash2, UserCheck, UserX,
  Shield, Wrench, Stethoscope, HelpCircle, Crown,
  ChevronRight, Loader2, Check, X, ToggleLeft, ToggleRight,
  Copy, CheckCheck, Eye
} from 'lucide-react'

// ── Role config ────────────────────────────────────────────────────────────────
const ROLES = [
  {
    id: 'ADMIN',
    label: 'Administrador',
    desc: 'Acceso completo excepto facturación',
    icon: Shield,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    badge: 'bg-violet-100 text-violet-800',
    defaultPermissions: {
      dashboard: true, mi_campo: true, rebanhos: true, agenda: true,
      planificador: true, bitacora: true, insights: true, equipo: false, tareas: true,
    },
  },
  {
    id: 'CAPATAZ',
    label: 'Capataz',
    desc: 'Recorrida de campos, bitácora, rebaños',
    icon: Wrench,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    badge: 'bg-orange-100 text-orange-800',
    defaultPermissions: {
      dashboard: true, mi_campo: true, rebanhos: true, agenda: false,
      planificador: false, bitacora: true, insights: false, equipo: false, tareas: true,
    },
  },
  {
    id: 'VETERINARIO',
    label: 'Veterinario',
    desc: 'Solo agenda y notificaciones de eventos',
    icon: Stethoscope,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    badge: 'bg-blue-100 text-blue-800',
    defaultPermissions: {
      dashboard: true, mi_campo: false, rebanhos: true, agenda: true,
      planificador: false, bitacora: false, insights: false, equipo: false, tareas: true,
    },
  },
  {
    id: 'AYUDANTE',
    label: 'Ayudante',
    desc: 'Solo bitácora de potreros y fotos',
    icon: HelpCircle,
    color: 'text-gray-600',
    bg: 'bg-gray-50',
    badge: 'bg-gray-100 text-gray-700',
    defaultPermissions: {
      dashboard: true, mi_campo: false, rebanhos: false, agenda: false,
      planificador: false, bitacora: true, insights: false, equipo: false, tareas: true,
    },
  },
]

const ROLE_MAP = Object.fromEntries(ROLES.map(r => [r.id, r]))

const MODULES = [
  { key: 'dashboard',    label: 'Panel principal' },
  { key: 'mi_campo',     label: 'Mi campo' },
  { key: 'rebanhos',     label: 'Rebaños' },
  { key: 'agenda',       label: 'Agenda' },
  { key: 'planificador', label: 'Planificador' },
  { key: 'bitacora',     label: 'Bitácora' },
  { key: 'insights',     label: 'Insights' },
  { key: 'tareas',       label: 'Tareas' },
]

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })

// ── Page ──────────────────────────────────────────────────────────────────────
export default function EquipoPage() {
  const supabase = createClient()
  const { user } = useAuth()
  const { isOwner } = usePermissions()

  const [members, setMembers] = useState<any[]>([])
  const [invitations, setInvitations] = useState<any[]>([])
  const [orgId, setOrgId] = useState<string | null>(null)
  const [orgName, setOrgName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [loading, setLoading] = useState(true)

  // Invite modal
  const [modalOpen, setModalOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('CAPATAZ')
  const [invitePerms, setInvitePerms] = useState<Record<string, boolean>>(ROLE_MAP['CAPATAZ'].defaultPermissions)
  const [inviting, setInviting] = useState(false)
  const [inviteSent, setInviteSent] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data: profile } = await supabase.from('profiles').select('organization_id,team_role,first_name,last_name').eq('id', user.id).single()
    if (!profile?.organization_id) { setLoading(false); return }
    setOrgId(profile.organization_id)

    const { data: org } = await supabase.from('organizations').select('name,owner_id').eq('id', profile.organization_id).single()
    if (org) {
      setOrgName(org.name)
    }

    setOwnerName(`${profile.first_name || ''} ${profile.last_name || ''}`.trim() || user.email || 'Propietario')

    const [{ data: membersData }, { data: invitationsData }] = await Promise.all([
      supabase.from('profiles').select('id,first_name,last_name,avatar_url,team_role,permissions,is_active').eq('organization_id', profile.organization_id),
      supabase.from('team_invitations').select('*').eq('org_id', profile.organization_id).order('created_at', { ascending: false }),
    ])

    setMembers(membersData || [])
    setInvitations(invitationsData || [])
    setLoading(false)
  }, [supabase, user])

  useEffect(() => { load() }, [load])

  // ── Set perms when role changes ───────────────────────────────────────────
  const handleRoleChange = (role: string) => {
    setInviteRole(role)
    setInvitePerms(ROLE_MAP[role]?.defaultPermissions || {})
  }

  // ── Send invitation ───────────────────────────────────────────────────────
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId || !inviteEmail) return
    setInviting(true)
    setInviteError('')

    const { data: inv, error } = await supabase.from('team_invitations').insert([{
      org_id: orgId,
      invited_by: user!.id,
      email: inviteEmail,
      team_role: inviteRole,
      permissions: invitePerms,
    }]).select().single()

    if (error || !inv) {
      setInviteError('Error al crear la invitación. ¿Ya existe una invitación para ese email?')
      setInviting(false)
      return
    }

    const joinUrl = `${window.location.origin}/join?token=${inv.token}`

    // Send via Resend
    await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'invitation',
        to: inviteEmail,
        params: { orgName, inviterName: ownerName, role: inviteRole, joinUrl },
      }),
    })

    setInviting(false)
    setInviteSent(true)
    setTimeout(() => {
      setInviteSent(false)
      setModalOpen(false)
      setInviteEmail('')
      setInviteRole('CAPATAZ')
      setInvitePerms(ROLE_MAP['CAPATAZ'].defaultPermissions)
      load()
    }, 2500)
  }

  // ── Revoke invitation ─────────────────────────────────────────────────────
  const revokeInvitation = async (id: string) => {
    await supabase.from('team_invitations').update({ status: 'REVOKED' }).eq('id', id)
    load()
  }

  // ── Toggle member active ──────────────────────────────────────────────────
  const toggleMember = async (memberId: string, current: boolean) => {
    await supabase.from('profiles').update({ is_active: !current }).eq('id', memberId)
    load()
  }

  const copyJoinLink = (token: string) => {
    const url = `${window.location.origin}/join?token=${token}`
    navigator.clipboard.writeText(url)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Read-only banner for guests */}
      {!isOwner && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-5 py-3.5">
          <Eye className="w-4 h-4 text-blue-500 shrink-0" />
          <p className="text-sm text-blue-700 font-bold">
            Estás viendo el equipo en modo lectura. Solo el propietario puede invitar o gestionar miembros.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
            {members.length} miembro{members.length !== 1 ? 's' : ''} · {invitations.filter(i => i.status === 'PENDING').length} invitación{invitations.filter(i => i.status === 'PENDING').length !== 1 ? 'es' : ''} pendiente{invitations.filter(i => i.status === 'PENDING').length !== 1 ? 's' : ''}
          </p>
        </div>
        {isOwner && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 shadow-sm shadow-green-200 transition-all"
          >
            <Plus className="w-4 h-4" />
            Invitar al equipo
          </button>
        )}
      </div>

      {/* Roles info cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ROLES.map(role => (
          <div key={role.id} className={`${role.bg} rounded-2xl p-4 border border-gray-100`}>
            <role.icon className={`w-5 h-5 ${role.color} mb-2`} />
            <p className={`text-xs font-black ${role.color}`}>{role.label}</p>
            <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{role.desc}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-green-600 animate-spin" />
        </div>
      ) : (
        <>
          {/* Members list */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-green-600" /> Miembros activos
              </h2>
            </div>
            <div className="divide-y divide-gray-50">
              {members.map(member => {
                const role = ROLE_MAP[member.team_role || 'OWNER']
                const initials = member.first_name?.[0]?.toUpperCase() || '?'
                const isCurrentUser = member.id === user?.id
                return (
                  <div key={member.id} className="flex items-center gap-4 px-6 py-4">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white text-sm font-black shrink-0">
                      {member.avatar_url
                        ? <img src={member.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                        : initials
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-black text-gray-900">
                          {[member.first_name, member.last_name].filter(Boolean).join(' ') || 'Sin nombre'}
                        </p>
                        {isCurrentUser && (
                          <span className="text-[9px] font-black bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Tú</span>
                        )}
                        {!member.is_active && (
                          <span className="text-[9px] font-black bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Inactivo</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {member.team_role ? (
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${role?.badge || 'bg-gray-100 text-gray-700'}`}>
                            {role?.label || member.team_role}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                            <Crown className="w-2.5 h-2.5" /> Propietario
                          </span>
                        )}
                      </div>
                    </div>
                    {isOwner && !isCurrentUser && (
                      <button
                        onClick={() => toggleMember(member.id, member.is_active)}
                        className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors ${
                          member.is_active
                            ? 'text-gray-500 hover:bg-red-50 hover:text-red-600'
                            : 'text-green-600 hover:bg-green-50'
                        }`}
                      >
                        {member.is_active
                          ? <><UserX className="w-3.5 h-3.5" /> Deshabilitar</>
                          : <><UserCheck className="w-3.5 h-3.5" /> Habilitar</>
                        }
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Pending invitations */}
          {invitations.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-500" /> Invitaciones enviadas
                </h2>
              </div>
              <div className="divide-y divide-gray-50">
                {invitations.map(inv => {
                  const role = ROLE_MAP[inv.team_role]
                  const isExpired = new Date(inv.expires_at) < new Date()
                  const statusColor = inv.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : inv.status === 'ACCEPTED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  const statusLabel = ({ PENDING: 'Pendiente', ACCEPTED: 'Aceptada', REVOKED: 'Revocada' } as Record<string, string>)[inv.status] || inv.status
                  return (
                    <div key={inv.id} className="flex items-center gap-4 px-6 py-4">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                        <Mail className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{inv.email}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {role && (
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${role.badge}`}>{role.label}</span>
                          )}
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${statusColor}`}>{statusLabel}</span>
                          <span className="text-[9px] text-gray-400">Enviada: {fmtDate(inv.created_at)}</span>
                          {isExpired && inv.status === 'PENDING' && (
                            <span className="text-[9px] font-bold text-red-500">Expirada</span>
                          )}
                        </div>
                      </div>
                      {inv.status === 'PENDING' && isOwner && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => copyJoinLink(inv.token)}
                            className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Copiar link de invitación"
                          >
                            {copiedToken === inv.token ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => revokeInvitation(inv.id)}
                            className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {members.length === 1 && invitations.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
              <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <h3 className="font-black text-gray-800 mb-1">Todavía no tenés equipo</h3>
              <p className="text-sm text-gray-400 max-w-xs mx-auto">
                Invitá a tu capataz, veterinario o ayudante para colaborar en la gestión del campo.
              </p>
              {isOwner && (
                <button
                  onClick={() => setModalOpen(true)}
                  className="mt-5 px-5 py-2.5 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-colors"
                >
                  Invitar primer miembro
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Invite Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-3xl z-10">
              <h2 className="font-black text-gray-900 text-base">Invitar al equipo</h2>
              <button onClick={() => setModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500">
                <X className="w-4 h-4" />
              </button>
            </div>

            {inviteSent ? (
              <div className="p-10 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-black text-gray-900 mb-1">¡Invitación enviada!</h3>
                <p className="text-sm text-gray-500">El email con el link de acceso fue enviado a <strong>{inviteEmail}</strong></p>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="p-6 space-y-5">
                {/* Email */}
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Email del invitado *</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="veterinario@ejemplo.com"
                  />
                </div>

                {/* Role selector */}
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">Rol</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLES.map(role => (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => handleRoleChange(role.id)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all ${
                          inviteRole === role.id
                            ? `${role.bg} border-current ring-2 ring-offset-1 ${role.color.replace('text-', 'ring-')}`
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <role.icon className={`w-4 h-4 ${inviteRole === role.id ? role.color : 'text-gray-400'}`} />
                        <div>
                          <p className={`text-xs font-black leading-none ${inviteRole === role.id ? role.color : 'text-gray-700'}`}>{role.label}</p>
                          <p className="text-[9px] text-gray-400 mt-0.5 leading-tight">{role.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Permission toggles */}
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">Módulos habilitados</label>
                  <div className="space-y-1.5">
                    {MODULES.map(mod => (
                      <div key={mod.key} className="flex items-center justify-between py-1.5 px-3 rounded-xl hover:bg-gray-50">
                        <span className="text-sm font-bold text-gray-700">{mod.label}</span>
                        <button
                          type="button"
                          onClick={() => setInvitePerms(p => ({ ...p, [mod.key]: !p[mod.key] }))}
                          className={`w-11 h-6 rounded-full transition-all duration-200 relative flex-shrink-0 ${invitePerms[mod.key] ? 'bg-green-500' : 'bg-gray-200'}`}
                        >
                          <div className={`w-4 h-4 bg-white rounded-full shadow-sm absolute top-1 transition-all duration-200 ${invitePerms[mod.key] ? 'left-6' : 'left-1'}`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {inviteError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{inviteError}</div>
                )}

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setModalOpen(false)}
                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" disabled={inviting || !inviteEmail}
                    className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                    {inviting
                      ? <><Loader2 className="w-4 h-4 animate-spin" />Enviando...</>
                      : <><Mail className="w-4 h-4" />Enviar invitación</>
                    }
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
