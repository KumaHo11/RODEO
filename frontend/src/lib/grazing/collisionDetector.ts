/**
 * lib/grazing/collisionDetector.ts — Detección de colisiones espacio-temporales
 * ──────────────────────────────────────────────────────────────────────────────
 * Detecta cuando dos planes pretenden ocupar el mismo potrero en fechas
 * solapadas. Retorna un array de conflictos para mostrar warnings en el UI.
 *
 * No bloquea: el usuario puede hacer override manual.
 */

export interface CollisionEntry {
  paddockId: string
  entryDate: string
  exitDate: string
}

export interface ExistingBlock {
  id: string
  paddock_id: string
  entry_date: string
  exit_date: string
  season_plan_id?: string
  herd_id?: string
  herd_ids?: string[]
  status?: string
}

export interface PaddockCollision {
  paddockId: string
  paddockName: string
  newEntry: string
  newExit: string
  existingEntry: string
  existingExit: string
  existingHerdIds: string[]
  overlapDays: number
}

/**
 * Calcula el número de días de solapamiento entre dos rangos [a1,a2] y [b1,b2].
 */
function overlapDays(a1: string, a2: string, b1: string, b2: string): number {
  const start = a1 > b1 ? a1 : b1
  const end = a2 < b2 ? a2 : b2
  if (start >= end) return 0
  const ms = new Date(end).getTime() - new Date(start).getTime()
  return Math.max(0, Math.ceil(ms / 86400000))
}

/**
 * Normaliza un id de potrero a string para que la comparación sea type-safe.
 * PostgreSQL devuelve integers; el store maneja strings.
 * Sin esta normalización, `"123" !== 123` siempre es true y el guard
 * `if (paddockId !== block.paddock_id) continue` nunca se ejecuta,
 * reportando colisiones en TODOS los potreros.
 */
function normId(id: string | number | undefined | null): string {
  return String(id ?? '')
}

/**
 * Detecta colisiones entre un conjunto de nuevas entradas y los planes existentes.
 *
 * @param newEntries   — Bloques que se quieren crear
 * @param existing     — Bloques ya persistidos en la DB
 * @param paddockNames — Mapa id→nombre para el mensaje
 * @param excludeSeasonPlanId — Excluir bloques del mismo plan (para re-generación)
 */
export function detectPaddockCollisions(
  newEntries: CollisionEntry[],
  existing: ExistingBlock[],
  paddockNames: Record<string, string> = {},
  excludeSeasonPlanId?: string,
): PaddockCollision[] {
  const collisions: PaddockCollision[] = []

  const today = new Date().toISOString().split('T')[0]

  // Solo considerar planes que PUEDEN solapar físicamente:
  // - Status activo (no COMPLETED, REAL, HISTORY, CANCELLED)
  // - exit_date en el futuro (planes pasados ya no pueden solapar)
  // - Excluir el mismo season_plan (re-generación)
  const activeExisting = existing.filter(
    b =>
      b.status !== 'CANCELLED' &&
      b.status !== 'HISTORY' &&
      b.status !== 'COMPLETED' &&
      b.status !== 'REAL' &&
      b.entry_date &&
      b.exit_date &&
      b.exit_date > today &&
      (excludeSeasonPlanId ? b.season_plan_id !== excludeSeasonPlanId : true),
  )

  // Conjunto de colisiones ya vistas para evitar duplicados
  // Clave: "paddockId|newEntry|newExit|existingEntry|existingExit"
  const seen = new Set<string>()

  for (const entry of newEntries) {
    // ─── FIX: normalizar a String() antes de comparar.
    // La API de PostgreSQL retorna paddock_id como integer; si entry.paddockId
    // es string y block.paddock_id es number, la comparación estricta `!==`
    // siempre resulta true → el guard `continue` nunca se ejecuta →
    // TODOS los bloques de TODOS los potreros se detectan como colisión.
    const normEntry = normId(entry.paddockId)

    for (const block of activeExisting) {
      // REGLA DE NEGOCIO: solo hay colisión si es el MISMO potrero.
      if (normEntry !== normId(block.paddock_id)) continue

      const days = overlapDays(
        entry.entryDate,
        entry.exitDate,
        block.entry_date,
        block.exit_date,
      )

      if (days > 0) {
        // Deduplicar: el mismo par (entrada nueva + bloque existente) puede
        // aparecer varias veces si hay múltiples newEntries para el mismo potrero.
        const key = `${normEntry}|${entry.entryDate}|${entry.exitDate}|${block.entry_date}|${block.exit_date}`
        if (seen.has(key)) continue
        seen.add(key)

        collisions.push({
          paddockId: entry.paddockId,
          paddockName: paddockNames[entry.paddockId] ?? paddockNames[normEntry] ?? entry.paddockId,
          newEntry: entry.entryDate,
          newExit: entry.exitDate,
          existingEntry: block.entry_date,
          existingExit: block.exit_date,
          existingHerdIds: block.herd_ids ?? (block.herd_id ? [block.herd_id] : []),
          overlapDays: days,
        })
      }
    }
  }

  return collisions
}

/**
 * Formatea una lista de colisiones en un mensaje legible para el usuario.
 */
export function formatCollisionWarning(
  collisions: PaddockCollision[],
  herdNames: Record<string, string> = {},
): string {
  if (collisions.length === 0) return ''

  const lines = collisions.slice(0, 5).map(c => {
    const herdLabel = c.existingHerdIds
      .map(id => herdNames[id] || 'Rodeo')
      .join(', ')
    return `• ${c.paddockName}: ${c.overlapDays}d de solapamiento con ${herdLabel} (${c.existingEntry} → ${c.existingExit})`
  })

  const extra = collisions.length > 5 ? `\n… y ${collisions.length - 5} conflictos más` : ''

  return `⚠️ Se detectaron ${collisions.length} solapamiento(s) de potreros:\n\n${lines.join('\n')}${extra}\n\n¿Deseas continuar de todas formas?`
}
