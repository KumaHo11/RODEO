/**
 * usePlanHydration.ts — Rehidratación defensiva de estado desde un season plan
 * ─────────────────────────────────────────────────────────────────────────────
 * Arquitectura: Discriminated Union para modo sandbox (create | edit).
 * Regla: NUNCA crashea por IDs huérfanos. Los potreros/rodeos eliminados
 * de la BD se ignoran con un warning (ghostIds) en lugar de propagar un error.
 *
 * Flujo:
 *  1. Fetch del season_plan completo (herd_ids, demand_snapshot, grazing-plans)
 *  2. Intersección defensiva con paddocks/herds actuales del server
 *  3. Patch atómico del sandboxStore (herds enabled, paddockRows enabled, config)
 *  4. Transición del sandboxMode a { type: 'edit', planId, planName }
 */
'use client'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { useSandboxStore } from './sandboxStore'

// ── Tipos ─────────────────────────────────────────────────────────────────────

/** Modo del sandbox — Discriminated Union para prevenir estados ambivalentes */
export type SandboxMode =
  | { type: 'create' }
  | { type: 'edit'; planId: string; planName: string }

export interface HydrationWarning {
  ghostHerdIds: string[]
  ghostPaddockIds: string[]
}

export interface PlanHydrationResult {
  /** true mientras se está cargando el plan */
  isHydrating: boolean
  /** Modo actual (create | edit) */
  sandboxMode: SandboxMode
  /** Warnings de IDs huérfanos (no crashean, solo informan) */
  warnings: HydrationWarning | null
  /** Cargar y rehidratar un plan existente */
  hydratePlan: (planId: string, planName: string) => Promise<void>
  /** Volver al modo creación y limpiar el estado del sandbox */
  resetToCreate: () => void
}

// ── Tipos de snapshot del plan ─────────────────────────────────────────────────

