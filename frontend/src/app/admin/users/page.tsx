'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import PageShell from '../components/PageShell'
import { signInWithCustomToken } from 'firebase/auth'
import { auth } from '@/lib/firebase/client'

interface User {
  id: string; email: string; first_name: string; last_name: string
  is_active: boolean; created_at: string; org_name: string
  total_area_ha: number; plan_name: string; plan_slug: string
  paddocks_count: number; herds_count: number; plan_status: string; onboarding_step: number
}

interface Plan {
  id: string; name: string; slug: string; price: number
}

// ── Impersonate Modal ──────────────────────────────────────────────────────
function ImpersonateModal({ targetUser, onClose, onConfirm }: {
  targetUser: User; onClose: () => void; onConfirm: (reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    if (!reason.trim()) { setError('Indicá el motivo del acceso'); return }
    setLoading(true)
    try { await onConfirm(reason.trim()) }
    catch (e: any) { setError(e.message || 'Error al impersonar'); setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-gray-900 font-bold">Acceder como Usuario</h3>
            <p className="text-gray-400 text-xs mt-0.5">Acción registrada en Auditoría</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-amber-800 text-sm font-semibold mb-1">Sesión de soporte técnico</p>
            <p className="text-amber-700 text-xs">
              Vas a entrar a la cuenta de <strong>{targetUser.email}</strong> ({targetUser.first_name} {targetUser.last_name}).
              El token expira en 1 hora.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Motivo del acceso *</label>
            <textarea value={reason} rows={3} onChange={e => setReason(e.target.value)}
              placeholder="Ej: El usuario reportó que no puede ver sus potreros..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 resize-none focus:outline-none focus:border-green-500 placeholder-gray-400" />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
            {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            Ingresar como usuario
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Change Plan Modal ──────────────────────────────────────────────────────
function ChangePlanModal({ targetUser, plans, onClose, onConfirm }: {
  targetUser: User
  plans: Plan[]
  onClose: () => void
  onConfirm: (planId: string) => Promise<void>
}) {
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    if (!selectedPlanId) { setError('Seleccioná un plan'); return }
    setLoading(true)
    try { await onConfirm(selectedPlanId) }
    catch (e: any) { setError(e.message || 'Error al cambiar plan'); setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-gray-900 font-bold">Cambiar Plan</h3>
            <p className="text-gray-400 text-xs mt-0.5">{targetUser.first_name} {targetUser.last_name} · {targetUser.email}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
            <p className="text-blue-700 text-xs">
              Plan actual: <strong>{targetUser.plan_name || 'Sin plan'}</strong>. El cambio es inmediato.
            </p>
          </div>

          <div className="space-y-2">
            {plans.map(plan => (
              <button
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 text-left transition-all ${
                  selectedPlanId === plan.id
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <span className={`text-sm font-bold ${selectedPlanId === plan.id ? 'text-green-700' : 'text-gray-800'}`}>
                  {plan.name}
                </span>
                <span className="text-xs font-medium text-gray-400">
                  {plan.price === 0 ? 'Gratis' : `$${plan.price}/mes`}
                </span>
              </button>
            ))}
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={loading || !selectedPlanId}
            className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
            {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            Asignar Plan
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Plan badge ─────────────────────────────────────────────────────────────
function PlanBadge({ slug, name }: { slug: string; name: string }) {
  const base = 'text-[10px] font-semibold px-2 py-0.5 rounded-full border'
  if (!name) return <span className={`${base} bg-gray-50 text-gray-400 border-gray-200`}>Sin plan</span>
  return <span className={`${base} bg-green-50 text-green-700 border-green-200`}>{name}</span>
}

// ── Status badge ───────────────────────────────────────────────────────────
function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
      {active ? 'Activo' : 'Inactivo'}
    </span>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [planFilter, setPlanFilter] = useState('')
  const [impersonating, setImpersonating] = useState<User | null>(null)
  const [changingPlan, setChangingPlan] = useState<User | null>(null)
  const [success, setSuccess] = useState('')
  const limit = 20

  const fetchUsers = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const token = await user.getIdToken()
      const params = new URLSearchParams({
        page: String(page), limit: String(limit),
        ...(search ? { search } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(planFilter ? { plan: planFilter } : {}),
      })
      const res = await fetch(`/api/admin/users?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setUsers(data.users || [])
      setTotal(data.total || 0)
    } finally { setLoading(false) }
  }, [user, page, search, statusFilter, planFilter])

  // Load available plans
  useEffect(() => {
    if (!user) return
    user.getIdToken().then(token =>
      fetch('/api/admin/plans', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : { plans: [] })
        .then(d => setPlans(d.plans || []))
        .catch(() => {})
    )
  }, [user])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  async function handleToggle(u: User) {
    if (!user) return
    const token = await user.getIdToken()
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: u.id, is_active: !u.is_active })
    })
    fetchUsers()
  }

  async function handleImpersonate(targetUser: User, reason: string) {
    if (!user) return
    const token = await user.getIdToken()
    const res = await fetch(`/api/admin/users/${targetUser.id}/impersonate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    if (!res.ok) throw new Error((await res.json()).error || 'Error al generar token')
    const { customToken } = await res.json()
    sessionStorage.setItem('impersonation_token', customToken)
    sessionStorage.setItem('impersonation_email', targetUser.email)
    window.open('/api/admin/start-impersonation', '_blank')
    setImpersonating(null)
    setSuccess(`Sesión iniciada como ${targetUser.email}`)
    setTimeout(() => setSuccess(''), 5000)
  }

  async function handleChangePlan(targetUser: User, planId: string) {
    if (!user) return
    const token = await user.getIdToken()
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: targetUser.id, plan_id: planId }),
    })
    if (!res.ok) throw new Error((await res.json()).error || 'Error al cambiar plan')
    setChangingPlan(null)
    const planName = plans.find(p => p.id === planId)?.name || ''
    setSuccess(`Plan de ${targetUser.first_name} actualizado a ${planName}`)
    setTimeout(() => setSuccess(''), 5000)
    fetchUsers()
  }

  const totalPages = Math.ceil(total / limit)
  const selectCls = 'border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none focus:border-green-500 transition-all'

  return (
    <PageShell count={total} countLabel="usuarios en la plataforma">

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700 text-sm">
          ✓ {success}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input type="text" value={search} placeholder="Buscar por email o nombre…"
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-green-500 placeholder-gray-400 bg-white" />
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} className={selectCls}>
          <option value="">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
        <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(1) }} className={selectCls}>
          <option value="">Todos los planes</option>
          {plans.map(p => (
            <option key={p.id} value={p.slug}>{p.name}</option>
          ))}
        </select>
        <button onClick={fetchUsers}
          className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-900 text-sm transition-colors">
          {loading ? '…' : 'Actualizar'}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Usuario', 'Organización', 'Plan', 'Recursos', 'Registro', 'Estado', 'Acciones'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">Cargando…</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">No se encontraron usuarios</td></tr>
              ) : users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="font-medium text-gray-900">{u.first_name} {u.last_name}</div>
                    <div className="text-gray-400 text-xs">{u.email}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="text-gray-700 text-sm">{u.org_name || '—'}</div>
                    {u.total_area_ha > 0 && <div className="text-gray-400 text-xs">{Number(u.total_area_ha).toFixed(0)} ha</div>}
                  </td>
                  <td className="px-4 py-3.5"><PlanBadge slug={u.plan_slug} name={u.plan_name} /></td>
                  <td className="px-4 py-3.5 text-gray-500 text-xs">{u.paddocks_count} potreros · {u.herds_count} rodeos</td>
                  <td className="px-4 py-3.5 text-gray-400 text-xs">{new Date(u.created_at).toLocaleDateString('es-AR')}</td>
                  <td className="px-4 py-3.5"><StatusBadge active={u.is_active} /></td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => setChangingPlan(u)}
                        className="px-2.5 py-1 rounded-lg text-xs text-blue-600 hover:bg-blue-50 border border-blue-100 transition-all font-medium"
                      >
                        Cambiar Plan
                      </button>
                      <button onClick={() => setImpersonating(u)}
                        className="px-2.5 py-1 rounded-lg text-xs text-amber-600 hover:bg-amber-50 border border-amber-100 transition-all">
                        Acceder
                      </button>
                      <button onClick={() => handleToggle(u)}
                        className={`px-2.5 py-1 rounded-lg text-xs border transition-all ${u.is_active ? 'text-red-500 hover:bg-red-50 border-red-100' : 'text-green-600 hover:bg-green-50 border-green-100'}`}>
                        {u.is_active ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-gray-400 text-xs">Página {page} de {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-xs disabled:opacity-30 hover:bg-gray-50 transition-colors">
                ← Anterior
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-xs disabled:opacity-30 hover:bg-gray-50 transition-colors">
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>

      {impersonating && (
        <ImpersonateModal
          targetUser={impersonating}
          onClose={() => setImpersonating(null)}
          onConfirm={reason => handleImpersonate(impersonating, reason)}
        />
      )}

      {changingPlan && (
        <ChangePlanModal
          targetUser={changingPlan}
          plans={plans}
          onClose={() => setChangingPlan(null)}
          onConfirm={planId => handleChangePlan(changingPlan, planId)}
        />
      )}
    </PageShell>
  )
}
