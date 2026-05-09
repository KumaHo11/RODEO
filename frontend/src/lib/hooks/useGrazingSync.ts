/**
 * useGrazingSync — Hook de sincronización de Verdad Única + Tracks Paralelos
 *
 * Responsabilidades:
 *  1. Detectar cambios en los datos de Verdad Única (Stock/Rodeos + Eventos de Hacienda)
 *  2. Recalcular las proyecciones del Motor Sugerido cuando la carga animal cambia
 *  3. Notificar al usuario con un toast explicativo del impacto
 *  4. Exponer el estado `needsRecalc` para disparar la regeneración del Gantt Sugerido
 *
 * NOTA: El recálculo NO sobreescribe la base de datos automáticamente.
 * Solo marca el estado como "desactualizado" (needsRecalc = true) y
 * proporciona `recalcSuggestedFromStock` para que el Gantt lo ejecute
 * en el momento apropiado (cuando el usuario está en la pestaña Sugerida).
 */
import { useEffect, useRef, useCallback, useState } from 'react'
import { toast } from 'sonner'
import { getDynamicHerdEV } from '@/app/dashboard/grazing/page'
import { calculateUsableForage, calculateGrazingDays } from '@/lib/grazing/forageCurves'

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface GrazingSyncOptions {
  /** Lista de rodeos (Verdad Única de Stock) */
  herds: any[]
  /** Lista de potreros (Recursos) */
  paddocks: any[]
  /** Todos los planes actuales (manual + suggested) */
  plans: any[]
  /** Eventos de Hacienda: nacimientos, muertes, ventas — transversales a ambos Gantts */
  farmEvents: any[]
  /** kg MS/día por EV (configuración por organización) */
  dailyAllocationKg: number
  /** kg MS/ha de remanente objetivo */
  targetRemnant: number
  /** Callback para aplicar los planes sugeridos recalculados */
  onRecalcApplied?: (newSuggestedPlans: any[]) => void
}

export interface GrazingSyncResult {
  /** true si el motor sugerido requiere recálculo por cambio de stock */
  needsRecalc: boolean
  /** Limpia el flag needsRecalc manualmente */
  clearRecalcFlag: () => void
  /**
   * Recalcula las fechas de los planes sugeridos existentes basándose
   * en el stock actual. No crea nuevos planes, solo ajusta la duración
   * de los bloques existentes con plan_type = 'suggested'.
   */
  recalcSuggestedFromStock: () => any[]
  /** Resumen del impacto del recálculo para mostrar en el toast */
  recalcImpact: RecalcImpact | null
}

