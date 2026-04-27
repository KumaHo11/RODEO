'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import PageShell from '../components/PageShell'

interface SuperAdmin {
  id: string; email: string; first_name: string; last_name: string
  is_active: boolean; created_at: string; system_role: string
}

const inputCls = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:border-green-500 placeholder-gray-400'
const labelCls = 'block text-xs font-semibold text-gray-600 mb-1.5'

// ── Create modal ───────────────────────────────────────────────────────────
function CreateAdminModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const { user } = useAuth()
  const [form, setForm] = useState({ email: '', first_name: '', last_name: '', password: '', system_role: 'SUPER_ADMIN' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!form.email || !form.first_name || !form.password) { setError('Email, nombre y contraseña son requeridos'); return }
    if (form.password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    if (!user) return
    setSaving(true); setError('')
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/admin/super-admins', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Error al crear')
      onSave()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-gray-900 font-bold">Nuevo Administrador</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-700 text-xs">
            ⚠️ Este usuario tendrá acceso al panel de administración de la plataforma.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nombre *</label>
              <input value={form.first_name} placeholder="Juan" className={inputCls}
                onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Apellido</label>
              <input value={form.last_name} placeholder="García" className={inputCls}
                onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Email *</label>
            <input type="email" value={form.email} placeholder="admin@rodeoapp.io" className={inputCls}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>

          <div>
            <label className={labelCls}>Contraseña inicial *</label>
            <input type="password" value={form.password} placeholder="Mínimo 8 caracteres" className={inputCls}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </div>

          <div>
            <label className={labelCls}>Rol</label>
            <select value={form.system_role} className={inputCls}
              onChange={e => setForm(f => ({ ...f, system_role: e.target.value }))}>
              <option value="SUPER_ADMIN">Super Admin — Acceso completo</option>
              <option value="SUPPORT_AGENT">Support Agent — Solo lectura + impersonation</option>
            </select>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold text-sm transition-colors">
            {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            Crear Admin
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Role badge ─────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const isSA = role === 'SUPER_ADMIN'
  return (
    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${isSA ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
      {isSA ? 'Super Admin' : 'Support Agent'}
    </span>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function AdminUsersSystemPage() {
  const { user } = useAuth()
  const [admins, setAdmins] = useState<SuperAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [success, setSuccess] = useState('')

  const fetchAdmins = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/admin/super-admins', { headers: { Authorization: `Bearer ${token}` } })
      setAdmins((await res.json()).admins || [])
    } finally { setLoading(false) }
  }, [user])

  useEffect(() => { fetchAdmins() }, [fetchAdmins])

  return (
    <PageShell
      count={admins.length}
      countLabel={`administrador${admins.length !== 1 ? 'es' : ''} del sistema`}
      actions={
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors">
          + Nuevo Super Admin
        </button>
      }
    >
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700 text-sm">
          ✓ {success}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden max-w-3xl">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : admins.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">No hay administradores configurados</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {admins.map(a => (
              <div key={a.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/60 transition-colors">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-green-50 border border-green-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-black text-green-700">
                    {a.first_name?.[0]}{a.last_name?.[0] ?? ''}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-gray-900 font-semibold text-sm">{a.first_name} {a.last_name}</div>
                  <div className="text-gray-400 text-xs">{a.email}</div>
                </div>

                {/* Role */}
                <RoleBadge role={a.system_role} />

                {/* Date */}
                <div className="text-gray-400 text-xs hidden sm:block">
                  {new Date(a.created_at).toLocaleDateString('es-AR')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateAdminModal
          onClose={() => setShowCreate(false)}
          onSave={() => {
            setShowCreate(false)
            setSuccess('Super Admin creado exitosamente')
            setTimeout(() => setSuccess(''), 4000)
            fetchAdmins()
          }}
        />
      )}
    </PageShell>
  )
}
