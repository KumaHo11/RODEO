/**
 * GET /api/admin/feature-flags/resolve?org_id=xxx
 * Resuelve los feature flags efectivos para una organización.
 * Combina los flags del plan de suscripción.
 * Usado tanto por el admin como por el frontend del usuario final.
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
    const org = await queryOne<{ subscription_plan_id: string; plan_status: string }>(
      `SELECT subscription_plan_id, plan_status FROM organizations WHERE id = $1`,
      [resolvedOrgId]
    )

    if (!org?.subscription_plan_id) {
      // Sin plan → usar defaults del plan Free
      const freePlan = await queryOne<{ id: string; name: string; slug: string }>(
        `SELECT id, name, slug FROM subscriptions_plans WHERE slug = 'campo_libre' AND is_active = true LIMIT 1`
      )
      if (freePlan) {
        return resolveFlags(freePlan.id, freePlan.name, freePlan.slug, resolvedOrgId)
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
  planStatus?: string | null
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

  // Si el plan está vencido o cancelado, degradar a flags del plan free
  if (planStatus === 'past_due' || planStatus === 'canceled') {
    resolved['ndvi_access'] = false
    resolved['ai_insights'] = false
    resolved['voice_bitacora'] = false
  }

  return NextResponse.json({
    flags: resolved,
    planName,
    planSlug,
    planStatus: planStatus || 'active',
    orgId,
  })
}
