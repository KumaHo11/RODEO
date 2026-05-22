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
    has_ai_analysis, color, is_popular, is_active, sort_order, trial_days,
    stripe_price_id_monthly, stripe_price_id_yearly, mp_preapproval_plan_id,
    feature_flags,
  } = body

  const oldPlan = await queryOne(`SELECT * FROM subscriptions_plans WHERE id = $1`, [id])
  if (!oldPlan) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    // Build SET clause dynamically — only include fields present in the request.
    // trial_days is optional: omit it if the column doesn't exist yet in DB.
    const fields: string[] = []
    const values: any[]   = []
    let   idx             = 1

    const add = (col: string, val: any) => {
      if (val !== undefined) { fields.push(`${col} = COALESCE($${idx++}, ${col})`); values.push(val) }
    }

    add('name',                    name)
    add('description',             description)
    add('price',                   price)
    add('price_yearly',            price_yearly)
    add('paddocks_limit',          paddocks_limit)
    add('herds_limit',             herds_limit)
    add('has_ai_analysis',         has_ai_analysis)
    add('color',                   color)
    add('is_popular',              is_popular)
    add('is_active',               is_active)
    add('sort_order',              sort_order)
    add('stripe_price_id_monthly', stripe_price_id_monthly)
    add('stripe_price_id_yearly',  stripe_price_id_yearly)
    add('mp_preapproval_plan_id',  mp_preapproval_plan_id)

    // trial_days: only add if it was explicitly sent AND we can verify the column exists
    if (trial_days !== undefined) {
      try {
        // Check column exists before including it
        await queryOne(`SELECT trial_days FROM subscriptions_plans WHERE id = $1`, [id])
        add('trial_days', trial_days)
      } catch {
        // Column doesn't exist yet — skip silently until migration runs
      }
    }

    if (fields.length > 0) {
      fields.push('updated_at = NOW()')
      values.push(id)
      await query(
        `UPDATE subscriptions_plans SET ${fields.join(', ')} WHERE id = $${idx}`,
        values
      )
    }

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
