'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'

// ── Types ──────────────────────────────────────────────────────────────────
interface GlobalStats {
  total_users: number
  active_users: number
  total_orgs: number
  total_hectares: number
  total_paddocks: number
  total_herds: number
  active_grazing_plans: number
  total_grazing_plans: number
  new_users_30d: number
  new_orgs_30d: number
}
interface PlanDist { name: string; slug: string; color: string; org_count: number; total_ha: number }
interface MonthlyStat { month: string; signups: number }
interface TopOrg { id: string; name: string; total_area_ha: number; plan_name: string; plan_slug: string; owner_email: string; paddocks_count: number; herds_count: number }
interface AuditEntry { id: string; action: string; entity_type: string; actor_email: string; created_at: string }

interface MetricsData {
  global: GlobalStats
  planDistribution: PlanDist[]
  monthlySignups: MonthlyStat[]
  topOrgs: TopOrg[]
  recentActivity: AuditEntry[]
  generatedAt: string
}

// ── Animated Counter ───────────────────────────────────────────────────────
function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const target = value
    const duration = 900
    const startTime = performance.now()
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(eased * target)
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [value])
  return <span>{Math.floor(display).toLocaleString('es-AR')}{suffix}</span>
}

// ── KPI Card ──────────────────────────────────────────────────────────────
function KpiCard({
  label, value, suffix = '', trend, trendLabel
}: {
  label: string; value: number; suffix?: string; trend?: number; trendLabel?: string
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-gray-300 transition-all">
      <div className="text-gray-500 text-xs font-medium mb-3 uppercase tracking-wide">{label}</div>
      <div className="text-3xl font-black text-gray-900">
        <AnimatedNumber value={value} suffix={suffix} />
      </div>
      {trend !== undefined && (
        <div className={`text-xs font-semibold mt-2 ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {trend >= 0 ? '+' : ''}{trend} {trendLabel}
        </div>
      )}
    </div>
  )
}

// ── Action label ──────────────────────────────────────────────────────────
function ActionBadge({ action }: { action: string }) {
  const styles: Record<string, string> = {
    USER_IMPERSONATED:   'bg-amber-50 text-amber-700 border-amber-200',
    PLAN_CREATED:        'bg-green-50 text-green-700 border-green-200',
    PLAN_UPDATED:        'bg-blue-50 text-blue-700 border-blue-200',
    PLAN_DEACTIVATED:    'bg-red-50 text-red-700 border-red-200',
    USER_UPDATED:        'bg-blue-50 text-blue-700 border-blue-200',
    CONFIG_UPDATED:      'bg-purple-50 text-purple-700 border-purple-200',
    SUPER_ADMIN_CREATED: 'bg-gray-50 text-gray-700 border-gray-200',
  }
  const cls = styles[action] || 'bg-gray-50 text-gray-500 border-gray-200'
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${cls}`}>
      {action.replace(/_/g, ' ')}
    </span>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMetrics = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/admin/metrics', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Error al cargar métricas')
      const json = await res.json()
      setData(json)
    } catch {
      setError('Error cargando métricas. Verificá tu conexión.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchMetrics() }, [fetchMetrics])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Cargando…</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <p className="text-red-500 text-sm mb-3">{error}</p>
        <button onClick={fetchMetrics} className="text-xs text-green-600 hover:underline">Reintentar</button>
      </div>
    </div>
  )

  const g = data?.global

  return (
    <div className="space-y-8 max-w-7xl">

      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm">
            Actualizado: {data?.generatedAt
              ? new Date(data.generatedAt).toLocaleTimeString('es-AR')
              : '—'}
          </p>
        </div>
        <button
          onClick={fetchMetrics}
          disabled={loading}
          className="text-sm text-gray-500 hover:text-gray-900 border border-gray-200 hover:border-gray-300 px-4 py-2 rounded-xl transition-all"
        >
          {loading ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {/* KPI Grid — primera fila */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Usuarios totales"   value={g?.total_users || 0}    trend={g?.new_users_30d}  trendLabel="nuevos (30d)" />
        <KpiCard label="Organizaciones"     value={g?.total_orgs || 0}     trend={g?.new_orgs_30d}   trendLabel="nuevas (30d)" />
        <KpiCard label="Hectáreas totales"  value={g?.total_hectares || 0} suffix=" ha" />
        <KpiCard label="Planes de pastoreo" value={g?.total_grazing_plans || 0} />
      </div>

      {/* KPI Grid — segunda fila */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Potreros activos"   value={g?.total_paddocks || 0} />
        <KpiCard label="Rodeos registrados" value={g?.total_herds || 0} />
        <KpiCard label="Planes en curso"    value={g?.active_grazing_plans || 0} />
        <KpiCard label="Usuarios activos"   value={g?.active_users || 0} />
      </div>

      {/* Fila de análisis */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Plan distribution */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h3 className="text-gray-900 font-bold text-sm mb-5">Distribución de Planes</h3>
          {data?.planDistribution.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Sin datos</p>
          ) : (
            <div className="space-y-4">
              {data?.planDistribution.map(plan => {
                const total = data.planDistribution.reduce((a, b) => a + b.org_count, 0)
                const pct = total > 0 ? Math.round((plan.org_count / total) * 100) : 0
                return (
                  <div key={plan.slug}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-gray-700 font-medium">{plan.name}</span>
                      <span className="text-gray-400 text-xs">{plan.org_count} orgs · {pct}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-green-500 transition-all duration-1000"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-gray-400 mt-1">
                      {Number(plan.total_ha).toLocaleString()} ha
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Monthly signups */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h3 className="text-gray-900 font-bold text-sm mb-5">Registros por Mes</h3>
          {!data?.monthlySignups.length ? (
            <p className="text-gray-400 text-sm text-center py-8">Sin datos aún</p>
          ) : (
            <div className="flex items-end gap-1.5 h-28">
              {data?.monthlySignups.map((m, i) => {
                const max = Math.max(...data.monthlySignups.map(x => x.signups), 1)
                const pct = (m.signups / max) * 100
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-[10px] text-gray-400">{m.signups}</div>
                    <div
                      className="w-full rounded-t bg-green-100 hover:bg-green-500 transition-colors"
                      style={{ height: `${Math.max(pct, 4)}%` }}
                      title={`${m.month}: ${m.signups}`}
                    />
                    <div className="text-[9px] text-gray-400 font-mono">{m.month.slice(5)}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent audit */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h3 className="text-gray-900 font-bold text-sm mb-5">Actividad Reciente</h3>
          <div className="space-y-3">
            {!data?.recentActivity.length ? (
              <p className="text-gray-400 text-sm text-center py-4">Sin actividad</p>
            ) : (
              data.recentActivity.map(entry => (
                <div key={entry.id} className="flex items-start gap-2.5">
                  <ActionBadge action={entry.action} />
                  <div className="min-w-0 flex-1">
                    <div className="text-gray-500 text-xs truncate">{entry.actor_email}</div>
                    <div className="text-gray-300 text-[10px]">
                      {new Date(entry.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Top Organizations */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-gray-900 font-bold text-sm">Top Organizaciones por Hectáreas</h3>
          <a href="/admin/users" className="text-xs text-green-600 hover:text-green-700 font-medium">
            Ver todos →
          </a>
        </div>
        <div className="divide-y divide-gray-50">
          {!data?.topOrgs.length ? (
            <div className="px-6 py-8 text-gray-400 text-sm text-center">Sin organizaciones</div>
          ) : (
            data.topOrgs.map((org, i) => (
              <div key={org.id} className="px-6 py-3.5 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                <div className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-gray-500">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-gray-900 font-semibold text-sm truncate">{org.name || '—'}</div>
                  <div className="text-gray-400 text-xs">{org.owner_email}</div>
                </div>
                <div className="text-right hidden md:block">
                  <div className="text-gray-900 text-sm font-semibold">
                    {Number(org.total_area_ha || 0).toLocaleString()} ha
                  </div>
                  <div className="text-gray-400 text-xs">
                    {org.paddocks_count} potreros · {org.herds_count} rodeos
                  </div>
                </div>
                <span className="flex-shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
                  {org.plan_name || 'Sin plan'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  )
}
