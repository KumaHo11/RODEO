'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch } from '@/lib/apiFetch'
import { usePermissions } from '@/lib/usePermissions'
import {
  Users, Plus, Mail, Trash2, UserCheck, UserX,
  Shield, Wrench, Stethoscope, HelpCircle, Crown,
  Loader2, Check, X, Eye, Copy, CheckCheck,
  ChevronRight, Pencil, Save, Star, AlertCircle, BadgePlus
} from 'lucide-react'

// ── Role config ────────────────────────────────────────────────────────────────
const PRESET_ROLES = [
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

const ROLE_MAP = Object.fromEntries(PRESET_ROLES.map(r => [r.id, r]))

const MODULES = [
  { key: 'dashboard',    label: 'Panel principal',  desc: 'Vista general del establecimiento' },
  { key: 'mi_campo',     label: 'Mi campo',          desc: 'Mapa y gestión de potreros' },
  { key: 'rebanhos',     label: 'Rebaños',           desc: 'Gestión de animales y majadas' },
  { key: 'agenda',       label: 'Agenda',            desc: 'Eventos veterinarios y calendarios' },
  { key: 'planificador', label: 'Planificador',      desc: 'Planificación de pastoreos' },
  { key: 'bitacora',     label: 'Bitácora',          desc: 'Notas de campo y registros' },
  { key: 'insights',     label: 'Insights',          desc: 'Análisis y reportes' },
  { key: 'tareas',       label: 'Tareas',            desc: 'Por hacer y asignaciones' },
  { key: 'equipo',       label: 'Equipo',            desc: 'Ver miembros (solo lectura)' },
]

const EMPTY_PERMS = Object.fromEntries(MODULES.map(m => [m.key, false]))

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })

type Tab = 'members' | 'pending' | 'history'

// ── Subcomponents ──────────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`w-11 h-6 rounded-full transition-all duration-200 relative flex-shrink-0 ${on ? 'bg-green-500' : 'bg-gray-200'}`}
    >
      <div className={`w-4 h-4 bg-white rounded-full shadow-sm absolute top-1 transition-all duration-200 ${on ? 'left-6' : 'left-1'}`} />
    </button>
  )
}

