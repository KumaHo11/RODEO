/**
 * useBatchAlerts.ts — Alertas de pastoreo vencido consolidadas
 * ─────────────────────────────────────────────────────────────
 * Arquitectura:
 *  - useMemo con deps precisas: solo recalcula cuando cambia `plans` o `paddocks`
 *  - Devuelve datos estables (no arrays inline) para que React.memo funcione
 *  - NO tiene estado interno de checkboxes (eso queda en el componente hijo)
 *
 * Categorías:
 *  - overdue: exit_date < hoy (animales deben salir)
 *  - today:   exit_date === hoy
 *  - tomorrow: exit_date === mañana
 */
import { useMemo } from 'react'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface OverduePlan {
  id: string
  paddock_id: string
  paddockName: string
  exit_date: string
  entry_date: string
  actual_entry_date?: string | null
  herd_ids: string[]
  /** Días vencidos (negativo = overdue, 0 = hoy, 1 = mañana) */
  daysRemaining: number
  urgency: 'overdue' | 'today' | 'tomorrow'
}

export interface BatchAlertsResult {
  /** Todos los planes urgentes (overdue + today + tomorrow) */
  urgentPlans: OverduePlan[]
  /** Solo los vencidos (para el badge de count crítico) */
  overdueCount: number
  /** Hay al menos 1 urgente */
  hasAlerts: boolean
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useBatchAlerts(
  plans: Array<{
    id: string
    paddock_id: string
    exit_date?: string | null
    entry_date?: string | null
    actual_entry_date?: string | null
    herd_ids?: string[] | null
    status?: string | null
  }>,
  paddocks: Array<{ id: string; name: string }>
): BatchAlertsResult {
  return useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayMs = today.getTime()

    // Índice de potreros para lookup O(1)
    const paddockIndex = new Map(paddocks.map(p => [p.id, p.name]))

    const urgentPlans: OverduePlan[] = []

    for (const p of plans) {
      // Filtros rápidos antes de parsear fechas
      if (p.status === 'COMPLETED') continue
      if (!p.exit_date) continue

      const exitMs = new Date(p.exit_date + 'T00:00:00').getTime()
      const daysRemaining = Math.ceil((exitMs - todayMs) / 86400000)

      // Solo los planes con daysRemaining <= 1 (vencidos, hoy o mañana)
      if (daysRemaining > 1) continue

      let urgency: OverduePlan['urgency']
      if (daysRemaining < 0)      urgency = 'overdue'
      else if (daysRemaining === 0) urgency = 'today'
      else                          urgency = 'tomorrow'

      urgentPlans.push({
        id:                 p.id,
        paddock_id:         p.paddock_id,
        paddockName:        paddockIndex.get(p.paddock_id) ?? p.paddock_id,
        exit_date:          p.exit_date,
        entry_date:         p.entry_date ?? p.exit_date,
        actual_entry_date:  p.actual_entry_date ?? null,
        herd_ids:           p.herd_ids ?? [],
        daysRemaining,
        urgency,
      })
    }

    // Ordenar: más vencidos primero, luego hoy, luego mañana
    urgentPlans.sort((a, b) => a.daysRemaining - b.daysRemaining)

    const overdueCount = urgentPlans.filter(p => p.urgency === 'overdue').length

    return {
      urgentPlans,
      overdueCount,
      hasAlerts: urgentPlans.length > 0,
    }
  }, [plans, paddocks])
}
