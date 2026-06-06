/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  RODEO — Climate Alert Dispatcher
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Despachador de alertas climáticas. Se acopla al sistema de notificaciones
 *  existente (tabla notifications) y al sistema de email (Resend).
 *
 *  Estrategia de deduplicación:
 *    - No se repite la misma alerta para el mismo potrero en < 6 horas
 *    - Las alertas 'critical' siempre se envían (sin cooldown)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { queryOne, mutate, query } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import type { AlertLevel } from '@/lib/climate-adjustment'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface ClimateAlertPayload {
  orgId:        string
  profileId:    string
  paddockId:    string
  paddockName:  string
  alertLevel:   AlertLevel
  alertMessage: string
  adjustedDays: number
  originalDays: number
  deltaFromPlan: number
}

// ─── Cooldown: evitar spam de notificaciones ─────────────────────────────────

const COOLDOWN_HOURS: Record<AlertLevel, number> = {
  ok:       99,   // no enviar notificaciones "ok"
  warning:  6,
  critical: 0,    // siempre enviar
}

async function wasRecentlyAlerted(paddockId: string, level: AlertLevel): Promise<boolean> {
  if (level === 'critical') return false // siempre enviar críticos

  const cooldownH = COOLDOWN_HOURS[level]
  const row = await queryOne<{ count: string }>(`
    SELECT COUNT(*) AS count
    FROM notifications
    WHERE
      (data->>'paddock_id' = $1 OR body LIKE $2)
      AND type = $3
      AND created_at >= NOW() - INTERVAL '${cooldownH} hours'
  `, [paddockId, `%${paddockId}%`, `climate_${level}`]).catch(() => null)

  return parseInt(row?.count ?? '0') > 0
}

// ─── Dispatcher principal ────────────────────────────────────────────────────

/**
 * dispatchClimateAlert
 *
 * 1. Inserta notificación in-app en la tabla notifications
 * 2. Envía email al owner de la organización
 * 3. Registra en audit log
 */
export async function dispatchClimateAlert(payload: ClimateAlertPayload): Promise<void> {
  const {
    orgId, profileId, paddockId, paddockName,
    alertLevel, alertMessage, adjustedDays, originalDays, deltaFromPlan,
  } = payload

  // Solo despachar en warning/critical
  if (alertLevel === 'ok') return

  // === NOTIFICACIONES PAUSADAS POR REQUERIMIENTO ===
  // Ya no enviamos notificaciones in-app ni por email sobre el ajuste climático.
  // El motor de Ajuste Clima seguirá corriendo para actualizar el UI pero sin notificar.
  const CLIMATE_NOTIFICATIONS_ENABLED = false;
  if (!CLIMATE_NOTIFICATIONS_ENABLED) return;

  // Deduplicación: no repetir en cooldown
  const alreadyNotified = await wasRecentlyAlerted(paddockId, alertLevel)
  if (alreadyNotified) {
    console.log(`[climateAlert] Skipped (cooldown) — paddock=${paddockId} level=${alertLevel}`)
    return
  }

  const titleMap: Record<AlertLevel, string> = {
    ok:       '',
    warning:  `Ajuste climático: revisá ${paddockName}`,
    critical: `Ajuste sugerido: ${paddockName}`,
  }

  const notificationTitle = titleMap[alertLevel]

  // ── 1. In-app notification ────────────────────────────────────────────────
  try {
    await mutate(`
      INSERT INTO notifications (
        profile_id, user_id, org_id, type, title, body, message, is_read, data
      ) VALUES (
        $1, $1, $2, $3, $4, $5, $5, false,
        $6::jsonb
      )
    `, [
      profileId,
      orgId,
      `climate_${alertLevel}`,
      notificationTitle,
      alertMessage,
      JSON.stringify({
        paddock_id:     paddockId,
        paddock_name:   paddockName,
        alert_level:    alertLevel,
        adjusted_days:  adjustedDays,
        original_days:  originalDays,
        delta:          deltaFromPlan,
        source:         'climate_adjustment',
        link:           `/dashboard/clima`,
      }),
    ])
    console.log(`[climateAlert] ✓ in-app notification sent — ${paddockName} (${alertLevel})`)
  } catch (err) {
    console.error('[climateAlert] in-app notification failed:', err)
  }

  // ── 2. Email al owner de la organización ─────────────────────────────────
  try {
    const owner = await queryOne<{
      email: string
      first_name: string | null
    }>(`
      SELECT email, first_name
      FROM profiles
      WHERE organization_id = $1
        AND (team_role IS NULL OR team_role = 'owner')
      LIMIT 1
    `, [orgId])

    if (owner && owner.email) {
      await sendEmail('climate_alert', owner.email, {
        ownerName:    owner.first_name || 'Productor',
        paddockName,
        alertLevel:   alertLevel as 'warning' | 'critical',
        alertMessage,
        adjustedDays,
        originalDays,
        deltaFromPlan,
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.rodeoagtech.com'}/dashboard/paddocks-list?paddock=${paddockId}`,
      })
      console.log(`[climateAlert] ✓ email sent to ${owner.email}`)
    }
  } catch (err) {
    console.error('[climateAlert] email dispatch failed:', err)
    // Non-fatal
  }
}

// ─── Batch dispatcher: para el cron job ──────────────────────────────────────

export interface BatchClimateAlertResult {
  orgId:     string
  paddockId: string
  paddockName: string
  alertLevel: AlertLevel
  sent: boolean
}

/**
 * dispatchBatchClimateAlerts
 *
 * Llamado por el cron job. Procesa múltiples potreros de múltiples orgs.
 * Agrupa alertas del mismo owner en un único email resumen.
 */
export async function dispatchBatchClimateAlerts(
  alerts: ClimateAlertPayload[]
): Promise<BatchClimateAlertResult[]> {
  const results: BatchClimateAlertResult[] = []

  // Procesar alertas críticas primero
  const sorted = [...alerts].sort((a, b) => {
    const priority = { critical: 0, warning: 1, ok: 2 }
    return (priority[a.alertLevel] ?? 2) - (priority[b.alertLevel] ?? 2)
  })

  for (const alert of sorted) {
    try {
      await dispatchClimateAlert(alert)
      results.push({ ...alert, sent: true })
    } catch (err) {
      console.error('[batchClimateAlerts] error for paddock', alert.paddockId, err)
      results.push({ ...alert, sent: false })
    }
  }

  return results
}
