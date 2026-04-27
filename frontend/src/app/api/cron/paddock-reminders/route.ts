/**
 * GET /api/cron/paddock-reminders
 *
 * Cron job — llamado diariamente (ej. 08:00 AM hora local del campo).
 * Busca todos los planes con exit_date = mañana (status PLANNED o ACTIVE),
 * agrupa por organización y envía un único email resumen al owner.
 *
 * Programar en Vercel Cron / Cloud Scheduler:
 *   schedule: "0 11 * * *"  (UTC = 08:00 ART)
 *
 * Protegido con CRON_SECRET en el header Authorization.
 */
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { sendEmail } from '@/lib/email'

const CRON_SECRET  = process.env.CRON_SECRET
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.rodeoagtech.com'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  // ── Security: validate CRON_SECRET ──────────────────────────────────────
  const authHeader = req.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // ── Compute tomorrow's date ──────────────────────────────────────────────
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    // ── Fetch plans expiring tomorrow + related data ─────────────────────────
    const plans = await query<{
      plan_id: string
      paddock_name: string
      herd_name: string
      head_count: number
      exit_date: string
      planned_recovery_days: number
      org_id: string
      org_name: string
      owner_email: string
      owner_first_name: string
    }>(`
      SELECT
        gp.id            AS plan_id,
        p.name           AS paddock_name,
        h.name           AS herd_name,
        COALESCE(h.head_count, h.animal_count, 0) AS head_count,
        TO_CHAR(gp.exit_date, 'YYYY-MM-DD')       AS exit_date,
        COALESCE(gp.planned_recovery_days, 0)      AS planned_recovery_days,
        o.id             AS org_id,
        o.name           AS org_name,
        pr.email         AS owner_email,
        pr.first_name    AS owner_first_name
      FROM grazing_plans gp
      JOIN paddocks  p  ON p.id  = gp.paddock_id
      JOIN herds     h  ON h.id  = ANY(gp.herd_ids)
      JOIN organizations o ON o.id = gp.org_id
      JOIN profiles  pr ON pr.organization_id = o.id
                        AND pr.team_role IS NULL   -- owner only
      WHERE gp.exit_date = $1
        AND gp.status IN ('PLANNED', 'ACTIVE')
      ORDER BY o.id, gp.exit_date
    `, [tomorrowStr])

    if (!plans || plans.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No moves tomorrow' })
    }

    // ── Group by org ─────────────────────────────────────────────────────────
    const byOrg = new Map<string, typeof plans>()
    for (const row of plans) {
      if (!byOrg.has(row.org_id)) byOrg.set(row.org_id, [])
      byOrg.get(row.org_id)!.push(row)
    }

    const fmtDate = (iso: string) =>
      new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', {
        day: 'numeric', month: 'long', year: 'numeric',
      })

    let sent = 0
    const errors: string[] = []

    for (const [, rows] of byOrg) {
      const first = rows[0]
      if (!first.owner_email) continue

      try {
        await sendEmail('paddock_move_reminder', first.owner_email, {
          ownerName: first.owner_first_name || 'Productor',
          orgName: first.org_name,
          moves: rows.map(r => ({
            paddockName: r.paddock_name,
            herdName: r.herd_name,
            headCount: r.head_count,
            exitDate: fmtDate(r.exit_date),
            recoveryDays: r.planned_recovery_days,
          })),
          dashboardUrl: `${APP_BASE_URL}/dashboard/grazing`,
        })
        sent++
        console.log(`[paddock-reminders] ✓ sent to ${first.owner_email} (org ${first.org_id})`)
      } catch (err: any) {
        const msg = `org=${first.org_id} email=${first.owner_email}: ${err.message}`
        errors.push(msg)
        console.error('[paddock-reminders] ✗', msg)
      }
    }

    return NextResponse.json({
      sent,
      orgs: byOrg.size,
      plansFound: plans.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err: any) {
    console.error('[paddock-reminders] fatal error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
