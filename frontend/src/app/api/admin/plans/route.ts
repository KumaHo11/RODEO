/**
 * Plans CRUD API for Super Admin.
 * GET  /api/admin/plans     → list all plans with feature flags
 * POST /api/admin/plans     → create new plan
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { serviceQuery } from '@/lib/db'

async function requireSuperAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (!token) return null
  const decoded = await verifyFirebaseToken(token)
  if (!decoded || decoded.system_role !== 'SUPER_ADMIN') return null
  return decoded
}

async function logAudit(actorUid: string, actorEmail: string, action: string, entityId: string, oldVal: any, newVal: any) {
  await serviceQuery(
    `INSERT INTO audit_logs (actor_email, action, entity_type, entity_id, old_value, new_value)
     VALUES ($1, $2, 'plan', $3, $4, $5)`,
    [actorEmail, action, entityId, oldVal ? JSON.stringify(oldVal) : null, JSON.stringify(newVal)]
  )
}

export async function GET(req: NextRequest) {
  const admin = await requireSuperAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const plans = await serviceQuery(`
      SELECT
        sp.*,
        (SELECT COUNT(*) FROM organizations o WHERE o.subscription_plan_id = sp.id)::int AS org_count,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', pff.id,
              'flag_key', pff.flag_key,
              'flag_value', pff.flag_value,
              'flag_type', pff.flag_type,
              'label', pff.label
            ) ORDER BY pff.flag_key
          ) FILTER (WHERE pff.id IS NOT NULL),
          '[]'::json
        ) AS feature_flags
      FROM subscriptions_plans sp
      LEFT JOIN plan_feature_flags pff ON pff.plan_id = sp.id
      GROUP BY sp.id
      ORDER BY sp.sort_order, sp.created_at
    `)

    return NextResponse.json({ plans })
  } catch (err) {
    console.error('GET /api/admin/plans error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireSuperAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const {
    name, slug, description, price, price_yearly,
    paddocks_limit, herds_limit, has_ai_analysis,
    color, is_popular, sort_order, trial_days = 0, feature_flags = []
  } = body

  if (!name || !slug) {
    return NextResponse.json({ error: 'name and slug are required' }, { status: 400 })
  }

  try {
    const [plan] = await serviceQuery<{ id: string }>(
      `INSERT INTO subscriptions_plans
         (name, slug, description, price, price_yearly, paddocks_limit, herds_limit,
          has_ai_analysis, color, is_popular, sort_order, trial_days, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true)
       RETURNING id`,
      [name, slug, description || null, price || 0, price_yearly || 0,
       paddocks_limit || 5, herds_limit || 1, has_ai_analysis || false,
       color || '#22C55E', is_popular || false, sort_order || 99, trial_days || 0]
    )

    // Insert feature flags
    for (const flag of feature_flags) {
      await serviceQuery(
        `INSERT INTO plan_feature_flags (plan_id, flag_key, flag_value, flag_type, label)
         VALUES ($1, $2, $3::jsonb, $4, $5)`,
        [plan.id, flag.flag_key, JSON.stringify(flag.flag_value), flag.flag_type || 'boolean', flag.label || null]
      )
    }

    await logAudit(admin.uid, admin.email || '', 'PLAN_CREATED', plan.id, null, body)

    return NextResponse.json({ plan: { id: plan.id } }, { status: 201 })
  } catch (err: any) {
    if (err.code === '23505') return NextResponse.json({ error: 'slug ya existe' }, { status: 409 })
    console.error('POST /api/admin/plans error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
