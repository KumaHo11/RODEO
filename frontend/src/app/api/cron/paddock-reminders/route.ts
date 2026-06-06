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
    // ── Compute target dates ─────────────────────────────────────────────────
    const today = new Date()
    const fmtIso = (d: Date) => d.toISOString().split('T')[0]

    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
    const threeDaysAgo = new Date(today); threeDaysAgo.setDate(today.getDate() - 3)

    const tomorrowStr = fmtIso(tomorrow)
    const yesterdayStr = fmtIso(yesterday)
    const threeDaysAgoStr = fmtIso(threeDaysAgo)

    // ── Fetch plans for tomorrow, yesterday and 3 days ago ───────────────────
    const plans = await query<{
      plan_id: string
      paddock_name: string
      herd_name: string
      head_count: number
      exit_date: string
      planned_recovery_days: number
      org_id: string
      org_name: string
      owner_profile_id: string
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
        pr.id            AS owner_profile_id,
        pr.email         AS owner_email,
        pr.first_name    AS owner_first_name
      FROM grazing_plans gp
      JOIN paddocks  p  ON p.id  = gp.paddock_id
      JOIN herds     h  ON h.id  = ANY(gp.herd_ids)
      JOIN organizations o ON o.id = gp.org_id
      JOIN profiles  pr ON pr.organization_id = o.id
                        AND pr.team_role IS NULL   -- owner only
      WHERE gp.exit_date IN ($1, $2, $3)
        AND gp.status IN ('PLANNED', 'ACTIVE')
      ORDER BY o.id, gp.exit_date
    `, [tomorrowStr, yesterdayStr, threeDaysAgoStr])

    const fmtDate = (iso: string) =>
      new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    
    const fmtDateShort = (iso: string) =>
      new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', {
        day: 'numeric', month: 'long',
      })

    // ── Insert In-App Notifications ──────────────────────────────────────────
    if (plans && plans.length > 0) {
      for (const plan of plans) {
        let title = ''
        let body = ''
        
        if (plan.exit_date === tomorrowStr) {
          title = `Mañana hay que mover los animales del potrero ${plan.paddock_name}`
          body = `Revisá el planificador y prepará el potrero receptor.`
        } else if (plan.exit_date === yesterdayStr) {
          title = `Retraso: Los animales debieron salir ayer de ${plan.paddock_name}`
          body = `¿Moviste los animales? No olvides aplicar los cambios en el planificador.`
        } else if (plan.exit_date === threeDaysAgoStr) {
          title = `Alerta: hace tres días debieron salir de ${plan.paddock_name}`
          body = `¿Moviste los animales? No olvides aplicar los cambios en el planificador.`
        }

        // We use mutate directly to insert into notifications table
        import('@/lib/db').then(({ mutate }) => {
          mutate(`
            INSERT INTO notifications (org_id, profile_id, user_id, type, title, message, body, data)
            VALUES ($1, $2, $2, 'ALERTA', $3, $4, $4, $5::jsonb)
          `, [
            plan.org_id,
            plan.owner_profile_id,
            title,
            body,
            JSON.stringify({ link: `/dashboard/grazing` })
          ]).catch(e => console.error('Failed to insert notification', e))
        })
      }
    }

    // ── Group tomorrow's plans by org for Emails ─────────────────────────────
    const plansForEmail = plans ? plans.filter(p => p.exit_date === tomorrowStr) : []
    const byOrgTomorrow = new Map<string, typeof plansForEmail>()
    for (const row of plansForEmail) {
      if (!byOrgTomorrow.has(row.org_id)) byOrgTomorrow.set(row.org_id, [])
      byOrgTomorrow.get(row.org_id)!.push(row)
    }

    // ── Group overdue plans by org for Emails ────────────────────────────────
    const overduePlansEmail = plans ? plans.filter(p => p.exit_date === yesterdayStr || p.exit_date === threeDaysAgoStr) : []
    const byOrgOverdue = new Map<string, typeof overduePlansEmail>()
    for (const row of overduePlansEmail) {
      if (!byOrgOverdue.has(row.org_id)) byOrgOverdue.set(row.org_id, [])
      byOrgOverdue.get(row.org_id)!.push(row)
    }

    let sent = 0
    const errors: string[] = []

    // 1. Send Tomorrow's Reminders
    for (const [, rows] of byOrgTomorrow) {
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
        console.log(`[paddock-reminders] ✓ sent tomorrow reminder to ${first.owner_email} (org ${first.org_id})`)
      } catch (err: any) {
        const msg = `tomorrow-reminder org=${first.org_id} email=${first.owner_email}: ${err.message}`
        errors.push(msg)
        console.error('[paddock-reminders] ✗', msg)
      }
    }

    // 2. Send Overdue Reminders
    for (const [, rows] of byOrgOverdue) {
      const first = rows[0]
      if (!first.owner_email) continue

      try {
        await sendEmail('paddock_overdue_reminder', first.owner_email, {
          ownerName: first.owner_first_name || 'Productor',
          orgName: first.org_name,
          moves: rows.map(r => ({
            paddockName: r.paddock_name,
            herdName: r.herd_name,
            headCount: r.head_count,
            exitDate: fmtDate(r.exit_date)
          })),
          dashboardUrl: `${APP_BASE_URL}/dashboard/grazing`,
        })
        sent++
        console.log(`[paddock-reminders] ✓ sent overdue reminder to ${first.owner_email} (org ${first.org_id})`)
      } catch (err: any) {
        const msg = `overdue-reminder org=${first.org_id} email=${first.owner_email}: ${err.message}`
        errors.push(msg)
        console.error('[paddock-reminders] ✗', msg)
      }
    }

    // ── Agenda events starting tomorrow ──────────────────────────────────────
    const events = await query<{
      id: string
      title: string
      org_id: string
      owner_profile_id: string
    }>(`
      SELECT e.id, e.title, e.org_id, pr.id AS owner_profile_id
      FROM agenda_events e
      JOIN profiles pr ON pr.organization_id = e.org_id AND pr.team_role IS NULL
      WHERE e.event_date = $1
    `, [tomorrowStr]).catch(() => [])

    if (events && events.length > 0) {
      for (const ev of events) {
        import('@/lib/db').then(({ mutate }) => {
          mutate(`
            INSERT INTO notifications (org_id, profile_id, user_id, type, title, message, body, data)
            VALUES ($1, $2, $2, 'EVENTO', $3, $4, $4, $5::jsonb)
          `, [
            ev.org_id,
            ev.owner_profile_id,
            `Tenés un evento que inicia mañana: ${ev.title}`,
            `Acordate de revisar tu agenda.`,
            JSON.stringify({ link: `/dashboard/agenda` })
          ]).catch(e => console.error('Failed to insert event notification', e))
        })
      }
    }

    return NextResponse.json({
      sent,
      orgs: byOrgTomorrow.size + byOrgOverdue.size,
      plansFound: plans?.length || 0,
      eventsFound: events?.length || 0,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err: any) {
    console.error('[paddock-reminders] fatal error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
