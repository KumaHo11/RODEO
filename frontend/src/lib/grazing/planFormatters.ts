/**
 * planFormatters.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * SINGLE SOURCE OF TRUTH para todas las funciones de formateo, parseo de fechas
 * y construcción de datos CSV relacionadas con planificaciones de pastoreo.
 *
 * REGLA: Ningún componente de vista (Gantt, Lista, Historial) debe duplicar
 * estas funciones. Importar siempre desde este archivo.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Tipos mínimos necesarios ─────────────────────────────────────────────────
export interface GrazingPlanRow {
  id: string
  paddock_id: string
  herd_id?: string | null
  herd_ids?: string[]
  entry_date: string
  exit_date?: string | null
  actual_entry_date?: string | null
  actual_exit_date?: string | null
  planned_recovery_days?: number
  status: 'ACTIVE' | 'PLANNED' | 'COMPLETED' | string
  exit_dry_matter_kg_ha?: number | null
  exit_notes?: string | null
  plan_type?: string
  season_plan_id?: string | null
  ai_analysis?: {
    plan_source?: string
    season_plan_id?: string
    closing_stock?: Array<{ herd_id: string; initial: number; final: number }>
    [key: string]: unknown
  }
  paddocks?: { name?: string; area_ha?: number }
  herds?: { name?: string }
}

export interface HerdRow {
  id: string
  name: string
  total_ev?: number
  head_count?: number
  animal_count?: number
}

export interface PaddockRow {
  id: string
  name: string
  area_ha?: number
  dry_matter_kg_ha?: number
}

export interface SeasonPlanRow {
  id: string
  name: string
  year?: number
  season_type?: string
  source?: string
  start_date?: string | null
  end_date?: string | null
  total_ha?: number
  demand_snapshot?: { total_ev?: number }
  metrics?: { raw_table?: unknown }
}

// ─── Utilidades de Fecha ──────────────────────────────────────────────────────

/**
 * Normaliza cualquier valor a string ISO YYYY-MM-DD.
 * Maneja: null, undefined, Date objects, strings con timestamp.
 */
export const safeIso = (val: unknown): string => {
  if (!val) return ''
  if (val instanceof Date) return val.toISOString().split('T')[0]
  const s = String(val)
  return s.includes('T') ? s.split('T')[0] : s
}

/**
 * Formatea fecha ISO → dd/MM (formato compacto para display en tabla).
 * Retorna '—' si la fecha es inválida o vacía.
 */
