/**
 * GET /api/admin/metrics
 * KPIs globales de la plataforma para el Super Admin dashboard.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { query, queryOne } from '@/lib/db'

async function requireSuperAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (!token) return null
  const decoded = await verifyFirebaseToken(token)
  if (!decoded || decoded.system_role !== 'SUPER_ADMIN') return null
  return decoded
}

export async function GET(req: NextRequest) {
  const admin = await requireSuperAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const [
      globalStats,
      planDistribution,
      monthlySignups,
      topOrgs,
      recentActivity,
    ] = await Promise.all([
      // KPIs globales
      queryOne(`
        SELECT
          (SELECT COUNT(*)           FROM profiles      WHERE system_role IS NULL)::int AS total_users,
          (SELECT COUNT(*)           FROM profiles      WHERE is_active = true AND system_role IS NULL)::int AS active_users,
          (SELECT COUNT(*)           FROM organizations)::int AS total_orgs,
          (SELECT COALESCE(SUM(total_area_ha), 0) FROM organizations)::numeric AS total_hectares,
          (SELECT COUNT(*)           FROM paddocks  WHERE is_active = true)::int AS total_paddocks,
          (SELECT COUNT(*)           FROM herds     WHERE head_count > 0)::int AS total_herds,
          (SELECT COUNT(*)           FROM grazing_plans WHERE status IN ('PLANNED','ACTIVE'))::int AS active_grazing_plans,
          (SELECT COUNT(*)           FROM grazing_plans)::int AS total_grazing_plans,
          (SELECT COUNT(*)           FROM profiles   WHERE created_at >= NOW() - INTERVAL '30 days' AND system_role IS NULL)::int AS new_users_30d,
          (SELECT COUNT(*)           FROM organizations WHERE created_at >= NOW() - INTERVAL '30 days')::int AS new_orgs_30d
      `),

      // Distribución de planes
      query(`
        SELECT
          sp.name,
          sp.slug,
          sp.color,
          COUNT(o.id)::int AS org_count,
          COALESCE(SUM(o.total_area_ha), 0)::numeric AS total_ha
        FROM subscriptions_plans sp
        LEFT JOIN organizations o ON o.subscription_plan_id = sp.id
        WHERE sp.is_active = true
        GROUP BY sp.id, sp.name, sp.slug, sp.color
        ORDER BY sp.sort_order
      `),

      // Registros por mes (últimos 6 meses)
      query(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
          COUNT(*)::int AS signups
        FROM profiles
        WHERE created_at >= NOW() - INTERVAL '6 months'
          AND system_role IS NULL
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY DATE_TRUNC('month', created_at)
      `),

      // Top 5 organizaciones por hectáreas
      query(`
        SELECT
          o.id,
          o.name,
          o.total_area_ha,
          o.plan_status,
          sp.name AS plan_name,
          sp.slug AS plan_slug,
          p.email AS owner_email,
          (SELECT COUNT(*) FROM paddocks WHERE org_id = o.id)::int AS paddocks_count,
          (SELECT COUNT(*) FROM herds    WHERE org_id = o.id)::int AS herds_count
        FROM organizations o
        LEFT JOIN subscriptions_plans sp ON o.subscription_plan_id = sp.id
        LEFT JOIN profiles p ON p.organization_id = o.id AND p.team_role IS NULL
        ORDER BY o.total_area_ha DESC NULLS LAST
        LIMIT 5
      `),

      // Actividad reciente (últimas 10 acciones de audit)
      query(`
        SELECT
          al.id,
          al.action,
          al.entity_type,
          al.actor_email,
          al.created_at
        FROM audit_logs al
        ORDER BY al.created_at DESC
        LIMIT 10
      `),
    ])

    return NextResponse.json({
      global: globalStats,
      planDistribution,
      monthlySignups,
      topOrgs,
      recentActivity,
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('GET /api/admin/metrics error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
