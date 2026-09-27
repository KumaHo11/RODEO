/**
 * constants.ts — Constantes compartidas del módulo de pastoreo
 * ─────────────────────────────────────────────────────────────
 * FUENTE ÚNICA DE VERDAD para colores, mapas de estado, configuración
 * estacional y referencia de sequía regional.
 *
 * Reemplaza los 10 bloques de constantes duplicados que existían en:
 *  - app/dashboard/grazing/page.tsx (L48–238)
 *  - app/dashboard/grazing/InteractiveGantt.tsx (L40–231)
 *
 * Regla: Importar siempre desde '@/lib/grazing/constants'.
 */

// ── Tipos exportados ─────────────────────────────────────────────────────────

export interface PurpleLevel {
  bg: string
  border: string
  textColor: string
}

export interface StatusConfig {
  label: string
  color: string
  bg: string
}

export interface EventConfig {
  label: string
  emoji: string
  color: string
}

export interface SeasonInfo {
  name: string
  type: string
  icon: string
  color: string
}

export interface DroughtRef {
  refMm: number
  triggerMm: number
  regionName: string
}

// ── Colores de rodeos ────────────────────────────────────────────────────────

/** Escala de 10 colores para diferenciar rodeos en el Gantt */
export const HERD_COLORS: string[] = [
  '#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed',
  '#0891b2', '#be185d', '#65a30d', '#ea580c', '#4338ca',
]

// ── Niveles de púrpura para planificaciones sugeridas ────────────────────────

/**
 * 5 niveles de intensidad creciente para distinguir múltiples season plans.
 * Se ciclan cuando hay más de 5 planes simultáneos.
 */
export const PURPLE_LEVELS: PurpleLevel[] = [
  { bg: 'rgba(139,92,246,0.13)',  border: 'rgba(139,92,246,0.42)', textColor: '#6d28d9' },
  { bg: 'rgba(109,40,217,0.22)', border: 'rgba(109,40,217,0.58)', textColor: '#5b21b6' },
  { bg: 'rgba(91,33,182,0.32)',  border: 'rgba(91,33,182,0.70)',  textColor: '#4c1d95' },
  { bg: 'rgba(76,29,149,0.42)',  border: 'rgba(76,29,149,0.82)',  textColor: '#3730a3' },
  { bg: 'rgba(46,16,101,0.54)',  border: 'rgba(46,16,101,0.92)',  textColor: '#1e1b4b' },
]

// ── Mapa de estados del plan ─────────────────────────────────────────────────

/** Configuración visual por estado de bloque de pastoreo */
export const STATUS_MAP: Record<string, StatusConfig> = {
  ACTIVE:    { label: 'Pastando',    color: 'text-green-700', bg: 'bg-green-100' },
  PLANNED:   { label: 'Planificado', color: 'text-blue-700',  bg: 'bg-blue-100'  },
  COMPLETED: { label: 'Completado',  color: 'text-gray-600',  bg: 'bg-gray-100'  },
}

// ── Estación hemisferio sur ──────────────────────────────────────────────────

/**
 * Devuelve la estación del hemisferio sur para la fecha actual.
 * Meses 4–9 → Otoño/Invierno (temporada cerrada).
 * Meses 10–3 → Primavera/Verano (temporada abierta).
 */
export function getSeason(): SeasonInfo {
  const m = new Date().getMonth() + 1
  if (m >= 4 && m < 10) {
    return { name: 'Otoño/Invierno', type: 'Temporada cerrada', icon: '', color: 'bg-amber-100 text-gray-700' }
  }
  return { name: 'Primavera/Verano', type: 'Temporada abierta', icon: '🌱', color: 'bg-green-100 text-green-700' }
}

// ── Configuración de eventos de hacienda ────────────────────────────────────

