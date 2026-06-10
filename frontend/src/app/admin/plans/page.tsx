'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import PageShell from '../components/PageShell'

interface FeatureFlag {
  id?: string; flag_key: string; flag_value: any
  flag_type: 'boolean' | 'number' | 'string'; label: string
}
interface Plan {
  id: string; name: string; slug: string; description: string
  price: number; price_yearly: number; paddocks_limit: number; herds_limit: number
  has_ai_analysis: boolean; color: string; is_popular: boolean; is_active: boolean
  sort_order: number; trial_days: number
  stripe_price_id_monthly: string; stripe_price_id_yearly: string
  mp_preapproval_plan_id: string; org_count: number; feature_flags: FeatureFlag[]
  created_at: string; updated_at: string
}

// ── Todos los feature flags reconocidos por el sistema ───────────────────────
// Agrupados: primero límites numéricos, luego booleans por módulo
const FLAG_TEMPLATES = [
  // ─ Límites numéricos ──────────────────────────────────────────────────────
  { flag_key: 'max_paddocks',     label: 'Máx. potreros',             flag_type: 'number'  as const, default: 20    },
  { flag_key: 'max_herds',        label: 'Máx. rodeos',               flag_type: 'number'  as const, default: 1     },
  { flag_key: 'max_team_members', label: 'Miembros de equipo',        flag_type: 'number'  as const, default: 2     },
  // ─ Módulos base (incluidos desde Brote) ───────────────────────────────────
  { flag_key: 'map',              label: 'Mapa de campo + potreros',  flag_type: 'boolean' as const, default: true  },
  { flag_key: 'clima',            label: 'Módulo clima y alertas',    flag_type: 'boolean' as const, default: true  },
  { flag_key: 'agenda',           label: 'Agenda / eventos',          flag_type: 'boolean' as const, default: true  },
  // ─ Módulos intermedios (Planificador+) ────────────────────────────────────
  { flag_key: 'grazing_planner',  label: 'Planificador de pastoreo (Savory)',  flag_type: 'boolean' as const, default: false },
  { flag_key: 'tareas',           label: 'Gestión de tareas',         flag_type: 'boolean' as const, default: false },
  { flag_key: 'equipo',           label: 'Gestión de equipo',         flag_type: 'boolean' as const, default: false },
  { flag_key: 'voice_bitacora',   label: 'Bitácora de voz + IA',      flag_type: 'boolean' as const, default: false },
  // ─ Módulos avanzados (Holístico+) ─────────────────────────────────────────
  { flag_key: 'ai_insights',      label: 'Insights IA (Gemini)',      flag_type: 'boolean' as const, default: false },
  { flag_key: 'advanced_reports', label: 'Reportes avanzados',        flag_type: 'boolean' as const, default: false },
  { flag_key: 'carbon_module',    label: 'Módulo Carbono (MRV)',      flag_type: 'boolean' as const, default: false },
  { flag_key: 'offline_mode',     label: 'App móvil offline',         flag_type: 'boolean' as const, default: false },
  // ─ Módulos enterprise (Latifundio) ────────────────────────────────────────
  { flag_key: 'ndvi_access',      label: 'NDVI satelital (Sentinel)', flag_type: 'boolean' as const, default: false },
  { flag_key: 'api_access',       label: 'Acceso API corporativa',    flag_type: 'boolean' as const, default: false },
]

/** Merge saved flags from DB with all templates, so every flag is always visible */
function mergeFlags(existingFlags: FeatureFlag[] = []): FeatureFlag[] {
  return FLAG_TEMPLATES.map(t => {
    const saved = existingFlags.find(f => f.flag_key === t.flag_key)
    return saved ? { ...saved } : { flag_key: t.flag_key, flag_value: t.default, flag_type: t.flag_type, label: t.label }
  })
}

const inputCls = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-100 transition-all placeholder-gray-400'
const labelCls = 'block text-xs font-semibold text-gray-600 mb-1.5'

