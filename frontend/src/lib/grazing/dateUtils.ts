/**
 * dateUtils.ts — Utilidades de fecha para el módulo de pastoreo
 * ─────────────────────────────────────────────────────────────
 * FUENTE ÚNICA DE VERDAD para manipulación de fechas ISO en el Gantt
 * y la Mesa de Arena.
 *
 * Reemplaza las 4 funciones duplicadas que existían en paralelo en:
 *  - app/dashboard/grazing/page.tsx (L77–112)
 *  - app/dashboard/grazing/InteractiveGantt.tsx (L69–104)
 *
 * Regla: Nunca importar estas funciones desde los archivos anteriores.
 * Siempre importar desde '@/lib/grazing/dateUtils'.
 */

/**
 * Normaliza cualquier valor de fecha a string ISO 'YYYY-MM-DD'.
 * Maneja null, undefined, instancias Date, strings con T (ISO 8601) y strings simples.
 */
export function safeIso(val: unknown): string {
  if (!val) return ''
  if (val instanceof Date) return val.toISOString().split('T')[0]
  const s = String(val)
  return s.includes('T') ? s.split('T')[0] : s
}

/**
 * Formatea una fecha ISO como 'dd/MM'.
 * Devuelve '—' si la fecha es inválida o está vacía.
 */
export function fmt(iso: unknown): string {
  const s = safeIso(iso)
  if (!s) return '—'
  const d = new Date(s + 'T00:00:00')
  if (isNaN(d.getTime())) return '—'
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Formatea una fecha ISO como 'dd/MM/YYYY'.
 */
export function fmtFull(iso: unknown): string {
  const s = safeIso(iso)
  if (!s) return '—'
  const d = new Date(s + 'T00:00:00')
  if (isNaN(d.getTime())) return '—'
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

/**
 * Calcula los días entre dos fechas ISO (b - a).
 * Devuelve 0 si cualquiera de las fechas es inválida.
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
 * Suma n días a una fecha ISO y devuelve el resultado como 'YYYY-MM-DD'.
 * Si la fecha de entrada es inválida, retorna la fecha de hoy.
 */
export function addDays(iso: unknown, n: number): string {
  const s = safeIso(iso)
  if (!s) return new Date().toISOString().split('T')[0]
  const d = new Date(s + 'T00:00:00')
  if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0]
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

/**
 * Devuelve la fecha de hoy en formato 'YYYY-MM-DD'.
 */
export function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}
