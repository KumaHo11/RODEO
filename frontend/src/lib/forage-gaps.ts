/**
 * lib/forage-gaps.ts
 * Core algorithm: detect real forage planning gaps in a given time window.
 *
 * PHILOSOPHY:
 *   A "gap" is only real when the herd has NO paddock assigned for an
 *   extended period — longer than a normal rotational transition (1-3 days).
 *
 *   The `planned_recovery_days` field is the PADDOCK REST PERIOD, NOT the
 *   grazing duration. It must NOT be used to compute coverage here.
 *
 *   Normal transitions (≤ MIN_GAP_DAYS) between consecutive plan blocks
 *   are NOT gaps — they are expected scheduling margins.
 */

/** Minimum consecutive unplanned days before flagging as a real gap. */
const MIN_GAP_DAYS = 4

export interface ForageGap {
  start_date: string       // ISO
  end_date: string         // ISO — inclusive
  deficit_days: number
  severity: 'medium' | 'critical'  // 4–7d / >7d
  affected_ev: number
  deficit_kg_ms: number    // estimated MS deficit (kg)
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00')
  const db = new Date(b + 'T00:00:00')
  return Math.round((db.getTime() - da.getTime()) / 86400000)
}

// ── Main export ───────────────────────────────────────────────────────────────
export function detectForageGaps(
  plans: Array<{ entry_date: string; exit_date?: string | null }>,
  totalEv: number,
  horizonDays = 90,
  windowStart?: string,
): ForageGap[] {
  const dailyDemandKg = totalEv * 11  // 11 kg MS/EV/día standard Arg
  const today = windowStart ?? new Date().toISOString().split('T')[0]
  const gaps: ForageGap[] = []

  // Only consider plans that have an explicit exit_date (committed plans).
  // Plans without exit_date are drafts or future suggestions — exclude them
  // from gap analysis to avoid false positives from incomplete planning.
  const activePlans = plans.filter(p =>
    p.entry_date && p.exit_date && p.exit_date > p.entry_date
  )

  if (activePlans.length === 0) return gaps

  let d = 0
  while (d < horizonDays) {
    const dateStr = addDays(today, d)

    // Is any committed plan covering this exact day?
    const covered = activePlans.some(p =>
      p.entry_date! <= dateStr && p.exit_date! > dateStr
    )

    if (!covered) {
      // Scan forward to measure the full uncovered stretch
      const gapStartDay = d
      while (d < horizonDays) {
        const next = addDays(today, d + 1)
        const nextCovered = activePlans.some(p =>
          p.entry_date! <= next && p.exit_date! > next
        )
        if (nextCovered) break
        d++
      }

      const gapEndDay    = d
      const start_date   = addDays(today, gapStartDay)
      const end_date     = addDays(today, gapEndDay)
      const deficit_days = daysBetween(start_date, end_date) + 1

      // Only report:
      // 1. Gaps in the future (not already passed)
      // 2. Gaps longer than the normal rotational transition margin
      if (start_date >= today && deficit_days >= MIN_GAP_DAYS) {
        gaps.push({
          start_date,
          end_date,
          deficit_days,
          // 4-7d = medium concern, >7d = critical (herd genuinely without paddock)
          severity: deficit_days < 8 ? 'medium' : 'critical',
          affected_ev: totalEv,
          deficit_kg_ms: dailyDemandKg * deficit_days,
        })
      }
    }
    d++
  }

  return gaps
}

/** Convert a gap to pixel x-coordinates within the Gantt timeline */
export function gapToGanttCoords(
  gap: ForageGap,
  windowStart: string,
  windowDays: number,
  containerWidth: number,
  labelWidth: number,
): { x: number; width: number } | null {
  const timelineW = containerWidth - labelWidth

  const startDay = daysBetween(windowStart, gap.start_date)
  const endDay   = daysBetween(windowStart, gap.end_date) + 1 // exclusive px

  // Clip to visible window
  const clampedStart = Math.max(0, startDay)
  const clampedEnd   = Math.min(windowDays, endDay)

  if (clampedStart >= clampedEnd) return null

  const ppd = timelineW / windowDays
  return {
    x: labelWidth + clampedStart * ppd,
    width: (clampedEnd - clampedStart) * ppd,
  }
}


