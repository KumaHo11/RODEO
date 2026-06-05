/**
 * GET /api/admin/feature-flags/resolve?org_id=xxx
 * Resuelve los feature flags efectivos para una organización.
 * Combina los flags del plan de suscripción.
 * Usado tanto por el admin como por el frontend del usuario final.
 *
 * LÓGICA DE TRIAL (45 días):
 *  - plan_status = 'trialing' y trial_ends_at > NOW()  → flags del plan Holístico
 *  - plan_status = 'trialing' y trial_ends_at <= NOW() → downgrade automático a Brote
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { query, queryOne } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const orgId = searchParams.get('org_id')

  // Autenticación: acepta usuarios normales (para sus propios flags) y Super Admin
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const decoded = await verifyFirebaseToken(token)
  if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  // Si no es Super Admin, solo puede consultar sus propios flags
  const isSuperAdmin = decoded.system_role === 'SUPER_ADMIN'

  let resolvedOrgId = orgId

  if (!isSuperAdmin) {
    // Obtener org_id del perfil del usuario autenticado
    const profile = await queryOne<{ organization_id: string }>(
      `SELECT organization_id FROM profiles WHERE firebase_uid = $1`,
      [decoded.uid]
    )
    if (!profile?.organization_id) {
      return NextResponse.json({ flags: {}, planName: null, planSlug: null })
    }
    // Solo puede ver sus propios flags
    resolvedOrgId = profile.organization_id
  }

  if (!resolvedOrgId) {
    return NextResponse.json({ error: 'org_id required' }, { status: 400 })
  }

  try {
    // Obtener plan de la organización y sus feature flags
    const org = await queryOne<{
      subscription_plan_id: string
      plan_status: string
      trial_ends_at: string | null
    }>(
      `SELECT subscription_plan_id, plan_status, trial_ends_at FROM organizations WHERE id = $1`,
      [resolvedOrgId]
    )

    // ── Trial activo: devolver flags del plan Holístico ─────────────────────
    if (org?.plan_status === 'trialing' && org.trial_ends_at) {
      const trialEnds = new Date(org.trial_ends_at)
      const now = new Date()

      if (now <= trialEnds) {
        // Trial vigente → usar flags del plan Holístico (acceso completo)
        const proPlan = await queryOne<{ id: string; name: string; slug: string }>(
          `SELECT id, name, slug FROM subscriptions_plans WHERE slug = 'holistico' AND is_active = true LIMIT 1`
        )
        if (proPlan) {
          const daysLeft = Math.ceil((trialEnds.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          return resolveFlags(proPlan.id, proPlan.name, proPlan.slug, resolvedOrgId, 'trialing', daysLeft)
        }
      } else {
        // ── Trial vencido sin pago → downgrade automático a Brote ─────────
        const brotePlan = await queryOne<{ id: string; name: string; slug: string }>(
          `SELECT id, name, slug FROM subscriptions_plans WHERE slug = 'brote' AND is_active = true LIMIT 1`
        )
        if (brotePlan) {
          await query(
            `UPDATE organizations
             SET subscription_plan_id = $1,
                 plan_status          = 'active',
                 trial_ends_at        = NULL,
                 updated_at           = NOW()
             WHERE id = $2`,
            [brotePlan.id, resolvedOrgId]
          )
          return resolveFlags(brotePlan.id, brotePlan.name, brotePlan.slug, resolvedOrgId, 'active')
        }
      }
    }

    if (!org?.subscription_plan_id) {
      // Sin plan → usar defaults del plan Brote
      const brotePlan = await queryOne<{ id: string; name: string; slug: string }>(
        `SELECT id, name, slug FROM subscriptions_plans WHERE slug = 'brote' AND is_active = true LIMIT 1`
      )
      if (brotePlan) {
        return resolveFlags(brotePlan.id, brotePlan.name, brotePlan.slug, resolvedOrgId)
      }
      return NextResponse.json({ flags: {}, planName: 'Sin plan', planSlug: null, planStatus: null })
    }

    const plan = await queryOne<{ id: string; name: string; slug: string }>(
      `SELECT id, name, slug FROM subscriptions_plans WHERE id = $1`,
      [org.subscription_plan_id]
    )

    if (!plan) return NextResponse.json({ flags: {}, planName: null, planSlug: null })

    return resolveFlags(plan.id, plan.name, plan.slug, resolvedOrgId, org.plan_status)
  } catch (err) {
    console.error('GET /api/admin/feature-flags/resolve error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

async function resolveFlags(
  planId: string,
  planName: string,
  planSlug: string,
  orgId: string,
  planStatus?: string | null,
  trialDaysLeft?: number
) {
  const flags = await query<{ flag_key: string; flag_value: any; flag_type: string }>(
    `SELECT flag_key, flag_value, flag_type FROM plan_feature_flags WHERE plan_id = $1`,
    [planId]
  )

  // Build flags object: parse JSONB values to native types
  const resolved: Record<string, boolean | number | string> = {}
  for (const f of flags) {
    const raw = f.flag_value
    if (f.flag_type === 'boolean') resolved[f.flag_key] = Boolean(raw)
    else if (f.flag_type === 'number') resolved[f.flag_key] = Number(raw)
    else resolved[f.flag_key] = String(raw)
  }

  // Si el plan está vencido o cancelado, degradar a flags restringidos
  if (planStatus === 'past_due' || planStatus === 'canceled') {
    resolved['ndvi_access']      = false
    resolved['ai_insights']      = false
    resolved['voice_bitacora']   = false
    resolved['grazing_planner']  = false
    resolved['carbon_module']    = false
    resolved['offline_mode']     = false
    resolved['api_access']       = false
  }

  return NextResponse.json({
    flags: resolved,
    planName,
    planSlug,
    planStatus: planStatus || 'active',
    trialDaysLeft: trialDaysLeft ?? null,
    orgId,
  })
}