function RoleBadge({ roleId, customRoles }: { roleId?: string; customRoles: any[] }) {
  if (!roleId) {
    return (
      <span className="flex items-center gap-1 text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
        <Crown className="w-2.5 h-2.5" /> Propietario
      </span>
    )
  }
  const preset = ROLE_MAP[roleId]
  if (preset) {
    return <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${preset.badge}`}>{preset.label}</span>
  }
  const custom = customRoles.find(r => r.name === roleId)
  if (custom) {
    return <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{custom.label}</span>
  }
  return <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{roleId}</span>
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function EquipoPage() {
  const { user } = useAuth()
  const { isOwner } = usePermissions()

  const [members, setMembers]     = useState<any[]>([])
  const [invitations, setInvitations] = useState<any[]>([])
  const [customRoles, setCustomRoles] = useState<any[]>([])
  const [orgName, setOrgName]     = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [loading, setLoading]     = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('members')

  // Copy link
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  // ── Invite modal state ─────────────────────────────────────────────────────
  const [modalOpen, setModalOpen]   = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteFirstName, setInviteFirstName] = useState('')
  const [inviteLastName, setInviteLastName]   = useState('')
  const [inviteRole, setInviteRole]   = useState('CAPATAZ')
  const [invitePerms, setInvitePerms] = useState<Record<string, boolean>>(
    ROLE_MAP['CAPATAZ'].defaultPermissions
  )
  const [inviting, setInviting]     = useState(false)
  const [inviteSent, setInviteSent] = useState(false)
  const [inviteError, setInviteError] = useState('')

  // ── New custom role modal ──────────────────────────────────────────────────
  const [newRoleModalOpen, setNewRoleModalOpen] = useState(false)
  const [newRoleLabel, setNewRoleLabel]         = useState('')
  const [newRoleDesc, setNewRoleDesc]           = useState('')
  const [newRolePerms, setNewRolePerms]         = useState<Record<string,boolean>>(EMPTY_PERMS)
  const [savingRole, setSavingRole]             = useState(false)
  const [newRoleError, setNewRoleError]         = useState('')

  // ── Edit permissions drawer ────────────────────────────────────────────────
  const [editMember, setEditMember]           = useState<any>(null)
  const [editPerms, setEditPerms]             = useState<Record<string, boolean>>({})
  const [editRole, setEditRole]               = useState('')
  const [savingPerms, setSavingPerms]         = useState(false)
  const [savePermsSuccess, setSavePermsSuccess] = useState(false)

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [teamRes, orgRes, rolesRes] = await Promise.all([
      apiFetch('/api/team'),
      apiFetch('/api/organizations'),
      apiFetch('/api/roles'),
    ])

    const teamData  = teamRes.ok  ? await teamRes.json()                  : { members: [], invitations: [] }
    const orgData   = orgRes.ok   ? (await orgRes.json()).organization     : null
    const rolesData = rolesRes.ok ? (await rolesRes.json()).roles          : []

    if (orgData) setOrgName(orgData.name || '')
    setCustomRoles(rolesData)

    const me = teamData.members?.find((m: any) => m.firebase_uid === user.uid)
    setOwnerName(
      me ? `${me.first_name || ''} ${me.last_name || ''}`.trim() || user.email || 'Propietario'
         : user.email || 'Propietario'
    )

    setMembers(teamData.members || [])
    setInvitations(teamData.invitations || [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  // ── Derived data ──────────────────────────────────────────────────────────
  const pendingInvitations  = invitations.filter(i => i.status === 'PENDING')
  const historyInvitations  = invitations.filter(i => i.status !== 'PENDING')

  // ── Invite handlers ───────────────────────────────────────────────────────
  const handleRoleChange = (roleId: string) => {
    setInviteRole(roleId)
    const preset = ROLE_MAP[roleId]
    if (preset) {
      setInvitePerms(preset.defaultPermissions)
    } else {
      const custom = customRoles.find(r => r.name === roleId)
      setInvitePerms(custom?.permissions || EMPTY_PERMS)
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail) return
    setInviting(true)
    setInviteError('')

    const res = await apiFetch('/api/invitations', {
      method: 'POST',
      body: JSON.stringify({
        email: inviteEmail,
        first_name: inviteFirstName.trim() || undefined,
        last_name: inviteLastName.trim() || undefined,
        team_role: inviteRole,
        permissions: invitePerms,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      setInviteError(err.error || 'Error al crear la invitación.')
      setInviting(false)
      return
    }

    const { inviteLink } = await res.json()

    // Email is sent server-side in the API, but also call send-email for backward compat
    await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'invitation',
        to: inviteEmail,
        params: { orgName, inviterName: ownerName, role: inviteRole, joinUrl: inviteLink },
      }),
    }).catch(() => {})

    setInviting(false)
    setInviteSent(true)
    setTimeout(() => {
      setInviteSent(false)
      setModalOpen(false)
      setInviteEmail('')
      setInviteFirstName('')
      setInviteLastName('')
      setInviteRole('CAPATAZ')
      setInvitePerms(ROLE_MAP['CAPATAZ'].defaultPermissions)
      load()
    }, 2500)
  }

  const revokeInvitation = async (id: string) => {
    await apiFetch(`/api/invitations/${id}`, { method: 'DELETE' })
    load()
  }

  const copyJoinLink = (token: string) => {
    const url = `${window.location.origin}/join?token=${token}`
    navigator.clipboard.writeText(url)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  // ── Toggle member active ──────────────────────────────────────────────────
  const toggleMember = async (memberId: string, current: boolean) => {
    const res = await apiFetch(`/api/team/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: !current }),
    })
    if (res.ok) {
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, is_active: !current } : m))
    } else {
      load()
    }
  }

  // ── Edit permissions ──────────────────────────────────────────────────────
  const openEditMember = (member: any) => {
    if (!isOwner || !member.team_role) return // can't edit owner
    setEditMember(member)
    setEditPerms({ ...EMPTY_PERMS, ...(member.permissions || {}) })
    setEditRole(member.team_role || '')
    setSavePermsSuccess(false)
  }

  const savePermissions = async () => {
    if (!editMember) return
    setSavingPerms(true)
    const res = await apiFetch(`/api/team/${editMember.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ permissions: editPerms, team_role: editRole }),
    })
    if (res.ok) {
      setSavePermsSuccess(true)
      setMembers(prev =>
        prev.map(m => m.id === editMember.id
          ? { ...m, permissions: editPerms, team_role: editRole }
          : m
        )
      )
      setTimeout(() => {
        setSavePermsSuccess(false)
        setEditMember(null)
      }, 1500)
    }
    setSavingPerms(false)
  }

  // ── Create custom role ────────────────────────────────────────────────────
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRoleLabel.trim()) return
    setSavingRole(true)
    setNewRoleError('')

    const res = await apiFetch('/api/roles', {
      method: 'POST',
      body: JSON.stringify({
        label: newRoleLabel.trim(),
        description: newRoleDesc.trim() || undefined,
        permissions: newRolePerms,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      setNewRoleError(err.error || 'Error al crear el rol.')
      setSavingRole(false)
      return
    }

    const { role } = await res.json()
    setCustomRoles(prev => [...prev, role])
    setSavingRole(false)
    setNewRoleModalOpen(false)
    setNewRoleLabel('')
    setNewRoleDesc('')
    setNewRolePerms(EMPTY_PERMS)
    // Set the new role as selected in invite modal
    if (modalOpen) {
      setInviteRole(role.name)
      setInvitePerms(role.permissions || EMPTY_PERMS)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  const allRoles = [
    ...PRESET_ROLES.map(r => ({ id: r.id, label: r.label, isCustom: false, icon: r.icon, bg: r.bg, color: r.color, badge: r.badge, defaultPermissions: r.defaultPermissions })),
    ...customRoles.map(r => ({ id: r.name, label: r.label, isCustom: true, icon: Star, bg: 'bg-indigo-50', color: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-700', defaultPermissions: r.permissions })),
  ]

  return (
    <div className="space-y-5">

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
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            {members.length} miembro{members.length !== 1 ? 's' : ''} · {pendingInvitations.length} invitación{pendingInvitations.length !== 1 ? 'es' : ''} pendiente{pendingInvitations.length !== 1 ? 's' : ''}
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

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          { key: 'members' as Tab, label: 'Miembros', count: members.length },
          { key: 'pending' as Tab, label: 'Pendientes', count: pendingInvitations.length },
          { key: 'history' as Tab, label: 'Historial', count: historyInvitations.length },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center ${
                activeTab === tab.key ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-green-600 animate-spin" />
        </div>
      ) : (
        <>
          {/* ── TAB: Miembros activos ───────────────────────────────────────── */}
          {activeTab === 'members' && (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-green-600" />
                <h2 className="text-sm font-black text-gray-900">Miembros activos</h2>
                {isOwner && (
                  <span className="ml-auto text-[9px] font-bold text-gray-400 flex items-center gap-1">
                    <Pencil className="w-3 h-3" /> Clic en un miembro para editar permisos
                  </span>
                )}
              </div>
              <div className="divide-y divide-gray-50">
                {members.map(member => {
                  const isCurrentUser = member.firebase_uid === user?.uid
                  const isOwnerRow = !member.team_role || member.team_role === 'OWNER' || member.role === 'OWNER'
                  const initials = (member.first_name?.[0] || member.email?.[0] || '?').toUpperCase()

                  return (
                    <div
                      key={member.id}
                      onClick={() => isOwner && !isOwnerRow && !isCurrentUser ? openEditMember(member) : undefined}
                      className={`flex items-center gap-4 px-6 py-4 transition-colors ${
                        isOwner && !isOwnerRow && !isCurrentUser ? 'hover:bg-gray-50 cursor-pointer' : ''
                      }`}
                    >
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white text-sm font-black shrink-0 overflow-hidden">
                        {member.avatar_url
                          ? <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
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
                          <RoleBadge roleId={isOwnerRow ? undefined : member.team_role} customRoles={customRoles} />
                          <span className="text-[9px] text-gray-400 truncate max-w-[160px]">{member.email}</span>
                        </div>
                      </div>

                      {isOwner && !isOwnerRow && !isCurrentUser && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={e => { e.stopPropagation(); toggleMember(member.id, member.is_active) }}
                            className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors ${
                              member.is_active
                                ? 'text-gray-500 hover:bg-red-50 hover:text-red-600'
                                : 'text-green-600 hover:bg-green-50'
                            }`}
                          >
                            {member.is_active
                              ? <><UserX className="w-3.5 h-3.5" /> Desactivar</>
                              : <><UserCheck className="w-3.5 h-3.5" /> Activar</>
                            }
                          </button>
                          <ChevronRight className="w-4 h-4 text-gray-300" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {members.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-bold">Sin miembros aún</p>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Invitaciones pendientes ────────────────────────────────── */}
          {activeTab === 'pending' && (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-black text-gray-900">Invitaciones pendientes</h2>
              </div>
              {pendingInvitations.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Mail className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-bold">No hay invitaciones pendientes</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {pendingInvitations.map(inv => {
                    const isExpired = new Date(inv.expires_at) < new Date()
                    return (
                      <div key={inv.id} className="flex items-center gap-4 px-6 py-4">
                        <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                          <Mail className="w-4 h-4 text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{inv.email}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <RoleBadge roleId={inv.team_role} customRoles={customRoles} />
                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Pendiente</span>
                            <span className="text-[9px] text-gray-400">{fmtDate(inv.created_at)}</span>
                            {isExpired && <span className="text-[9px] font-bold text-red-500">Expirada</span>}
                          </div>
                        </div>
                        {isOwner && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => copyJoinLink(inv.token)}
                              className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Copiar link"
                            >
                              {copiedToken === inv.token ? <CheckCheck className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
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
              )}
            </div>
          )}

          {/* ── TAB: Historial ─────────────────────────────────────────────── */}
          {activeTab === 'history' && (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-black text-gray-900">Historial de invitaciones</h2>
              </div>
              {historyInvitations.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-bold">Sin historial</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {historyInvitations.map(inv => {
                    const statusColors: Record<string, string> = {
                      ACCEPTED: 'bg-green-100 text-green-700',
                      REVOKED:  'bg-red-100 text-red-700',
                      EXPIRED:  'bg-gray-100 text-gray-500',
                    }
                    const statusLabels: Record<string, string> = {
                      ACCEPTED: 'Aceptada',
                      REVOKED:  'Revocada',
                      EXPIRED:  'Expirada',
                    }
                    return (
                      <div key={inv.id} className="flex items-center gap-4 px-6 py-3.5 opacity-75">
                        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                          {inv.status === 'ACCEPTED'
                            ? <Check className="w-4 h-4 text-green-500" />
                            : <X className="w-4 h-4 text-gray-400" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-700 truncate">{inv.email}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <RoleBadge roleId={inv.team_role} customRoles={customRoles} />
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${statusColors[inv.status] || 'bg-gray-100 text-gray-500'}`}>
                              {statusLabels[inv.status] || inv.status}
                            </span>
                            <span className="text-[9px] text-gray-400">{fmtDate(inv.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* First member empty state */}
          {members.length <= 1 && invitations.length === 0 && (
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

      {/* ── Edit permissions drawer ───────────────────────────────────────────── */}
      {editMember && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-3xl z-10">
              <div>
                <h2 className="font-black text-gray-900 text-base">Editar accesos</h2>
                <p className="text-xs text-gray-500">
                  {[editMember.first_name, editMember.last_name].filter(Boolean).join(' ') || editMember.email}
                </p>
              </div>
              <button onClick={() => setEditMember(null)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Role selector */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">Rol</label>
                <div className="grid grid-cols-2 gap-2">
                  {allRoles.map(role => {
                    const Icon = role.icon
                    const isSelected = editRole === role.id
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => {
                          setEditRole(role.id)
                          setEditPerms({ ...EMPTY_PERMS, ...(role.defaultPermissions || {}) })
                        }}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all ${
                          isSelected ? `${role.bg} border-current` : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isSelected ? role.color : 'text-gray-400'}`} />
                        <div>
                          <p className={`text-xs font-black leading-none ${isSelected ? role.color : 'text-gray-700'}`}>{role.label}</p>
                          {role.isCustom && <p className="text-[9px] text-indigo-400 mt-0.5">Custom</p>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Permission toggles */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">Módulos habilitados</label>
                <div className="space-y-1.5">
                  {MODULES.map(mod => (
                    <div key={mod.key} className="flex items-center justify-between py-1.5 px-3 rounded-xl hover:bg-gray-50">
                      <div>
                        <p className="text-sm font-bold text-gray-700">{mod.label}</p>
                        <p className="text-[10px] text-gray-400">{mod.desc}</p>
                      </div>
                      <Toggle
                        on={!!editPerms[mod.key]}
                        onChange={() => setEditPerms(p => ({ ...p, [mod.key]: !p[mod.key] }))}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditMember(null)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={savePermissions}
                  disabled={savingPerms}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {savingPerms
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : savePermsSuccess
                    ? <><Check className="w-4 h-4" /> Guardado</>
                    : <><Save className="w-4 h-4" /> Guardar cambios</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Invite Modal ──────────────────────────────────────────────────────── */}
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
                {/* Nombre y apellido */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Nombre</label>
                    <input
                      type="text"
                      value={inviteFirstName}
                      onChange={e => setInviteFirstName(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Juan"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Apellido</label>
                    <input
                      type="text"
                      value={inviteLastName}
                      onChange={e => setInviteLastName(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Rodríguez"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Email del invitado *</label>
                  <input
                    type="email" required
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="veterinario@ejemplo.com"
                  />
                </div>

                {/* Role selector */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Rol</label>
                    <button
                      type="button"
                      onClick={() => setNewRoleModalOpen(true)}
                      className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700"
                    >
                      <BadgePlus className="w-3 h-3" /> Crear rol custom
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {allRoles.map(role => {
                      const Icon = role.icon
                      const isSelected = inviteRole === role.id
                      return (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => handleRoleChange(role.id)}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all ${
                            isSelected
                              ? `${role.bg} border-current ring-2 ring-offset-1 ${role.color.replace('text-', 'ring-')}`
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${isSelected ? role.color : 'text-gray-400'}`} />
                          <div>
                            <p className={`text-xs font-black leading-none ${isSelected ? role.color : 'text-gray-700'}`}>{role.label}</p>
                            {role.isCustom && <p className="text-[9px] text-indigo-400 mt-0.5">Custom</p>}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Permission toggles */}
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">Módulos habilitados</label>
                  <div className="space-y-1.5">
                    {MODULES.map(mod => (
                      <div key={mod.key} className="flex items-center justify-between py-1.5 px-3 rounded-xl hover:bg-gray-50">
                        <span className="text-sm font-bold text-gray-700">{mod.label}</span>
                        <Toggle
                          on={!!invitePerms[mod.key]}
                          onChange={() => setInvitePerms(p => ({ ...p, [mod.key]: !p[mod.key] }))}
                        />
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

      {/* ── New Custom Role Modal ─────────────────────────────────────────────── */}
      {newRoleModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-3xl z-10">
              <div>
                <h2 className="font-black text-gray-900 text-base">Crear rol personalizado</h2>
                <p className="text-xs text-gray-500">Define un rol específico para tu campo</p>
              </div>
              <button onClick={() => setNewRoleModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRole} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Nombre del rol *</label>
                <input
                  type="text" required
                  value={newRoleLabel}
                  onChange={e => setNewRoleLabel(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="ej. Encargado de campo"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Descripción</label>
                <input
                  type="text"
                  value={newRoleDesc}
                  onChange={e => setNewRoleDesc(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm"
                  placeholder="ej. Responsable de todas las actividades de campo"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">Permisos</label>
                <div className="space-y-1.5">
                  {MODULES.map(mod => (
                    <div key={mod.key} className="flex items-center justify-between py-1.5 px-3 rounded-xl hover:bg-gray-50">
                      <span className="text-sm font-bold text-gray-700">{mod.label}</span>
                      <Toggle
                        on={!!newRolePerms[mod.key]}
                        onChange={() => setNewRolePerms(p => ({ ...p, [mod.key]: !p[mod.key] }))}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {newRoleError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{newRoleError}</div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setNewRoleModalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm">
                  Cancelar
                </button>
                <button type="submit" disabled={savingRole || !newRoleLabel.trim()}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                  {savingRole ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
                  Crear rol
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
