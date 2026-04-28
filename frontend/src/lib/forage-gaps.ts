/**
 * lib/forage-gaps.ts
 * Core algorithm: detect forage planning gaps in a given time window.
 * A "gap" = days where NO grazing plan covers ANY paddock simultaneously.
 */

export interface ForageGap {
  start_date: string       // ISO
  end_date: string         // ISO — inclusive
  deficit_days: number
  severity: 'low' | 'medium' | 'critical'  // <3d / 3–7d / >7d
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
  plans: Array<{ entry_date: string; exit_date?: string | null; planned_recovery_days?: number }>,
  totalEv: number,
  horizonDays = 90,
  windowStart?: string,
): ForageGap[] {
  const dailyDemandKg = totalEv * 11  // 11 kg MS/EV/día standard Arg

  const today = windowStart ?? new Date().toISOString().split('T')[0]
  const gaps: ForageGap[] = []

  let d = 0
  while (d < horizonDays) {
    const dateStr = addDays(today, d)

    // Is any plan active on this day?
    const covered = plans.some(p => {
      const entry = p.entry_date ?? ''
      const exit  = p.exit_date ?? addDays(entry, p.planned_recovery_days ?? 14)
      return entry <= dateStr && exit > dateStr
    })

    if (!covered) {
      // Found gap start — scan forward
      const gapStartDay = d
      while (d < horizonDays) {
        const next = addDays(today, d + 1)
        const nextCovered = plans.some(p => {
          const entry = p.entry_date ?? ''
          const exit  = p.exit_date ?? addDays(entry, p.planned_recovery_days ?? 14)
          return entry <= next && exit > next
        })
        if (nextCovered) break
        d++
      }
      const gapEndDay   = d
      const start_date  = addDays(today, gapStartDay)
      const end_date    = addDays(today, gapEndDay)
      const deficit_days = daysBetween(start_date, end_date) + 1

      // Only report gaps that start in the future or today
      if (start_date >= today) {
        gaps.push({
          start_date,
          end_date,
          deficit_days,
          severity: deficit_days < 3 ? 'low' : deficit_days < 7 ? 'medium' : 'critical',
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
