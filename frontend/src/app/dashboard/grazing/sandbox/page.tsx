/**
 * sandbox/page.tsx — Mesa de Arena (Simulación Agronómica)
 * ──────────────────────────────────────────────────────────
 * Layout Desktop: 3 columnas (Rodeos 25% | Mapa 45% | Potreros 30%)
 * Layout Mobile:  Segmented control (Tabs) + Bottom Sheet parámetros
 *
 * Flujo:
 *  1. Carga paddocks + herds del servidor
 *  2. init() → SandboxStore
 *  3. Usuario configura parámetros globales en el header
 *  4. Activa/ordena rodeos (Col 1) y potreros (Col 3) → recalculate()
 *  5. "Generar Plan" → confirmPlan() → POST batch sin reload → Gantt
 */
'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch } from '@/lib/apiFetch'
import { toast } from 'sonner'
import { Loader2, Sparkles, SlidersHorizontal, X, AlertTriangle, Pencil } from 'lucide-react'
import { useSandboxStore } from '@/lib/grazing/sandboxStore'
import { useSandboxReadiness } from '@/lib/grazing/useSandboxReadiness'
import { usePlanHydration } from '@/lib/grazing/usePlanHydration'
import { PlannerNav } from '@/components/planner/PlannerNav'
import { PlanDropdown, type PlanOption } from '@/components/planner/PlanDropdown'
import SandboxControls  from './SandboxControls'
import SandboxTable     from './SandboxTable'
import SandboxMap       from './SandboxMap'
import HerdCards        from './HerdCards'
import SandboxSchedule  from './SandboxSchedule'
import SandboxPlanPanel from './SandboxPlanPanel'
import { ConfirmDialog } from '@/design-system/molecules/ConfirmDialog'
import { Map, List }    from 'lucide-react'

// ── Tipos mínimos del fetcher ─────────────────────────────────────────────────

interface PaddockRaw {
  id: string; name: string
  area_ha: number | string
  dry_matter_kg_ha?: number | string | null
  lat?: number | null; lng?: number | null
  polygon?: [number, number][] | null
  polygon_coordinates?: [number, number][] | null
  /** May be a flat [lat,lng][] OR a GeoJSON Polygon/Feature object */
  boundary?: [number, number][] | { type: string; coordinates?: any; geometry?: any; features?: any } | null
  geojson?: { type?: string; coordinates?: any; geometry?: any } | null
}

interface HerdRaw {
  id: string; name?: string
  total_ev?: number | string | null
  head_count?: number | string | null
}

// ── Mobile tab type ───────────────────────────────────────────────────────────

type MobileTab = 'rodeos' | 'mapa' | 'potreros'

const TABS: { key: MobileTab; label: string }[] = [
  { key: 'rodeos',   label: 'Rodeos' },
  { key: 'mapa',     label: 'Mapa' },
  { key: 'potreros', label: 'Potreros' },
]

// ── Componente ────────────────────────────────────────────────────────────────

