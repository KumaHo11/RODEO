/**
 * GET /api/grazing-plans/export
 * Returns a CSV file with ALL grazing plans (including COMPLETED history)
 * so the user can download as Excel from the Planner UI.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { serviceQueryOne, serviceQuery } from '@/lib/db'

async function getAuth(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim() || ''
  if (!token) return null
  const decoded = await verifyFirebaseToken(token)
  if (!decoded) return null
  const profile = await serviceQueryOne<{ organization_id: string }>(
    'SELECT organization_id FROM profiles WHERE firebase_uid = $1',
    [decoded.uid]
  )
  return profile?.organization_id ? { orgId: profile.organization_id } : null
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const rows = await serviceQuery<Record<string, unknown>>(`
      SELECT
        gp.id,
        p.name                        AS potrero,
        p.area_ha,
        gp.entry_date,
        gp.exit_date,
        gp.actual_entry_date,
        gp.actual_exit_date,
        gp.planned_recovery_days,
        gp.status,
        gp.ai_analysis,
        -- Herd names aggregated
        COALESCE(
          (SELECT string_agg(h.name, ', ')
           FROM herds h
           WHERE h.id = ANY(gp.herd_ids)),
          'Sin rodeo'
        ) AS rodeos,
        -- Total EV
        COALESCE(
          (SELECT SUM(h.total_ev)
           FROM herds h
           WHERE h.id = ANY(gp.herd_ids)),
          0
        ) AS total_ev
      FROM grazing_plans gp
      JOIN paddocks p ON p.id = gp.paddock_id
      WHERE gp.org_id = $1
      ORDER BY gp.entry_date DESC
    `, [auth.orgId])

    // Build CSV
    const headers = [
      'ID', 'Potrero', 'Ha', 'Rodeos', 'EV Total',
      'Entrada Plan', 'Salida Plan', 'Días Plan',
      'Entrada Real', 'Salida Real', 'Días Real',
      'Descanso (días)', 'Estado', 'Tipo',
    ]

    const daysBetween = (a: string, b: string) => {
      if (!a || !b) return ''
      const ms = new Date(b).getTime() - new Date(a).getTime()
      return isNaN(ms) ? '' : String(Math.round(ms / 86400000))
    }

    const csvRows = rows.map(r => {
      const ai = (r.ai_analysis as any) || {}
      const tipo = ai.plan_source === 'suggested' ? 'Sugerida' : 'Manual'
      const entryDate  = (r.entry_date          as string | null) ?? ''
      const exitDate   = (r.exit_date           as string | null) ?? ''
      const realEntry  = (r.actual_entry_date   as string | null) ?? ''
      const realExit   = (r.actual_exit_date    as string | null) ?? ''
      return [
        r.id,
        r.potrero,
        r.area_ha,
        r.rodeos,
        r.total_ev,
        entryDate,
        exitDate,
        daysBetween(entryDate, exitDate),
        realEntry,
        realExit,
        daysBetween(realEntry, realExit),
        r.planned_recovery_days,
        r.status,
        tipo,
      ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')
    })

    const csv = '\uFEFF' + [headers.join(';'), ...csvRows].join('\r\n')

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="planificacion-pastoreo-${new Date().toISOString().slice(0,10)}.csv"`,
      },
    })
  } catch (err) {
    console.error('[GET /api/grazing-plans/export]', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
