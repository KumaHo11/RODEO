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
import { AppHeader } from '@/components/AppHeader'
import { Button, FormField } from '@/design-system'
import { FeatureGate } from '@/components/FeatureGate'

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
    desc: 'Recorrida de campos, bitácora, rodeos',
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
  { key: 'rebanhos',     label: 'Rodeos',           desc: 'Gestión de animales y majadas' },
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
        Propietario
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
    <FeatureGate
      feature="equipo"
      title="Gestión de equipo"
      description="Invitá a tu capataz, veterinario o ayudante y gestioná sus permisos de acceso. Disponible desde el plan Planificador."
      requiredPlan="Planificador"
    >
    <div className="space-y-5">
      <AppHeader title="Equipo" subtitle="Gestión de miembros y permisos" />

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
          <Button onClick={() => setModalOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
            Invitar al equipo
          </Button>
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
                activeTab === tab.key ? 'bg-gray-900 text-white shadow-sm' : 'bg-gray-200 text-gray-500'
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
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-black text-gray-900">
                            {[member.first_name, member.last_name].filter(Boolean).join(' ') || 'Sin nombre'}
                          </p>
                          {isCurrentUser && (
                            <span className="text-[9px] font-black bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">Tú</span>
                          )}
                          {!member.is_active && (
                            <span className="text-[9px] font-black bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Inactivo</span>
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
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{inv.email}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <RoleBadge roleId={inv.team_role} customRoles={customRoles} />
                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Pendiente</span>
                            <span className="text-[9px] text-gray-400">{fmtDate(inv.created_at)}</span>
                            {isExpired && <span className="text-[9px] font-bold text-gray-500">Expirada</span>}
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
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-700 truncate">{inv.email}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <RoleBadge roleId={inv.team_role} customRoles={customRoles} />
                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
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
                <Button onClick={() => setModalOpen(true)} className="mt-5">
                  Invitar primer miembro
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Edit permissions drawer ───────────────────────────────────────────── */}
      {editMember && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="sticky top-0 bg-white/98 backdrop-blur px-6 py-5 border-b border-gray-100 flex items-center justify-between rounded-t-3xl z-10 shrink-0">
              <div>
                <h2 className="text-lg font-black text-gray-950 tracking-tight">Editar accesos</h2>
                <p className="text-xs text-gray-400 font-medium mt-0.5">
                  {[editMember.first_name, editMember.last_name].filter(Boolean).join(' ') || editMember.email}
                </p>
              </div>
              <button onClick={() => setEditMember(null)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Role selector */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">Rol</label>
                <div className="grid grid-cols-2 gap-2">
                  {allRoles.map(role => {
                    const isSelected = editRole === role.id
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => {
                          setEditRole(role.id)
                          setEditPerms({ ...EMPTY_PERMS, ...(role.defaultPermissions || {}) })
                        }}
                        className={`px-3 py-2.5 rounded-xl border text-left transition-all ${
                          isSelected ? `border-gray-900 bg-white` : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={`text-xs font-black leading-none ${isSelected ? role.color : 'text-gray-700'}`}>{role.label}</p>
                            {role.isCustom && <p className="text-[9px] text-gray-400 mt-0.5">Personalizado</p>}
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-gray-900" />}
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
                <Button variant="secondary" className="flex-1 py-3" type="button" onClick={() => setEditMember(null)}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1 py-3"
                  onClick={savePermissions}
                  isLoading={savingPerms}
                  leftIcon={savePermsSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                >
                  {savePermsSuccess ? 'Guardado' : 'Guardar cambios'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Invite Modal ──────────────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 flex flex-col max-h-[92vh]">

            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-lg font-black text-gray-950 tracking-tight">Invitar al equipo</h2>
                <p className="text-xs text-gray-400 font-medium mt-0.5">Enviá una invitación por email con acceso configurado</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            {inviteSent ? (
              <div className="p-10 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-black text-gray-900 mb-1">¡Invitación enviada!</h3>
                <p className="text-sm text-gray-500">El email fue enviado a <strong>{inviteEmail}</strong></p>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                  {/* Datos del invitado */}
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Datos del invitado</p>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Nombre</label>
                        <input
                          type="text"
                          value={inviteFirstName}
                          onChange={e => setInviteFirstName(e.target.value)}
                          placeholder="Juan"
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all placeholder:text-gray-300"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Apellido</label>
                        <input
                          type="text"
                          value={inviteLastName}
                          onChange={e => setInviteLastName(e.target.value)}
                          placeholder="Rodríguez"
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all placeholder:text-gray-300"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Email *</label>
                      <input
                        type="email"
                        required
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        placeholder="veterinario@ejemplo.com"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all placeholder:text-gray-300"
                      />
                    </div>
                  </div>

                  {/* Rol */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Rol</p>
                      <button
                        type="button"
                        onClick={() => setNewRoleModalOpen(true)}
                        className="text-[10px] font-bold text-gray-500 hover:text-gray-800 transition-colors"
                      >
                        Crear rol personalizado
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {allRoles.map(role => {
                        const isSelected = inviteRole === role.id
                        return (
                          <button
                            key={role.id}
                            type="button"
                            onClick={() => handleRoleChange(role.id)}
                            className={`px-4 py-3 rounded-2xl border-2 text-left transition-all min-w-0 ${
                              isSelected
                                ? `border-gray-900 bg-white`
                                : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="min-w-0 flex-1">
                                <p className={`text-xs font-black leading-tight truncate ${isSelected ? role.color : 'text-gray-800'}`}>{role.label}</p>
                                {role.isCustom && <p className="text-[9px] text-gray-400 mt-0.5">Personalizado</p>}
                              </div>
                              {isSelected && (
                                <div className="shrink-0 ml-2">
                                  <Check className="w-4 h-4 text-gray-900" />
                                </div>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Módulos */}
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Módulos habilitados</p>
                    <div className="bg-gray-50 rounded-2xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
                      {MODULES.map(mod => (
                        <div key={mod.key} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-800 leading-tight">{mod.label}</p>
                            <p className="text-[10px] text-gray-400 font-medium mt-0.5">{mod.desc}</p>
                          </div>
                          <Toggle
                            on={!!invitePerms[mod.key]}
                            onChange={() => setInvitePerms(p => ({ ...p, [mod.key]: !p[mod.key] }))}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {inviteError && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      {inviteError}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 shrink-0 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold text-sm rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={inviting || !inviteEmail}
                    className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white font-black text-sm rounded-xl shadow-sm shadow-green-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                    {inviting ? 'Enviando...' : 'Enviar invitación'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}




      {/* ── New Custom Role Modal ─────────────────────────────────────────────── */}
      {newRoleModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-lg font-black text-gray-950 tracking-tight">Rol personalizado</h2>
                <p className="text-xs text-gray-400 font-medium mt-0.5">Definir un nuevo rol operativo</p>
              </div>
              <button onClick={() => setNewRoleModalOpen(false)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRole} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Nombre del rol *</label>
                  <input
                    type="text"
                    required
                    value={newRoleLabel}
                    onChange={e => setNewRoleLabel(e.target.value)}
                    placeholder="ej. Encargado de campo"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all placeholder:text-gray-300"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Descripción</label>
                  <input
                    type="text"
                    value={newRoleDesc}
                    onChange={e => setNewRoleDesc(e.target.value)}
                    placeholder="ej. Responsable de todas las actividades de campo"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all placeholder:text-gray-300"
                  />
                </div>

                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Permisos</p>
                  <div className="bg-gray-50 rounded-2xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
                    {MODULES.map(mod => (
                      <div key={mod.key} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-800 leading-tight">{mod.label}</p>
                          <p className="text-[10px] text-gray-400 font-medium mt-0.5">{mod.desc}</p>
                        </div>
                        <Toggle
                          on={!!newRolePerms[mod.key]}
                          onChange={() => setNewRolePerms(p => ({ ...p, [mod.key]: !p[mod.key] }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {newRoleError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    {newRoleError}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 shrink-0 flex gap-3">
                <button
                  type="button"
                  onClick={() => setNewRoleModalOpen(false)}
                  className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold text-sm rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingRole || !newRoleLabel.trim()}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-xl shadow-sm shadow-indigo-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {savingRole ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
                  {savingRole ? 'Creando...' : 'Crear rol'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </FeatureGate>
  )
}