export const fmtDate = (iso: unknown): string => {
  const s = safeIso(iso)
  if (!s) return '—'
  const d = new Date(s + 'T00:00:00')
  if (isNaN(d.getTime())) return '—'
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Formatea fecha ISO → dd/MM/YY (formato para exports CSV).
 * Retorna '' si la fecha es inválida o vacía.
 */
export const fmtDateLong = (iso: unknown): string => {
  const s = safeIso(iso)
  if (!s) return ''
  const d = new Date(s + 'T12:00')
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Calcula días entre dos fechas ISO (b - a).
 * Retorna 0 si alguna fecha es inválida.
 */
export const daysBetween = (a: unknown, b: unknown): number => {
  const sa = safeIso(a)
  const sb = safeIso(b)
  if (!sa || !sb) return 0
  const da = new Date(sa + 'T00:00:00')
  const db = new Date(sb + 'T00:00:00')
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return 0
  return Math.round((db.getTime() - da.getTime()) / 86400000)
}

/**
 * Agrega N días a una fecha ISO y retorna el resultado como ISO string.
 * Si la fecha es inválida, retorna la fecha de hoy.
 */
export const addDays = (iso: unknown, n: number): string => {
  const s = safeIso(iso)
  if (!s) return new Date().toISOString().split('T')[0]
  const d = new Date(s + 'T00:00:00')
  if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0]
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

/**
 * Retorna la fecha de hoy como string ISO YYYY-MM-DD.
 */
export const todayIso = (): string => new Date().toISOString().split('T')[0]

// ─── Resolución de Datos de Plan ─────────────────────────────────────────────

/**
 * Obtiene los IDs de rodeos efectivos para un plan de pastoreo.
 * Prioriza herd_ids (array), luego herd_id (singular).
 */
export const getPlanHerdIds = (plan: GrazingPlanRow): string[] => {
  if (Array.isArray(plan.herd_ids) && plan.herd_ids.length > 0) return plan.herd_ids
  if (plan.herd_id) return [plan.herd_id]
  return []
}

/**
 * Determina el ID de temporada padre de un plan.
 * Busca en season_plan_id directo y en ai_analysis.season_plan_id.
 */
export const getPlanSeasonId = (plan: GrazingPlanRow): string | null =>
  plan.season_plan_id || plan.ai_analysis?.season_plan_id || null

/**
 * Determina si un plan es de tipo "sugerido por IA".
 *
 * DISTINCIÓN CRÍTICA:
 * - plan.ai_analysis?.plan_source === 'suggested' → IA sugirió el plan → tab 'suggested'
 * - plan.plan_type === 'suggested' (sin ai_analysis.plan_source) → plan generado por el
 *   usuario desde la Mesa de Arena (Sandbox) → va al tab 'manual', NO al 'suggested'.
 *
 * Los planes del Sandbox son iniciados por el usuario, aunque internamente usen
 * el mismo algoritmo que la IA. El criterio de clasificación es el origen, no el método.
 */
export const isPlanSuggested = (plan: GrazingPlanRow): boolean =>
  plan.ai_analysis?.plan_source === 'suggested'

/**
 * Calcula los días planificados de un bloque.
 * Usa exit_date si existe, sino planned_recovery_days como fallback.
 */
export const getPlanDays = (plan: GrazingPlanRow): number | null => {
  if (plan.exit_date) return daysBetween(plan.entry_date, plan.exit_date)
  if (plan.planned_recovery_days) return plan.planned_recovery_days
  return null
}

/**
 * Calcula los días reales pastoreados (usando fechas actuales si están disponibles).
 */
export const getActualDays = (plan: GrazingPlanRow): number | null => {
  const effectiveEntry =
    plan.actual_entry_date ||
    (plan.status === 'COMPLETED' ? plan.entry_date : null)
  if (effectiveEntry && plan.actual_exit_date) {
    return daysBetween(effectiveEntry, plan.actual_exit_date)
  }
  return null
}

// ─── Agrupación para Acordeón ─────────────────────────────────────────────────

export const UNASSIGNED_SEASON_ID = '__unassigned__' as const

export interface AccordionGroup {
  seasonPlanId: string | typeof UNASSIGNED_SEASON_ID
  seasonPlan: SeasonPlanRow | null  // null para el grupo "Sin temporada"
  plans: GrazingPlanRow[]
}

/**
 * Agrupa planes de pastoreo por su SeasonPlan padre.
 * Los planes sin temporada se agrupan bajo el ID especial UNASSIGNED_SEASON_ID.
 *
 * El resultado está ordenado: primero las temporadas (por año desc), luego el grupo "sin temporada".
 */
export const groupPlansBySeasonPlan = (
  plans: GrazingPlanRow[],
  seasonPlans: SeasonPlanRow[],
): AccordionGroup[] => {
  const grouped = new Map<string, GrazingPlanRow[]>()

  for (const plan of plans) {
    const seasonId = getPlanSeasonId(plan) || UNASSIGNED_SEASON_ID
    if (!grouped.has(seasonId)) grouped.set(seasonId, [])
    grouped.get(seasonId)!.push(plan)
  }

  // Armar resultado ordenado
  const result: AccordionGroup[] = []

  // Primero: temporadas ordenadas por año descendente
  const sortedSeasonPlans = [...seasonPlans].sort(
    (a, b) => (b.year ?? 0) - (a.year ?? 0)
  )
  for (const sp of sortedSeasonPlans) {
    const spPlans = grouped.get(sp.id)
    if (spPlans && spPlans.length > 0) {
      result.push({ seasonPlanId: sp.id, seasonPlan: sp, plans: spPlans })
      grouped.delete(sp.id) // consumido
    }
  }

  // Último: planes sin temporada asignada
  const unassigned = grouped.get(UNASSIGNED_SEASON_ID)
  if (unassigned && unassigned.length > 0) {
    result.push({
      seasonPlanId: UNASSIGNED_SEASON_ID,
      seasonPlan: null,
      plans: unassigned.sort((a, b) => safeIso(b.entry_date).localeCompare(safeIso(a.entry_date))),
    })
  }

  return result
}

// ─── Generación de CSV ────────────────────────────────────────────────────────

export const CSV_HEADERS = [
  'Potrero', 'Rodeos', 'Ha', 'Estado',
  'Entrada plan', 'Salida plan', 'Días plan',
  'Entrada real', 'Salida real', 'Días reales',
  'Stock inicio', 'Stock fin',
  'Remanente (kg MS/ha)', 'Desvío (días)', 'Notas cierre',
] as const

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Pastando',
  PLANNED: 'Planificado',
  COMPLETED: 'Completado',
}

/**
 * Genera las filas CSV para un conjunto de planes.
 * Reutilizada por handleExportHistory Y handleExportSeasonPlan — elimina la duplicidad.
 */
export const buildPlanCsvRows = (
  plans: GrazingPlanRow[],
  herds: HerdRow[],
  paddocks: PaddockRow[],
): string[][] =>
  plans.map((plan) => {
    const herdIds = getPlanHerdIds(plan)
    const planHerds = herds.filter((h) => herdIds.includes(h.id))
    const paddock = paddocks.find((p) => p.id === plan.paddock_id)

    const herdNames = planHerds.map((h) => h.name).join(' / ')
    const areaHa = Number(paddock?.area_ha ?? plan.paddocks?.area_ha ?? 0).toFixed(1)
    const statusLabel = STATUS_LABEL[plan.status] || plan.status

    const plannedDays = getPlanDays(plan)
    const actualDays = getActualDays(plan)
    const effectiveEntry = plan.actual_entry_date || (plan.status === 'COMPLETED' ? plan.entry_date : null)

    let stockInicio = planHerds.reduce(
      (s, h) => s + (Number(h.animal_count ?? h.head_count) || 0),
      0
    )
    let stockFin: string | number = ''
    if (plan.ai_analysis?.closing_stock && Array.isArray(plan.ai_analysis.closing_stock)) {
      stockInicio = plan.ai_analysis.closing_stock.reduce(
        (s: number, r: { initial: number }) => s + (Number(r.initial) || 0),
        0
      )
      if (plan.status === 'COMPLETED') {
        stockFin = plan.ai_analysis.closing_stock.reduce(
          (s: number, r: { final: number }) => s + (Number(r.final) || 0),
          0
        )
      }
    } else if (plan.status === 'COMPLETED' && stockInicio > 0) {
      stockFin = stockInicio
    }

    const desvio =
      actualDays !== null && plannedDays !== null && plannedDays > 0
        ? actualDays - plannedDays
        : ''

    return [
      paddock?.name ?? plan.paddocks?.name ?? '',
      herdNames,
      areaHa,
      statusLabel,
      fmtDateLong(plan.entry_date),
      fmtDateLong(plan.exit_date),
      plannedDays !== null ? String(plannedDays) : '',
      fmtDateLong(effectiveEntry),
      fmtDateLong(plan.actual_exit_date),
      actualDays !== null ? String(actualDays) : '',
      stockInicio > 0 ? String(stockInicio) : '',
      stockFin !== '' ? String(stockFin) : '',
      plan.exit_dry_matter_kg_ha != null ? String(plan.exit_dry_matter_kg_ha) : '',
      desvio !== '' ? (Number(desvio) > 0 ? `+${desvio}` : String(desvio)) : '',
      plan.exit_notes ?? '',
    ]
  })

/**
 * Construye el string CSV completo con BOM y encabezados.
 * Listo para crear un Blob y descargar.
 */
export const buildCsvString = (rows: string[][], headers = [...CSV_HEADERS]): string => {
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`
  const headerLine = headers.map(escape).join(';')
  const dataLines = rows.map((row) => row.map(escape).join(';'))
  return '\uFEFF' + [headerLine, ...dataLines].join('\n')
}

/**
 * Dispara la descarga de un CSV en el browser.
 */
export const downloadCsv = (content: string, filename: string): void => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
