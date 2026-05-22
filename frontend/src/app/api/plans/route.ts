/**
 * GET /api/plans  — Public endpoint (no auth required)
 * Returns active plans with feature flags for the landing page.
 */
import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET() {
  try {
    const plans = await query(`
      SELECT
        sp.id, sp.name, sp.slug, sp.description,
        sp.price, sp.price_yearly, sp.color,
        sp.is_popular, sp.sort_order,
        COALESCE(sp.trial_days, 0) AS trial_days,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
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
      WHERE sp.is_active = true
      GROUP BY sp.id
      ORDER BY sp.sort_order, sp.created_at
    `)
    return NextResponse.json({ plans }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' }
    })
  } catch (err) {
    console.error('GET /api/plans error:', err)
    return NextResponse.json({ plans: [] }, { status: 200 })
  }
}
