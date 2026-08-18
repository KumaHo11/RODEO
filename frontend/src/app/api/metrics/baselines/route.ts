import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { checkFeatureAccess } from '@/lib/plan-limits'
import { serviceQuery, serviceQueryOne } from '@/lib/db'

/**
 * GET /api/metrics/baselines
 * Returns the 2020 baseline values (Dec 2020 snapshot) for each metric_type.
 * Used to compute "vs 2020" deltas on the Metrics Dashboard.
 * Optional query param: paddock_id
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const decoded = await verifyFirebaseToken(token)
    if (!decoded) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const hasAccess = await checkFeatureAccess(decoded.uid, 'metrics_module')
    if (!hasAccess) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

    const profile = await serviceQueryOne<{ organization_id: string }>(
      `SELECT organization_id FROM profiles WHERE firebase_uid = $1`, [decoded.uid]
    )
    if (!profile?.organization_id) return NextResponse.json({ error: 'Org no encontrada' }, { status: 404 })

    const paddockId = req.nextUrl.searchParams.get('paddock_id')

    // Baseline = average of snapshots from Nov 2020 – Jan 2021 (EUDR reference period)
    const baselines = await serviceQuery<{
      metric_type: string
      value:       string
    }>(`
      SELECT
        metric_type,
        AVG(value)::text AS value
      FROM metric_snapshots
      WHERE org_id = $1
        AND capture_date BETWEEN '2020-11-01' AND '2021-01-31'
        AND source != 'estimated'
        ${paddockId ? 'AND paddock_id = $2' : ''}
      GROUP BY metric_type
    `, [profile.organization_id, ...(paddockId ? [paddockId] : [])])

    return NextResponse.json({ baselines })
  } catch (err: any) {
    console.error('[/api/metrics/baselines]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