export default function SandboxPage() {
  const { user }  = useAuth()
  const router    = useRouter()

  const [loading, setLoading]           = useState(true)
  const [mobileTab, setMobileTab]       = useState<MobileTab>('potreros')
  const [paramsOpen, setParamsOpen]     = useState(false)
  const [showMap, setShowMap]           = useState(false)

  // ── Dialog states ─────────────────────────────────────────────────────────
  const [collisionDialog, setCollisionDialog] = useState<{ message: string; resolve: (ok: boolean) => void } | null>(null)

  const init          = useSandboxStore(s => s.init)
  const confirmPlan   = useSandboxStore(s => s.confirmPlan)
  const result        = useSandboxStore(s => s.result)
  const herds         = useSandboxStore(s => s.herds)
  const isDirty       = useSandboxStore(s => s.isDirty)

  // ── Readiness — controla la habilitación de botones de acción ─────────
  const { canGeneratePlan, canSavePlan, isSaving } = useSandboxReadiness()

  // ── Navigation guard state ─────────────────────────────────────────────
  const [ganttGuardOpen, setGanttGuardOpen] = useState(false)

  // ── Season plans guardados (para el PlanDropdown de referencia) ──────────────
  const [savedPlans, setSavedPlans] = useState<PlanOption[]>([])
  const [selectedSavedPlanIds, setSelectedSavedPlanIds] = useState<string[]>([])

  const SANDBOX_PLAN_COLORS = [
    '#22c55e', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444',
    '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
  ]

  // ── Plan Hydration (Req 2) ────────────────────────────────────────────
  // Rehidratación defensiva: potreros/rodeos eliminados se ignoran silenciosamente
  const { isHydrating, sandboxMode, warnings, hydratePlan, resetToCreate } =
    usePlanHydration((url, opts) => apiFetch(url, opts))

  // ── Plan name ─────────────────────────────────────────────────────────
  // BUG 4 FIX: El nombre nace vacío para forzar identidad explícita por el usuario.
  // Solo se pre-rellena al hidratar un plan existente (modo edición).
  const [planName, setPlanName] = useState('')

  const handleSavedPlanToggle = useCallback(async (id: string) => {
    const plan = savedPlans.find(p => p.id === id)
    if (!plan) return
    // Toggle: si ya estaba seleccionado → resetear a modo creación
    if (selectedSavedPlanIds.includes(id)) {
      setSelectedSavedPlanIds([])
      resetToCreate()
      setPlanName('')
      return
    }
    // Seleccionar SOLO este plan (single-select) y rehidratar el store
    setSelectedSavedPlanIds([id])
    await hydratePlan(id, plan.name)
    setPlanName(plan.name)
  }, [savedPlans, selectedSavedPlanIds, hydratePlan, resetToCreate])
  // ── Fetch inicial ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return
    ;(async () => {
      try {
        const [pRes, hRes, spRes] = await Promise.all([
          apiFetch('/api/paddocks'),
          apiFetch('/api/herds'),
          apiFetch('/api/season-plans'),
        ])
        const pData = await pRes.json()
        const hData = await hRes.json()
        const pList: PaddockRaw[] = pData.paddocks ?? pData ?? []
        const hList: HerdRaw[]   = hData.herds    ?? hData ?? []
        // Temporada: si estamos en invierno (abr–sep) → closed; resto → open
        const m = new Date().getMonth() + 1
        const mode = m >= 4 && m < 10 ? 'closed' : 'open'
        init({ paddocks: pList, herds: hList, mode })

        // Cargar season-plans para el PlanDropdown de referencia
        if (spRes.ok) {
          const spData = await spRes.json()
          const spList: any[] = spData.season_plans ?? spData.plans ?? spData ?? []
          const planOptions: PlanOption[] = spList.map((sp, idx) => ({
            id: sp.id,
            name: sp.name || `Plan ${sp.year || idx + 1}`,
            color: SANDBOX_PLAN_COLORS[idx % SANDBOX_PLAN_COLORS.length],
            status: sp.status === 'COMPLETED' ? 'completed' : 'active',
            dateRange: sp.start_date
              ? `${sp.start_date}${sp.end_date ? ' → ' + sp.end_date : ''}`
              : undefined,
          }))
          setSavedPlans(planOptions)

          // BLANK STATE: No auto-select. The user must explicitly choose a plan
          // from the dropdown. Initial state is always a clean "new plan".
        }
      } catch {
        toast.error('Error al cargar datos del campo')
      } finally {
        setLoading(false)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, init])

  // ── Confirmar plan ─────────────────────────────────────────────────────────

  const handleConfirm = useCallback(async () => {
    // Fetch existing plans for collision detection — solo planes ACTIVOS (no completados/históricos)
    let existingPlans: any[] = []
    try {
      const plansRes = await apiFetch('/api/grazing-plans')
      if (plansRes.ok) {
        const data = await plansRes.json()
        const today = new Date().toISOString().split('T')[0]
        existingPlans = (data.plans ?? []).filter((p: any) => {
          const activeStatus = p.status === 'PLANNED' || p.status === 'IN_PROGRESS' || p.status === 'SCHEDULED'
          const hasFutureExit = p.exit_date && p.exit_date > today
          // BUG 2 FIX: excluir los bloques del plan que estamos editando (no son colisiones reales)
          const notCurrentPlan = sandboxMode.type !== 'edit' || p.season_plan_id !== sandboxMode.planId
          return activeStatus && hasFutureExit && notCurrentPlan
        })
      }
    } catch { /* collision detection is optional */ }

    const activeHerdIds = herds.filter(h => h.enabled).map(h => h.id)
    await confirmPlan({
      apiFn: (url, opts) => apiFetch(url, opts),
      herdIds: activeHerdIds,
      planName,
      existingPlans,
      // BUG 2 FIX: pasar el ID del season_plan existente para hacer PATCH en lugar de POST
      existingSeasonPlanId: sandboxMode.type === 'edit' ? sandboxMode.planId : undefined,
      onCollisionWarning: async (message) => {
        return new Promise<boolean>((resolve) => {
          setCollisionDialog({ message, resolve })
        })
      },
      onSuccess: (blocks, seasonPlanId) => {
        toast.success(`Plan guardado — ${blocks.length} bloques`)
        window.dispatchEvent(new Event('rodeo-gantt-reload'))
        router.push('/dashboard/grazing?view=gantt')
      },
      onError: (err) => toast.error(err),
    })
  }, [result, herds, confirmPlan, router, planName, sandboxMode])

  // ── Ir al Gantt (con guardia de navegación) ────────────────────────────

  const handleGoToGantt = useCallback(() => {
    if (!isDirty) {
      router.push('/dashboard/grazing?view=gantt')
    } else {
      setGanttGuardOpen(true)
    }
  }, [isDirty, router])

  const handleSaveAndGoToGantt = useCallback(async () => {
    setGanttGuardOpen(false)
    await handleConfirm()
    // handleConfirm already navigates to gantt on success via onSuccess callback
  }, [handleConfirm])

  const handleLeaveWithoutSaving = useCallback(() => {
    setGanttGuardOpen(false)
    router.push('/dashboard/grazing?view=gantt')
  }, [router])

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="sandbox-loading">
        <Loader2 size={24} className="animate-spin text-green-600" />
        <p>Cargando datos del campo…</p>
      </div>
    )
  }

  // ── Layout ─────────────────────────────────────────────────────────────────

  return (
    <div className="sandbox-page">

      {/* ════ HEADER DE NAVEGACIÓN ════ */}
      <div className="sandbox-header">
        <div className="sandbox-header-left">
          <div className="sandbox-title-group">
            <input
              id="sandbox-plan-name"
              type="text"
              value={planName}
              onChange={e => setPlanName(e.target.value)}
              // BUG 4 FIX: autoFocus para que el cursor aterrice en el nombre inmediatamente
              autoFocus={sandboxMode.type === 'create' && planName === ''}
              className="text-[20px] font-bold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-green-600 focus:outline-none px-1 py-0.5 rounded transition-colors min-w-[350px] md:min-w-[400px]"
              placeholder="Dar nombre al nuevo plan..."
              title="Haz clic para editar el nombre del plan"
            />
          </div>

          {/* PlanDropdown de referencia — planes guardados */}
          {savedPlans.length > 0 && (
            <div className="ml-3 flex items-center gap-2 flex-wrap">
              {/* Spinner mientras hidrata */}
              {isHydrating && (
                <span className="flex items-center gap-1.5 text-[11px] text-indigo-600 font-bold">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Cargando plan…
                </span>
              )}

              {/* Badge modo edición */}
              {sandboxMode.type === 'edit' && !isHydrating && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-black">
                  <Pencil className="w-3 h-3" />
                  Editando: {sandboxMode.planName}
                  <button
                    type="button"
                    onClick={() => { resetToCreate(); setPlanName(''); setSelectedSavedPlanIds([]) }}
                    className="ml-1 text-indigo-400 hover:text-indigo-700 transition-colors"
                    title="Volver al modo de creación"
                    aria-label="Salir del modo edición"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {/* Warning IDs huérfanos */}
              {warnings && (warnings.ghostHerdIds.length > 0 || warnings.ghostPaddockIds.length > 0) && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold" title={`Elementos del plan original no encontrados: ${[...warnings.ghostHerdIds, ...warnings.ghostPaddockIds].join(', ')}`}>
                  <AlertTriangle className="w-3 h-3" />
                  {warnings.ghostHerdIds.length + warnings.ghostPaddockIds.length} elementos no disponibles
                </span>
              )}

              <PlanDropdown
                plans={savedPlans}
                selectedIds={selectedSavedPlanIds}
                onToggle={handleSavedPlanToggle}
                allowEmpty
              />
            </div>
          )}
        </div>

        <div className="sandbox-header-right">
          {/* Navegación unificada — [Gantt|Lista|Historial] */}
          <PlannerNav
            viewMode="gantt"
            onChangeView={(v) => router.push(`/dashboard/grazing?view=${v}`)}
            isSandbox
            hasPlans={savedPlans.length > 0}
          />

          {/* Parámetros — botón mobile */}
          <button
            id="sandbox-params-btn"
            className="sandbox-params-btn"
            onClick={() => setParamsOpen(v => !v)}
            aria-label="Parámetros de temporada"
            title="Parámetros de temporada"
          >
            <SlidersHorizontal size={16} />
            <span>Parámetros</span>
          </button>

          {/* Generar Plan — disabled hasta tener ≥1 herd Y ≥1 potrero */}
          <button
            id="sandbox-confirm-btn"
            onClick={handleConfirm}
            disabled={!canGeneratePlan}
            title={!canGeneratePlan ? 'Seleccioná al menos 1 rodeo y 1 potrero para generar el plan' : 'Guardar plan'}
            className={`sandbox-confirm-btn ${isSaving ? 'sandbox-confirm-btn--loading' : ''} bg-[#008234] hover:bg-[#006026] disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {isSaving
              ? <><Loader2 size={15} className="animate-spin" /><span className="whitespace-nowrap">Guardando…</span></>
              : <span className="whitespace-nowrap">{sandboxMode.type === 'edit' ? 'Guardar Plan' : 'Generar Plan'}</span>
            }
          </button>
        </div>
      </div>

      {/* ════ PARÁMETROS GLOBALES ════
          Desktop: siempre visible bajo el header.
          Mobile: Bottom sheet (drawer) controlado por paramsOpen. */}
      <div className={`sandbox-params-bar ${paramsOpen ? 'sandbox-params-bar--open' : ''}`}>
        <SandboxControls />
        {/* Botón cierre solo en mobile */}
        {paramsOpen && (
          <button className="sandbox-params-close" onClick={() => setParamsOpen(false)} aria-label="Cerrar">
            <X size={16} />
          </button>
        )}
      </div>
      {paramsOpen && <div className="sandbox-params-overlay" onClick={() => setParamsOpen(false)} />}

      {/* ════ TABS MOBILE ════ */}
      <div className="sandbox-mobile-tabs" role="tablist" aria-label="Secciones">
        {TABS.map(t => (
          <button
            key={t.key}
            id={`sandbox-tab-${t.key}`}
            role="tab"
            aria-selected={mobileTab === t.key}
            className={`sandbox-mobile-tab ${mobileTab === t.key ? 'sandbox-mobile-tab--active' : ''}`}
            onClick={() => setMobileTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ════ LAYOUT 3 COLUMNAS (DESKTOP) / TAB PANEL (MOBILE) ════ */}
      <div className="sandbox-body">

        {/* Columna 1: Rodeos */}
        <div className={`sandbox-col sandbox-col--herds ${mobileTab !== 'rodeos' ? 'sandbox-col--mobile-hidden' : ''}`}>
          <HerdCards />
          {/* Tarea 5: Panel de planes guardados para re-edición */}
          <SandboxPlanPanel enabled={!!user} />
        </div>

        {/* Columna 2: Potreros */}
        <div className={`sandbox-col sandbox-col--paddocks ${mobileTab !== 'potreros' ? 'sandbox-col--mobile-hidden' : ''}`}>
          <SandboxTable />
        </div>

        {/* Columna 3: Resumen / Mapa */}
        <div className={`sandbox-col sandbox-col--map ${mobileTab !== 'mapa' ? 'sandbox-col--mobile-hidden' : ''}`}>
          <div className="flex flex-col h-full">
            {/* Header alineado con columnas 1 y 2 */}
            <div className="flex items-start justify-between px-3 pt-3 pb-2 border-b border-gray-200 shrink-0">
              <div>
                <h2 className="text-xs font-black text-gray-500 tracking-wider uppercase">
                  {showMap ? 'Mapa de Potreros' : 'Resumen del Plan'}
                </h2>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {showMap ? 'Polígonos y ruta de pastoreo' : 'Cronograma de la temporada'}
                </p>
              </div>
              <div className="flex items-center gap-2 mt-0.5">

                <button
                  onClick={() => setShowMap(!showMap)}
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 hover:text-gray-800 transition-colors"
                >
                  {showMap ? <><List size={12} /> Ver Plan</> : <><Map size={12} /> Ver Mapa</>}
                </button>
              </div>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-hidden relative">
              {showMap ? <SandboxMap /> : <SandboxSchedule />}
            </div>
          </div>
        </div>


      </div>

      {/* ═══ Collision Dialog ═══ */}
      <ConfirmDialog
        open={!!collisionDialog}
        onClose={() => {
          collisionDialog?.resolve(false)
          setCollisionDialog(null)
        }}
        onConfirm={() => {
          collisionDialog?.resolve(true)
          setCollisionDialog(null)
        }}
        title="Solapamiento detectado"
        description="Se detectaron potreros con planes que se superponen en las mismas fechas."
        items={collisionDialog?.message.split('\n').filter(Boolean)}
        confirmLabel="Guardar igualmente"
        cancelLabel="Cancelar"
        variant="danger"
      />
      {/* ═══ Navigation Guard: Ir al Gantt con cambios sin guardar ═══ */}
      {ganttGuardOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pb-20 md:pb-4"
          style={{
            backdropFilter: 'blur(8px) saturate(0.8)',
            WebkitBackdropFilter: 'blur(8px) saturate(0.8)',
            backgroundColor: 'rgba(0,0,0,0.55)'
          }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setGanttGuardOpen(false) }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-amber-100">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1 pt-1">
                <h3 className="text-base font-black text-gray-900 leading-none">
                  Cambios sin guardar
                </h3>
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                  Tenés cambios sin guardar en la mesa de arena. Si abandonás la página ahora, se perderán.
                </p>
              </div>
              <button
                onClick={() => setGanttGuardOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Actions */}
            <div className="px-6 pb-5 flex flex-col gap-2">
              <button
                id="sandbox-save-go-gantt-btn"
                onClick={handleSaveAndGoToGantt}
                disabled={isSaving}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-green-700 hover:bg-green-800 rounded-xl transition-all shadow-sm disabled:opacity-60"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Guardar e ir al Gantt
              </button>
              <button
                id="sandbox-leave-no-save-btn"
                onClick={handleLeaveWithoutSaving}
                className="w-full px-4 py-2.5 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all"
              >
                Salir sin guardar
              </button>
              <button
                onClick={() => setGanttGuardOpen(false)}
                className="w-full px-4 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
