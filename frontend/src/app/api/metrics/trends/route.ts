import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { checkFeatureAccess } from '@/lib/plan-limits'
import { serviceQuery, serviceQueryOne } from '@/lib/db'

/**
 * GET /api/metrics/trends
 *
 * Returns snapshot history from metric_snapshots, grouped by month.
 * Used by the Time Machine polling mechanism and trend displays.
 *
 * Query params:
 *   - paddock_id (optional): filter by paddock
 *   - metric_type (optional): filter by specific metric (e.g. NDVI)
 *   - limit (optional, default 12): max results
 *   - order (optional, default desc): asc or desc by capture_date
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

    const paddockId  = req.nextUrl.searchParams.get('paddock_id')
    const metricType = req.nextUrl.searchParams.get('metric_type')
    const limitParam = req.nextUrl.searchParams.get('limit')
    const limit      = Math.min(Math.max(limitParam ? parseInt(limitParam, 10) : 12, 1), 120)
    const orderDir   = req.nextUrl.searchParams.get('order') === 'asc' ? 'ASC' : 'DESC'

    // Build query against metric_snapshots (always populated by backfill)
    const conditions: string[] = ['org_id = $1']
    const params: any[] = [profile.organization_id]
    let idx = 2

    if (paddockId) {
      conditions.push(`paddock_id = $${idx++}`)
      params.push(paddockId)
    }
    if (metricType) {
      conditions.push(`metric_type = $${idx++}`)
      params.push(metricType)
    }

    const whereClause = conditions.join(' AND ')

    let trends: any[] = []
    try {
      if (metricType) {
        // Time series for a specific metric — one row per capture_date
        trends = await serviceQuery<{
          metric_type: string
          avg_value: string
          pct_change: string | null
          trend_direction: string
          data_points: number
          period_start: string
        }>(`
          WITH ordered AS (
            SELECT
              metric_type,
              value,
              capture_date,
              LAG(value) OVER (PARTITION BY metric_type ORDER BY capture_date) AS prev_value
            FROM metric_snapshots
            WHERE ${whereClause}
            ORDER BY capture_date ${orderDir}
          )
          SELECT
            metric_type,
            value::text AS avg_value,
            CASE WHEN prev_value IS NOT NULL AND prev_value != 0
              THEN ROUND(((value - prev_value) / prev_value * 100)::numeric, 2)::text
              ELSE '0'
            END AS pct_change,
            CASE
              WHEN prev_value IS NULL THEN 'stable'
              WHEN value > prev_value THEN 'up'
              WHEN value < prev_value THEN 'down'
              ELSE 'stable'
            END AS trend_direction,
            1 AS data_points,
            capture_date::text AS period_start
          FROM ordered
          ORDER BY capture_date ${orderDir}
          LIMIT $${idx}
        `, [...params, limit])
      } else {
        // Latest value per metric_type — for dashboard summary
        trends = await serviceQuery<{
          metric_type: string
          avg_value: string
          pct_change: string | null
          trend_direction: string
          data_points: number
          period_start: string
        }>(`
          WITH ranked AS (
            SELECT
              metric_type, value, capture_date,
              ROW_NUMBER() OVER (PARTITION BY metric_type ORDER BY capture_date DESC) AS rn
            FROM metric_snapshots
            WHERE ${whereClause}
          ),
          latest AS (SELECT * FROM ranked WHERE rn = 1),
          prev   AS (SELECT * FROM ranked WHERE rn = 2)
          SELECT
            l.metric_type,
            l.value::text AS avg_value,
            CASE WHEN p.value IS NOT NULL AND p.value != 0
              THEN ROUND(((l.value - p.value) / p.value * 100)::numeric, 2)::text
              ELSE '0'
            END AS pct_change,
            CASE
              WHEN p.value IS NULL THEN 'stable'
              WHEN l.value > p.value THEN 'up'
              WHEN l.value < p.value THEN 'down'
              ELSE 'stable'
            END AS trend_direction,
            1 AS data_points,
            l.capture_date::text AS period_start
          FROM latest l
          LEFT JOIN prev p USING (metric_type)
          ORDER BY l.metric_type
        `, params)
      }
    } catch (e: any) {
      if (!e.message?.includes('does not exist')) throw e
      console.warn('[/api/metrics/trends] metric_snapshots table not found')
    }

    return NextResponse.json({ trends })
  } catch (err: any) {
    console.error('[/api/metrics/trends]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
