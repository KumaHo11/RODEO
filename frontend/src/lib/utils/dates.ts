/**
 * lib/utils/dates.ts — Fuente de verdad única para manipulación de fechas
 * ─────────────────────────────────────────────────────────────────────────
 * Centraliza helpers de fechas que estaban duplicados en 5+ módulos.
 * Todos los módulos del proyecto deben importar desde aquí.
 *
 * Funciones canónicas:
 *  - safeIso:     Normaliza cualquier valor a 'YYYY-MM-DD' o ''
 *  - fmtDDMM:     Formatea ISO a 'DD/MM' (uso en Gantt y etiquetas)
 *  - fmtDate:     Formatea ISO a fecha localizada 'es-AR'
 *  - daysBetween: Días entre dos fechas ISO (positivo si b > a)
 *  - addDays:     Suma n días a una fecha ISO
 *  - todayISO:    Retorna la fecha actual como 'YYYY-MM-DD'
 */

/**
 * Normaliza cualquier valor a una fecha ISO 'YYYY-MM-DD'.
 * Maneja null, undefined, objetos Date y strings ISO completos.
 * @returns 'YYYY-MM-DD' o '' si el valor no es parseable
 */
export function safeIso(val: unknown): string {
  if (!val) return ''
  if (val instanceof Date) return val.toISOString().split('T')[0]
  const s = String(val)
  return s.includes('T') ? s.split('T')[0] : s
}

/**
 * Retorna la fecha de hoy en formato 'YYYY-MM-DD'.
 */
export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Formatea una fecha ISO a 'DD/MM' para uso en el Gantt y etiquetas compactas.
 * @returns 'DD/MM' o '—' si la fecha no es válida
 */
export function fmtDDMM(iso: unknown): string {
  const s = safeIso(iso)
  if (!s) return '—'
  const d = new Date(s + 'T00:00:00')
  if (isNaN(d.getTime())) return '—'
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Formatea una fecha ISO a una representación legible en español argentino.
 * @param iso  Fecha ISO string, null o undefined
 * @param opts Opciones de Intl.DateTimeFormat (default: día y mes corto)
 * @returns String localizado o '—'
 */
export function fmtDate(
  iso: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' },
): string {
  const s = safeIso(iso)
  if (!s) return '—'
  const d = new Date(s + 'T00:00:00')
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-AR', opts)
}

/**
 * Calcula el número de días entre dos fechas ISO.
 * Resultado positivo si b es posterior a a.
 * @returns Días enteros; 0 si alguna fecha es inválida
 */
export function daysBetween(a: unknown, b: unknown): number {
  const sa = safeIso(a)
  const sb = safeIso(b)
  if (!sa || !sb) return 0
  const da = new Date(sa + 'T00:00:00')
  const db = new Date(sb + 'T00:00:00')
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return 0
  return Math.round((db.getTime() - da.getTime()) / 86_400_000)
}

/**
 * Suma n días a una fecha ISO y retorna el resultado como 'YYYY-MM-DD'.
 * Si la fecha base es inválida, retorna la fecha de hoy.
 */
export function addDays(iso: unknown, n: number): string {
  const s = safeIso(iso)
  if (!s) return todayISO()
  const d = new Date(s + 'T00:00:00')
  if (isNaN(d.getTime())) return todayISO()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}
