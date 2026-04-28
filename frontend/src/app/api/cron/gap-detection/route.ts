/**
 * api/cron/gap-detection/route.ts
 * Diario 06:00 — detecta brechas de forraje en los próximos 30 días
 * y crea notificaciones críticas para cada organización.
 *
 * Configurar en vercel.json:
 *   { "path": "/api/cron/gap-detection", "schedule": "0 9 * * *" }
 */

import { NextRequest, NextResponse } from 'next/server'
import { detectForageGaps } from '@/lib/forage-gaps'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 1. Get all active orgs with the planificador feature
    const orgsRes = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/admin/orgs-with-plans`, {
      headers: { 'x-cron-secret': process.env.CRON_SECRET! }
    })
    if (!orgsRes.ok) throw new Error('Failed to fetch orgs')
    const { orgs } = await orgsRes.json()

    let totalAlerts = 0

    for (const org of orgs) {
      try {
        // 2. Fetch plans and herds for this org
        const [plansRes, herdsRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/grazing-plans?org_id=${org.id}`, {
            headers: { 'x-cron-secret': process.env.CRON_SECRET! }
          }),
          fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/herds?org_id=${org.id}`, {
            headers: { 'x-cron-secret': process.env.CRON_SECRET! }
          }),
        ])

        if (!plansRes.ok || !herdsRes.ok) continue

        const { plans }  = await plansRes.json()
        const { herds }  = await herdsRes.json()

        const totalEv = herds.reduce((s: number, h: any) => s + Number(h.total_ev || 0), 0)
        if (totalEv === 0 || !plans?.length) continue

        // 3. Detect gaps in next 30 days
        const gaps = detectForageGaps(plans, totalEv, 30)

        // 4. Create notifications for all gaps (all are now medium or critical)
        for (const gap of gaps) {

          const title = gap.severity === 'critical'
            ? `⚠ Déficit crítico de forraje — ${gap.deficit_days} días`
            : `Alerta de planificación — ${gap.deficit_days} días sin potrero`

          const body = `Sin potrero asignado del ${
            new Date(gap.start_date + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'long' })
          } al ${
            new Date(gap.end_date + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'long' })
          }. Déficit estimado: ${gap.deficit_kg_ms.toLocaleString('es')} kg MS.`

          await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/notifications`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-cron-secret': process.env.CRON_SECRET!,
            },
            body: JSON.stringify({
              org_id: org.id,
              type: gap.severity === 'critical' ? 'ALERTA' : 'ADVERTENCIA',
              title,
              body,
              metadata: {
                gap_start: gap.start_date,
                gap_end: gap.end_date,
                deficit_days: gap.deficit_days,
                deficit_kg_ms: gap.deficit_kg_ms,
                severity: gap.severity,
                source: 'gap-detection-cron',
              },
            }),
          })

          totalAlerts++
        }
      } catch (orgErr) {
        console.warn(`[gap-detection] Error en org ${org.id}:`, orgErr)
      }
    }

    return NextResponse.json({
      ok: true,
      orgs_processed: orgs.length,
      alerts_created: totalAlerts,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[gap-detection cron] Fatal error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