interface RecalcImpact {
  /** EV total anterior (antes del cambio) */
  prevTotalEV: number
  /** EV total nuevo */
  newTotalEV: number
  /** Cambio en días promedio de estadía por potrero */
  avgDaysDelta: number
  /** Número de bloques sugeridos que cambian */
  blocksAffected: number
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useGrazingSync({
  herds,
  paddocks,
  plans,
  farmEvents,
  dailyAllocationKg,
  targetRemnant,
  onRecalcApplied,
}: GrazingSyncOptions): GrazingSyncResult {
  const [needsRecalc, setNeedsRecalc] = useState(false)
  const [recalcImpact, setRecalcImpact] = useState<RecalcImpact | null>(null)

  // Snapshot de la Verdad Única anterior para comparar cambios
  const prevTotalEV = useRef<number>(0)
  const prevFarmEventsLen = useRef<number>(0)

  // ── Observador de Verdad Única ─────────────────────────────────────────
  useEffect(() => {
    if (herds.length === 0) return

    const todayStr = new Date().toISOString().split('T')[0]
    const currentTotalEV = herds.reduce(
      (sum: number, h: any) => sum + getDynamicHerdEV(h, todayStr, farmEvents),
      0
    )
    const farmEventsLen = farmEvents.length

    // Detectar cambio significativo en EV total (>1%) o nuevo evento de hacienda
    const evChanged = prevTotalEV.current > 0 &&
      Math.abs(currentTotalEV - prevTotalEV.current) / prevTotalEV.current > 0.01

    const eventsChanged = prevFarmEventsLen.current > 0 &&
      farmEventsLen !== prevFarmEventsLen.current

    if ((evChanged || eventsChanged) && prevTotalEV.current > 0) {
      const avgDaysDelta = estimateAvgDaysDelta(
        prevTotalEV.current,
        currentTotalEV,
        paddocks,
        targetRemnant,
        dailyAllocationKg
      )
      const suggestedPlans = plans.filter(p => p.plan_type === 'suggested')

      setRecalcImpact({
        prevTotalEV: prevTotalEV.current,
        newTotalEV: currentTotalEV,
        avgDaysDelta,
        blocksAffected: suggestedPlans.length,
      })

      setNeedsRecalc(true)

      // Notificar al usuario con un toast explicativo
      const sign = avgDaysDelta >= 0 ? '+' : ''
      const evDelta = Math.round(currentTotalEV - prevTotalEV.current)
      const evSign = evDelta >= 0 ? '+' : ''

      toast.info(
        `Motor Sugerido desactualizado`,
        {
          description: `El stock cambió (${evSign}${evDelta.toFixed(1)} EV). ` +
            `Los bloques de pastoreo sugeridos variarían ~${sign}${avgDaysDelta.toFixed(0)} días promedio. ` +
            `Cambiá a la pestaña "Optimizador" para ver las proyecciones actualizadas.`,
          duration: 7000,
          action: {
            label: 'Ver impacto',
            onClick: () => {
              // Scroll suave a la sección de planes sugeridos si existe
              document.querySelector('[data-gantt-tab="suggested"]')?.scrollIntoView({ behavior: 'smooth' })
            }
          }
        }
      )
    }

    prevTotalEV.current = currentTotalEV
    prevFarmEventsLen.current = farmEventsLen
  }, [herds, farmEvents, paddocks, plans, dailyAllocationKg, targetRemnant])

  // ── Función de recálculo de planes sugeridos ────────────────────────────
  const recalcSuggestedFromStock = useCallback((): any[] => {
    const todayStr = new Date().toISOString().split('T')[0]
    const newTotalEV = herds.reduce(
      (sum: number, h: any) => sum + getDynamicHerdEV(h, todayStr, farmEvents),
      0
    )
    if (newTotalEV === 0) return plans

    const dailyDemand = newTotalEV * dailyAllocationKg

    const recalculated = plans.map(plan => {
      if (plan.plan_type !== 'suggested') return plan

      const paddock = paddocks.find((p: any) => p.id === plan.paddock_id)
      if (!paddock) return plan

      const msHa = Number(paddock.dry_matter_kg_ha) || 1200
      const areaHa = Number(paddock.area_ha) || 10
      const usableMs = calculateUsableForage(msHa, targetRemnant, areaHa)
      const newDays = Math.max(1, calculateGrazingDays(usableMs, dailyDemand) || 3)

      // Mantener la fecha de entrada; recalcular solo la fecha de salida
      const entryDate = plan.entry_date
      const exitDate = addDays(entryDate, newDays)

      return {
        ...plan,
        exit_date: exitDate,
        // Marcar que fue recalculado en el frontend (no persistido aún)
        _recalculated: true,
        _recalcTimestamp: new Date().toISOString(),
      }
    })

    setNeedsRecalc(false)
    onRecalcApplied?.(recalculated)
    return recalculated
  }, [herds, paddocks, plans, farmEvents, dailyAllocationKg, targetRemnant, onRecalcApplied])

  const clearRecalcFlag = useCallback(() => {
    setNeedsRecalc(false)
    setRecalcImpact(null)
  }, [])

  return { needsRecalc, clearRecalcFlag, recalcSuggestedFromStock, recalcImpact }
}

// ── Helpers privados ─────────────────────────────────────────────────────────

/**
 * Estima el delta de días promedio por bloque si el EV total cambia.
 * Fórmula: Δdays ≈ Σ(usableMs_i / dailyDemand_i) − Σ(usableMs_i / prevDailyDemand)
 */
function estimateAvgDaysDelta(
  prevEV: number,
  newEV: number,
  paddocks: any[],
  targetRemnant: number,
  dailyAllocationKg: number
): number {
  if (prevEV === 0 || newEV === 0 || paddocks.length === 0) return 0

  const prevDailyDemand = prevEV * dailyAllocationKg
  const newDailyDemand = newEV * dailyAllocationKg

  let totalDelta = 0
  let count = 0

  for (const paddock of paddocks) {
    const msHa = Number(paddock.dry_matter_kg_ha) || 1200
    const areaHa = Number(paddock.area_ha) || 10
    const usableMs = calculateUsableForage(msHa, targetRemnant, areaHa)
    if (usableMs <= 0) continue

    const prevDays = calculateGrazingDays(usableMs, prevDailyDemand) || 0
    const newDays = calculateGrazingDays(usableMs, newDailyDemand) || 0
    totalDelta += newDays - prevDays
    count++
  }

  return count > 0 ? totalDelta / count : 0
}

/** Agrega n días a una ISO date string */
function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}