/** Color y etiqueta por tipo de evento, para el Gantt y la Bitácora */
export const EVT_CONFIG: Record<string, EventConfig> = {
  servicio:              { label: 'Servicio',           emoji: '●', color: '#ef4444' },
  paricion:              { label: 'Parición',           emoji: '●', color: '#3b82f6' },
  destete:               { label: 'Destete',            emoji: '●', color: '#eab308' },
  diagnostico_prenez:    { label: 'Diagnóstico preñez', emoji: '●', color: '#f97316' },
  tratamiento_sanitario: { label: 'Sanitario',          emoji: '●', color: '#78350f' },
  esquila:               { label: 'Esquila',            emoji: '●', color: '#8b5cf6' },
  vacaciones:            { label: 'Vacaciones',         emoji: '●', color: '#ec4899' },
  compra:                { label: 'Compra',             emoji: '●', color: '#10b981' },
  venta:                 { label: 'Venta',              emoji: '●', color: '#ef4444' },
  mortandad:             { label: 'Mortandad',          emoji: '●', color: '#000000' },
  stock_inicial:         { label: 'Stock Inicial',      emoji: '●', color: '#6366f1' },
  ajuste_entrada:        { label: 'Ajuste (entrada)',   emoji: '●', color: '#0d9488' },
  ajuste_salida:         { label: 'Ajuste (salida)',    emoji: '●', color: '#0891b2' },
  ajuste:                { label: 'Ajuste de stock',   emoji: '●', color: '#0d9488' },
}

// ── Multiplicadores de crecimiento estacional ────────────────────────────────

/**
 * Multiplicadores de tasa de crecimiento de MS por mes (índice 0-based: 0=Enero).
 * Hemisferio Sur — Pampa Húmeda.
 * Usados en el motor de generación del ciclo sugerido.
 */
export const SEASONAL_MS_GROWTH: Record<number, number> = {
  5: 0.3, 6: 0.3, 7: 0.3,      // Jun–Ago: Invierno
  8: 1.5, 9: 1.5, 10: 1.5,     // Sep–Nov: Primavera
  11: 1.2, 0: 1.0, 1: 0.9,     // Dic–Feb: Verano (declinando)
  2: 0.7, 3: 0.5, 4: 0.4,      // Mar–May: Otoño
}

// ── Referencia de sequía regional ───────────────────────────────────────────

/**
 * Devuelve el promedio histórico de referencia y el umbral de trigger de sequía
 * según las coordenadas del establecimiento.
 * Basado en datos del SMN Argentina.
 */
export function REGION_DROUGHT_REF(lat: number, lng: number): DroughtRef {
  // NEA: Corrientes / Chaco
  if (lat > -31 && lat < -22 && lng > -65 && lng < -55) {
    return { refMm: 130, triggerMm: 80, regionName: 'NEA (Corrientes / Chaco)' }
  }
  // Semiárida: San Luis / Oeste de Córdoba
  if (lng < -64 && lat < -30 && lat > -38) {
    return { refMm: 50, triggerMm: 25, regionName: 'Región Semiárida' }
  }
  // Default: Pampa Húmeda
  return { refMm: 90, triggerMm: 50, regionName: 'Pampa Húmeda' }
}

// ── Colores de estado de simulación ─────────────────────────────────────────

/** Colores semánticos para el indicador de balance forrajero */
export const BALANCE_COLORS = {
  superavit: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', label: 'Superávit forrajero' },
  ajustado:  { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', label: 'Balance ajustado' },
  deficit:   { bg: 'bg-red-50',   border: 'border-red-200',   text: 'text-red-700',   label: 'Déficit forrajero' },
} as const

export type BalanceKey = keyof typeof BALANCE_COLORS

/**
 * Devuelve la clave del color de balance según el porcentaje de cobertura.
 * ≥ 110% → superávit, ≥ 80% → ajustado, < 80% → déficit.
 */
export function getBalanceKey(pct: number): BalanceKey {
  if (pct >= 110) return 'superavit'
  if (pct >= 80)  return 'ajustado'
  return 'deficit'
}
