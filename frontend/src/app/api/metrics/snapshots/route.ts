import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { checkFeatureAccess } from '@/lib/plan-limits'
import { serviceQuery, serviceQueryOne } from '@/lib/db'

/**
 * GET /api/metrics/snapshots
 * Returns the latest metric snapshot per metric_type for the user's org.
 * Optional query param: paddock_id (filter to a single paddock)
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const decoded = await verifyFirebaseToken(token)
    if (!decoded) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const hasAccess = await checkFeatureAccess(decoded.uid, 'metrics_module')
    if (!hasAccess) {
      return NextResponse.json({ error: 'Tu plan no incluye el módulo de métricas' }, { status: 403 })
    }

    // Get org_id for this user
    const profile = await serviceQueryOne<{ organization_id: string }>(
      `SELECT organization_id FROM profiles WHERE firebase_uid = $1`,
      [decoded.uid]
    )
    if (!profile?.organization_id) {
      return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 })
    }

    const paddockId = req.nextUrl.searchParams.get('paddock_id')

    // Latest snapshot per metric_type (most recent capture_date)
    const snapshots = await serviceQuery<{
      metric_type:  string
      value:        string
      unit:         string
      capture_date: string
      source:       string
      confidence:   string
      paddock_id:   string | null
    }>(`
      SELECT DISTINCT ON (metric_type)
        metric_type, value::text, unit, capture_date::text, source, confidence,
        paddock_id
      FROM metric_snapshots
      WHERE org_id = $1
        ${paddockId ? 'AND paddock_id = $2' : ''}
      ORDER BY metric_type, capture_date DESC
    `, [profile.organization_id, ...(paddockId ? [paddockId] : [])])

    return NextResponse.json({ snapshots, paddockId: paddockId || null })
  } catch (err: any) {
    console.error('[/api/metrics/snapshots]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