interface SeasonPlanSnapshot {
  id: string
  name: string
  herd_ids?: string[]
  start_date?: string | null
  end_date?: string | null
  /** 'abierto' | 'cerrado' — mapeado desde season_type del backend */
  season_type?: string | null
  demand_snapshot?: {
    herds?: Array<{ id: string; gdp_kg_day?: number; total_ev?: number; heads?: number }>
  } | null
  grazing_plans?: Array<{ paddock_id: string; entry_date: string; exit_date: string }>
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Convierte cualquier fecha ISO o YYYY-MM-DD a "YYYY-MM-DD" limpio.
 * El backend puede mandar "2026-09-25T03:00:00.000Z" → input[type=date] espera "2026-09-25".
 * Si la conversión falla retorna null para ignorarla de forma segura.
 */
function isoToDate(raw: string | null | undefined): string | null {
  if (!raw) return null
  // Ya tiene formato YYYY-MM-DD (sin hora)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  // Tiene componente de tiempo → extraer solo la fecha local
  const d = new Date(raw)
  if (isNaN(d.getTime())) return null
  // Usar UTC para evitar off-by-one por timezone
  const y  = d.getUTCFullYear()
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
  const da = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

export function usePlanHydration(
  apiFn: (url: string, opts?: RequestInit) => Promise<Response>
): PlanHydrationResult {
  const [isHydrating, setIsHydrating] = useState(false)
  const [sandboxMode, setSandboxMode] = useState<SandboxMode>({ type: 'create' })
  const [warnings, setWarnings] = useState<HydrationWarning | null>(null)

  // Solo lectura del store — no suscribir a herds/paddockRows para evitar re-renders
  // La hidratación accede al estado via getState() directamente

  const hydratePlan = useCallback(async (planId: string, planName: string) => {
    setIsHydrating(true)
    setWarnings(null)

    try {
      // 1. Fetch del season plan completo (incluye herd_ids, demand_snapshot)
      const res = await apiFn(`/api/season-plans/${planId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const sp: SeasonPlanSnapshot = data.season_plan ?? data

      // 2. Fetch de los grazing-plans asociados (para saber qué potreros)
      const plansRes = await apiFn(`/api/grazing-plans?season_plan_id=${planId}`)
      const plansData = plansRes.ok ? await plansRes.json() : { plans: [] }
      const grazingPlans: Array<{ paddock_id: string }> = plansData.plans ?? []

      // 3. ── Intersección defensiva ──────────────────────────────────────────
      //    Leer el estado actual directamente (sin suscripción) para la intersección
      const currentState = useSandboxStore.getState()
      const currentHerdIds    = new Set(currentState.herds.map(h => h.id))
      const currentPaddockIds = new Set(currentState.paddockRows.map(p => p.id))

      const planHerdIds    = sp.herd_ids ?? []
      const planPaddockIds = [...new Set(grazingPlans.map(gp => gp.paddock_id))]

      // IDs huérfanos: estaban en el plan pero ya no existen en la BD
      const ghostHerdIds    = planHerdIds.filter(id => !currentHerdIds.has(id))
      const ghostPaddockIds = planPaddockIds.filter(id => !currentPaddockIds.has(id))

      // IDs válidos: intersección
      const validHerdIds    = planHerdIds.filter(id => currentHerdIds.has(id))
      const validPaddockIds = planPaddockIds.filter(id => currentPaddockIds.has(id))

      // 4. ── Patch ATÓMICO del store — herds + paddocks + config en un solo setState ──
      //    CRITICAL FIX (Temporada Cerrada): computar EV DENTRO del setState usando
      //    los patchedHerds. Si se llama setConfig() después, s.herds ya tiene el
      //    estado anterior (sin enable) y computeEV() devuelve 0, dejando
      //    demandaDiariaKgMs = 0 → el motor no genera ningún bloque.
      useSandboxStore.setState(state => {
        const patchedHerds = state.herds.map(h => ({
          ...h,
          enabled: validHerdIds.includes(h.id),
        }))

        const patchedPaddocks = state.paddockRows.map(p => ({
          ...p,
          enabled: validPaddockIds.includes(p.id),
        }))

        // Calcular EV desde los herds ya patcheados
        const dailyKgEv = state.config.dailyAllocationKgEv
        const totalEV = patchedHerds
          .filter(h => h.enabled)
          .reduce((s, h) => s + h.totalEV, 0)
        const demandaDiariaKgMs = totalEV * dailyKgEv

        // Parsear fechas del plan
        const parsedStart = isoToDate(sp.start_date)
        const parsedEnd   = isoToDate(sp.end_date)
        const planMode: import('./types').SeasonMode = sp.season_type === 'cerrado' ? 'closed' : 'open'

        const updatedConfig: import('./types').SimulationConfig = {
          ...state.config,
          totalEV,
          demandaDiariaKgMs,
          mode: planMode,
          ...(parsedStart ? { fechaInicio: parsedStart } : {}),
          ...(parsedEnd   ? { fechaFin:    parsedEnd   } : {}),
        }

        return {
          herds: patchedHerds,
          paddockRows: patchedPaddocks,
          config: updatedConfig,
          mode: planMode,
          isDirty: false as const,
          lastSeasonPlanId: planId,
        }
      })

      // 5. Recalcular simulación con el estado ya rehidratado (EV correcto)
      useSandboxStore.getState().recalculate()

      // 7. Transición de modo
      setSandboxMode({ type: 'edit', planId, planName })

      // 8. Warnings para IDs huérfanos (no crashean, informan)
      if (ghostHerdIds.length > 0 || ghostPaddockIds.length > 0) {
        setWarnings({ ghostHerdIds, ghostPaddockIds })
        toast.warning(
          `Plan cargado con advertencias: ${ghostHerdIds.length + ghostPaddockIds.length} elemento(s) del plan original ya no están disponibles.`,
          { duration: 6000 }
        )
      } else {
        toast.success(`Plan "${planName}" cargado en la Mesa de Arena`)
      }
    } catch (err) {
      console.error('[usePlanHydration] error:', err)
      toast.error('No se pudo cargar el plan. Verificá la conexión.')
    } finally {
      setIsHydrating(false)
    }
  }, [apiFn])

  const resetToCreate = useCallback(() => {
    setSandboxMode({ type: 'create' })
    setWarnings(null)
    // Limpiar habilitaciones para modo creación fresco
    useSandboxStore.setState(state => ({
      herds:       state.herds.map(h => ({ ...h, enabled: false })),
      paddockRows: state.paddockRows.map(p => ({ ...p, enabled: false })),
      isDirty: false,
      lastSeasonPlanId: null,
    }))
    useSandboxStore.getState().recalculate()
  }, [])

  return { isHydrating, sandboxMode, warnings, hydratePlan, resetToCreate }
}
