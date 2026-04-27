/**
 * PATCH/DELETE /api/admin/plans/[id]
 * Update or deactivate a subscription plan.
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const plan = await queryOne(`
    SELECT sp.*,
      COALESCE(
        JSON_AGG(JSON_BUILD_OBJECT(
          'id', pff.id, 'flag_key', pff.flag_key,
          'flag_value', pff.flag_value, 'flag_type', pff.flag_type, 'label', pff.label
        ) ORDER BY pff.flag_key) FILTER (WHERE pff.id IS NOT NULL), '[]'::json
      ) AS feature_flags
    FROM subscriptions_plans sp
    LEFT JOIN plan_feature_flags pff ON pff.plan_id = sp.id
    WHERE sp.id = $1
    GROUP BY sp.id
  `, [id])

  if (!plan) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ plan })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const {
    name, description, price, price_yearly, paddocks_limit, herds_limit,
    has_ai_analysis, color, is_popular, is_active, sort_order,
    stripe_price_id_monthly, stripe_price_id_yearly, mp_preapproval_plan_id,
    feature_flags,
  } = body

  const oldPlan = await queryOne(`SELECT * FROM subscriptions_plans WHERE id = $1`, [id])
  if (!oldPlan) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    await query(
      `UPDATE subscriptions_plans SET
        name                    = COALESCE($1, name),
        description             = COALESCE($2, description),
        price                   = COALESCE($3, price),
        price_yearly            = COALESCE($4, price_yearly),
        paddocks_limit          = COALESCE($5, paddocks_limit),
        herds_limit             = COALESCE($6, herds_limit),
        has_ai_analysis         = COALESCE($7, has_ai_analysis),
        color                   = COALESCE($8, color),
        is_popular              = COALESCE($9, is_popular),
        is_active               = COALESCE($10, is_active),
        sort_order              = COALESCE($11, sort_order),
        stripe_price_id_monthly = COALESCE($12, stripe_price_id_monthly),
        stripe_price_id_yearly  = COALESCE($13, stripe_price_id_yearly),
        mp_preapproval_plan_id  = COALESCE($14, mp_preapproval_plan_id),
        updated_at              = NOW()
       WHERE id = $15`,
      [name, description, price, price_yearly, paddocks_limit, herds_limit,
       has_ai_analysis, color, is_popular, is_active, sort_order,
       stripe_price_id_monthly, stripe_price_id_yearly, mp_preapproval_plan_id,
       id]
    )

    // Update feature flags: upsert each flag
    if (feature_flags && Array.isArray(feature_flags)) {
      for (const flag of feature_flags) {
        if (flag.id) {
          // Update existing flag
          await query(
            `UPDATE plan_feature_flags
             SET flag_value = $1::jsonb, label = COALESCE($2, label), flag_type = COALESCE($3, flag_type)
             WHERE id = $4 AND plan_id = $5`,
            [JSON.stringify(flag.flag_value), flag.label, flag.flag_type, flag.id, id]
          )
        } else if (flag.flag_key) {
          // Insert new flag
          await query(
            `INSERT INTO plan_feature_flags (plan_id, flag_key, flag_value, flag_type, label)
             VALUES ($1, $2, $3::jsonb, $4, $5)
             ON CONFLICT (plan_id, flag_key) DO UPDATE
             SET flag_value = EXCLUDED.flag_value, label = EXCLUDED.label`,
            [id, flag.flag_key, JSON.stringify(flag.flag_value), flag.flag_type || 'boolean', flag.label]
          )
        }
      }
    }

    // Audit
    await query(
      `INSERT INTO audit_logs (actor_email, action, entity_type, entity_id, old_value, new_value)
       VALUES ($1, 'PLAN_UPDATED', 'plan', $2, $3, $4)`,
      [admin.email || '', id, JSON.stringify(oldPlan), JSON.stringify(body)]
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/admin/plans/[id] error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  // Soft delete (desactivar)
  await query(`UPDATE subscriptions_plans SET is_active = false, updated_at = NOW() WHERE id = $1`, [id])

  await query(
    `INSERT INTO audit_logs (actor_email, action, entity_type, entity_id)
     VALUES ($1, 'PLAN_DEACTIVATED', 'plan', $2)`,
    [admin.email || '', id]
  )

  return NextResponse.json({ ok: true })
}