// ── Inline Toggle ──────────────────────────────────────────────────────────
function Toggle({
  value, onChange, size = 'md', loading = false
}: {
  value: boolean; onChange: (v: boolean) => void; size?: 'sm' | 'md'; loading?: boolean
}) {
  const isSm = size === 'sm'
  return (
    <button
      onClick={() => !loading && onChange(!value)}
      disabled={loading}
      className={`relative flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 ${
        value ? 'bg-green-500' : 'bg-gray-200'
      } ${isSm ? 'w-8 h-4' : 'w-10 h-5'} ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      role="switch"
      aria-checked={value}
    >
      <span className={`absolute top-0.5 left-0 rounded-full bg-white shadow transition-transform duration-200 ${
        isSm ? 'w-3 h-3' : 'w-4 h-4'
      } ${value ? (isSm ? 'translate-x-[18px]' : 'translate-x-[22px]') : 'translate-x-0.5'}`} />
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className={`border-2 border-white/40 border-t-white rounded-full animate-spin ${isSm ? 'w-2 h-2' : 'w-3 h-3'}`} />
        </span>
      )}
    </button>
  )
}

// ── Plan Modal (create/edit) ───────────────────────────────────────────────
function PlanModal({ plan, onClose, onSave }: {
  plan: Partial<Plan> | null; onClose: () => void; onSave: () => void
}) {
  const { user } = useAuth()
  const isNew = !plan?.id

  const [form, setForm] = useState<Partial<Plan>>(() => {
    if (!plan) {
      return {
        name: '', slug: '', description: '', price: 0, price_yearly: 0,
        paddocks_limit: 5, herds_limit: 1, has_ai_analysis: false,
        color: '#16a34a', is_popular: false, is_active: true, sort_order: 99,
        trial_days: 45,
        stripe_price_id_monthly: '', stripe_price_id_yearly: '', mp_preapproval_plan_id: '',
        feature_flags: mergeFlags(),
      }
    }
    return { ...plan, trial_days: plan.trial_days ?? 0, feature_flags: mergeFlags(plan.feature_flags ?? []) }
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const slugify = (s: string) => s.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_+]/g, '')
  function updateFlag(i: number, value: any) {
    const flags = [...(form.feature_flags || [])]
    flags[i] = { ...flags[i], flag_value: value }
    setForm(f => ({ ...f, feature_flags: flags }))
  }

  async function handleSave() {
    if (!form.name || !form.slug) { setError('Nombre y slug son requeridos'); return }
    if (!user) return
    setSaving(true); setError('')
    try {
      const token = await user.getIdToken()
      const res = await fetch(isNew ? '/api/admin/plans' : `/api/admin/plans/${plan!.id}`, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Error al guardar')
      onSave()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h3 className="text-gray-900 font-bold text-base">{isNew ? 'Crear nuevo plan' : `Editar: ${plan?.name}`}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Nombre del plan *</label>
              <input value={form.name || ''} className={inputCls} placeholder="Pro Ganadero"
                onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: f.slug || slugify(e.target.value) }))} />
            </div>
            <div>
              <label className={labelCls}>Slug *</label>
              <input value={form.slug || ''} className={`${inputCls} font-mono`} placeholder="pro_ganadero"
                onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Descripción</label>
            <textarea value={form.description || ''} rows={2} className={inputCls + ' resize-none'}
              placeholder="Para ganaderos que quieren precisión total"
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Precio mensual (USD/mes)</label>
              <input type="number" step="0.01" value={form.price || 0} className={inputCls}
                onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className={labelCls}>Precio anual (USD/mes)</label>
              <input type="number" step="0.01" value={form.price_yearly || 0} className={inputCls}
                onChange={e => setForm(f => ({ ...f, price_yearly: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className={labelCls}>Días de trial gratuito</label>
              <input type="number" step="1" min="0" value={form.trial_days ?? 0} className={inputCls}
                placeholder="0 = sin trial"
                onChange={e => setForm(f => ({ ...f, trial_days: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>
          <div className="space-y-2">
            <label className={labelCls}>IDs de pasarelas de pago</label>
            {[
              { key: 'stripe_price_id_monthly', label: 'Stripe Price ID mensual' },
              { key: 'stripe_price_id_yearly',  label: 'Stripe Price ID anual'   },
              { key: 'mp_preapproval_plan_id',  label: 'MercadoPago Plan ID'     },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center gap-3">
                <span className="text-gray-500 text-xs w-44 flex-shrink-0">{label}</span>
                <input value={(form as any)[key] || ''} placeholder="—"
                  className={`${inputCls} font-mono text-xs`}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-5 pt-1">
            {[
              { key: 'is_active',       label: 'Plan activo'   },
              { key: 'is_popular',      label: 'Más popular'   },
              { key: 'has_ai_analysis', label: 'Incluye IA'    },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2.5 cursor-pointer select-none text-sm text-gray-700">
                <Toggle value={!!(form as any)[key]} onChange={v => setForm(f => ({ ...f, [key]: v }))} size="sm" />
                {label}
              </label>
            ))}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Color</label>
              <input type="color" value={form.color || '#16a34a'}
                onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Feature Flags</label>
            <div className="bg-gray-50 rounded-xl border border-gray-100 divide-y divide-gray-100">
              {(form.feature_flags || []).map((flag, i) => (
                <div key={flag.flag_key} className="flex items-center justify-between px-4 py-3">
                  <span className="text-gray-600 text-sm">{flag.label || flag.flag_key}</span>
                  {flag.flag_type === 'boolean' ? (
                    <Toggle value={!!flag.flag_value} onChange={v => updateFlag(i, v)} size="sm" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <select 
                        value={flag.flag_value === -1 ? '-1' : 'custom'}
                        onChange={e => updateFlag(i, e.target.value === '-1' ? -1 : (flag.flag_value === -1 ? 0 : flag.flag_value))}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:border-green-500 transition-colors cursor-pointer"
                      >
                        <option value="custom">Con límite</option>
                        <option value="-1">Ilimitado</option>
                      </select>
                      {flag.flag_value !== -1 && (
                        <input type="number" value={flag.flag_value}
                          onChange={e => {
                            const valStr = e.target.value;
                            const parsed = parseFloat(valStr);
                            updateFlag(i, isNaN(parsed) ? (valStr === '-' ? '-' : 0) : parsed);
                          }}
                          className="w-20 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-center text-gray-900 focus:outline-none focus:border-green-500" />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:text-gray-900 text-sm transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold text-sm transition-colors">
            {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {isNew ? 'Crear plan' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Inline flag toggle ─────────────────────────────────────────────────────
function FlagRow({ flag, planId, onUpdate }: {
  flag: FeatureFlag; planId: string; onUpdate: (flagKey: string, value: any) => void
}) {
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)

  async function handleToggle(newValue: any) {
    if (!user || saving) return
    setSaving(true)
    // Optimistic update
    onUpdate(flag.flag_key, newValue)
    try {
      const token = await user.getIdToken()
      await fetch(`/api/admin/plans/${planId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature_flags: [{ ...flag, flag_value: newValue }]
        }),
      })
    } catch {
      // Revert on error
      onUpdate(flag.flag_key, flag.flag_value)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center justify-between py-2.5 px-4 hover:bg-gray-50 transition-colors rounded-lg">
      <div>
        <span className="text-gray-700 text-sm">{flag.label || flag.flag_key}</span>
        <span className="ml-2 text-gray-300 text-[10px] font-mono">{flag.flag_key}</span>
      </div>
      {flag.flag_type === 'boolean' ? (
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${flag.flag_value ? 'text-green-600' : 'text-gray-400'}`}>
            {flag.flag_value ? 'Activo' : 'Inactivo'}
          </span>
          <Toggle value={!!flag.flag_value} onChange={handleToggle} size="sm" loading={saving} />
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <select 
            value={flag.flag_value === -1 ? '-1' : 'custom'}
            onChange={e => handleToggle(e.target.value === '-1' ? -1 : (flag.flag_value === -1 ? 0 : flag.flag_value))}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:border-green-500 transition-colors cursor-pointer"
          >
            <option value="custom">Con límite</option>
            <option value="-1">Ilimitado</option>
          </select>
          {flag.flag_value !== -1 && (
            <input
              type="number"
              defaultValue={flag.flag_value}
              onBlur={e => {
                const v = parseFloat(e.target.value)
                if (!isNaN(v) && v !== flag.flag_value) handleToggle(v)
              }}
              className="w-20 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-center text-gray-900 focus:outline-none focus:border-green-500"
            />
          )}
          {saving && <span className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />}
        </div>
      )}
    </div>
  )
}

// ── Plan row ───────────────────────────────────────────────────────────────
function PlanRow({ plan, onEdit, onRefresh }: {
  plan: Plan; onEdit: () => void; onRefresh: () => void
}) {
  const { user } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [localFlags, setLocalFlags] = useState<FeatureFlag[]>(() => mergeFlags(plan.feature_flags))
  const [toggling, setToggling] = useState(false)

  // Sync flags when plan refreshes — keep merged with templates
  useEffect(() => { setLocalFlags(mergeFlags(plan.feature_flags)) }, [plan.feature_flags])

  function updateFlagLocally(flagKey: string, value: any) {
    setLocalFlags(prev => prev.map(f => f.flag_key === flagKey ? { ...f, flag_value: value } : f))
  }

  async function handleToggleActive() {
    if (!user || toggling) return
    setToggling(true)
    try {
      const token = await user.getIdToken()
      await fetch(`/api/admin/plans/${plan.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !plan.is_active }),
      })
      onRefresh()
    } finally {
      setToggling(false)
    }
  }

  const booleanFlags = localFlags.filter(f => f.flag_type === 'boolean')
  const numberFlags  = localFlags.filter(f => f.flag_type !== 'boolean')
  const activeFlags  = booleanFlags.filter(f => f.flag_value).length

  return (
    <div className={`bg-white border rounded-2xl overflow-hidden transition-all ${plan.is_active ? 'border-gray-200' : 'border-gray-100'}`}>
      {/* Main row */}
      <div className={`flex items-center gap-4 px-5 py-4 ${!plan.is_active ? 'opacity-50' : ''}`}>

        {/* Color bar */}
        <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: plan.color || '#16a34a' }} />

        {/* Name + slug */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-gray-900 font-semibold text-sm">{plan.name}</span>
            {plan.is_popular && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                Popular
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-gray-400 text-[11px] font-mono">{plan.slug}</span>
            {localFlags.length > 0 && (
              <span className="text-[10px] text-gray-400">
                {activeFlags}/{booleanFlags.length} features activos
              </span>
            )}
          </div>
        </div>

        {/* Price + Trial */}
        <div className="text-right hidden sm:block flex-shrink-0">
          <div className="text-gray-900 font-semibold text-sm">
            {plan.price === 0 ? 'Gratis' : `USD ${plan.price}/mes`}
          </div>
          {plan.price_yearly > 0 && (
            <div className="text-gray-400 text-xs">USD {plan.price_yearly}/mes (anual)</div>
          )}
          {(plan.trial_days ?? 0) > 0 && (
            <div className="mt-0.5">
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                {plan.trial_days}d trial
              </span>
            </div>
          )}
        </div>

        {/* Org count */}
        <div className="text-right hidden md:block flex-shrink-0 w-20">
          <div className="text-gray-900 font-semibold text-sm">{plan.org_count}</div>
          <div className="text-gray-400 text-xs">organizaciones</div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Active toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 hidden sm:block">
              {plan.is_active ? 'Activo' : 'Inactivo'}
            </span>
            <Toggle
              value={plan.is_active}
              onChange={handleToggleActive}
              loading={toggling}
            />
          </div>

          {/* Separator */}
          <div className="w-px h-5 bg-gray-100" />

          <button onClick={() => setExpanded(e => !e)}
            className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-900 hover:bg-gray-50 border border-gray-100 transition-all">
            {expanded ? 'Ocultar' : 'Flags'}
          </button>
          <button onClick={onEdit}
            className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-900 hover:bg-gray-50 border border-gray-100 transition-all">
            Editar
          </button>
        </div>
      </div>

      {/* Expanded feature flags — inline toggleable */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/50">
          <div className="px-5 pt-3 pb-1">
            <div className="text-[10px] font-bold text-gray-400 tracking-widest mb-2">FEATURE FLAGS</div>
          </div>

          {localFlags.length === 0 ? (
            <p className="px-5 pb-4 text-gray-400 text-sm">Sin feature flags configurados.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-x-4 px-4 pb-3">
              {/* Boolean flags */}
              {booleanFlags.length > 0 && (
                <div>
                  <p className="text-[10px] text-gray-400 font-semibold px-4 mb-1">ACCESOS</p>
                  {booleanFlags.map(flag => (
                    <FlagRow key={flag.flag_key} flag={flag} planId={plan.id} onUpdate={updateFlagLocally} />
                  ))}
                </div>
              )}

              {/* Numeric flags */}
              {numberFlags.length > 0 && (
                <div>
                  <p className="text-[10px] text-gray-400 font-semibold px-4 mb-1">LÍMITES</p>
                  {numberFlags.map(flag => (
                    <FlagRow key={flag.flag_key} flag={flag} planId={plan.id} onUpdate={updateFlagLocally} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function AdminPlansPage() {
  const { user } = useAuth()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPlan, setEditingPlan] = useState<Partial<Plan> | null | 'new'>()

  const fetchPlans = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/admin/plans', { headers: { Authorization: `Bearer ${token}` } })
      setPlans((await res.json()).plans || [])
    } finally { setLoading(false) }
  }, [user])

  useEffect(() => { fetchPlans() }, [fetchPlans])

  return (
    <PageShell
      count={plans.length}
      countLabel="planes configurados"
      actions={
        <button onClick={() => setEditingPlan('new')}
          className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors">
          + Nuevo plan
        </button>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <span className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {plans.map(plan => (
            <PlanRow
              key={plan.id}
              plan={plan}
              onEdit={() => setEditingPlan(plan)}
              onRefresh={fetchPlans}
            />
          ))}
          {plans.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-12">No hay planes configurados</p>
          )}
        </div>
      )}

      {editingPlan !== undefined && editingPlan !== null && (
        <PlanModal
          plan={editingPlan === 'new' ? null : editingPlan}
          onClose={() => setEditingPlan(undefined)}
          onSave={() => { setEditingPlan(undefined); fetchPlans() }}
        />
      )}
    </PageShell>
  )
}
