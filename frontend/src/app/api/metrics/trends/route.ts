import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { checkFeatureAccess } from '@/lib/plan-limits'
import { serviceQuery, serviceQueryOne } from '@/lib/db'

/**
 * GET /api/metrics/trends
 * Returns latest monthly trend per metric_type for the user's org.
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
    const metricType = req.nextUrl.searchParams.get('metric_type')
    const limitParam = req.nextUrl.searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : 12
    const safeLimit = Math.min(Math.max(limit, 1), 60)
    const orderParam = req.nextUrl.searchParams.get('order')
    const orderDir = orderParam === 'asc' ? 'ASC' : 'DESC'

    let query = ''
    const params: any[] = [profile.organization_id]
    let paramIdx = 2

    if (metricType) {
      // Historical trend for a specific metric
      query = `
        SELECT
          metric_type, avg_value::text, pct_change::text, trend_direction,
          data_points, period_start::text
        FROM metric_trends
        WHERE org_id = $1
          AND period = 'monthly'
          ${paddockId ? `AND paddock_id = $${paramIdx++}` : 'AND paddock_id IS NULL'}
          AND metric_type = $${paramIdx++}
        ORDER BY period_start ${orderDir}
        LIMIT $${paramIdx++}
      `
      if (paddockId) params.push(paddockId)
      params.push(metricType, safeLimit)
    } else {
      // Latest monthly trend per metric_type
      query = `
        SELECT DISTINCT ON (metric_type)
          metric_type, avg_value::text, pct_change::text, trend_direction,
          data_points, period_start::text
        FROM metric_trends
        WHERE org_id = $1
          AND period = 'monthly'
          ${paddockId ? `AND paddock_id = $${paramIdx++}` : ''}
        ORDER BY metric_type, period_start DESC
      `
      if (paddockId) params.push(paddockId)
    }

    let trends: any[] = []
    try {
      trends = await serviceQuery<{
        metric_type:     string
        avg_value:       string
        pct_change:      string | null
        trend_direction: string
        data_points:     number
        period_start:    string
      }>(query, params)
    } catch (e: any) {
      if (!e.message?.includes('does not exist')) throw e
      console.warn('[/api/metrics/trends] metric_trends table not found')
    }

    return NextResponse.json({ trends })
  } catch (err: any) {
    console.error('[/api/metrics/trends]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
