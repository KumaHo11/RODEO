/**
 * GET /api/auth/profile
 * Retorna el perfil del usuario autenticado desde Cloud SQL
 * Verifica el Firebase ID token del header Authorization
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { queryOne, query } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()

    if (!token) {
      return NextResponse.json({ error: 'No token' }, { status: 401 })
    }

    // Verificar token con Firebase public keys
    const decoded = await verifyFirebaseToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }
    const firebaseUid = decoded.uid

    // Buscar perfil en Cloud SQL
    const profile = await queryOne(
      `SELECT p.id, p.firebase_uid, p.email, p.first_name, p.last_name, p.avatar_url,
              p.organization_id, p.onboarding_step, p.team_role, p.permissions, p.notification_preferences,
              p.country_code, p.role, p.phone, p.is_first_login, p.is_active, p.system_role,
              o.created_at as org_created_at, o.plan_status, o.trial_ends_at, o.stripe_customer_id,
              sp.slug AS plan_slug, sp.name AS plan_name, sp.price as plan_price, sp.price_yearly as plan_price_yearly, sp.trial_days as plan_trial_days
       FROM profiles p
       LEFT JOIN organizations o ON p.organization_id = o.id
       LEFT JOIN subscriptions_plans sp ON o.subscription_plan_id = sp.id
       WHERE p.firebase_uid = $1`,
      [firebaseUid]
    )

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Bloquear acceso si el usuario fue deshabilitado por el admin
    if ((profile as any).is_active === false) {
      return NextResponse.json(
        { error: 'Cuenta deshabilitada. Contactá a soporte.', code: 'account_disabled' },
        { status: 403 }
      )
    }

    // Cargar feature flags del plan de la organización
    let plan_feature_flags: any[] = []
    if ((profile as any).organization_id) {
      plan_feature_flags = await query(
        `SELECT pff.flag_key, pff.flag_value, pff.flag_type, pff.label
         FROM plan_feature_flags pff
         JOIN subscriptions_plans sp ON pff.plan_id = sp.id
         JOIN organizations o ON o.subscription_plan_id = sp.id
         WHERE o.id = $1`,
        [(profile as any).organization_id]
      )
    }
    console.log('✅ Profile found for UID:', firebaseUid)
    return NextResponse.json({ profile: { ...profile, plan_feature_flags } })
  } catch (err: any) {
    console.error('❌ GET /api/auth/profile full error:', err)
    if (err.code === 'auth/id-token-expired' || err.code === 'auth/argument-error') {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    return NextResponse.json({ 
      error: 'Server error', 
      details: err.message,
      source: err.stack?.includes('db.ts') ? 'database' : 'firebase/other'
    }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 })

    const decoded = await verifyFirebaseToken(token)
    if (!decoded) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    const firebaseUid = decoded.uid

    const { first_name, last_name, phone, role, onboarding_step, is_first_login, avatar_url, notification_preferences } = await req.json()

    await query(
      `UPDATE profiles
       SET first_name               = COALESCE($1, first_name),
           last_name                = COALESCE($2, last_name),
           phone                    = COALESCE($3, phone),
           role                     = COALESCE($4, role),
           onboarding_step          = COALESCE($5, onboarding_step),
           is_first_login           = COALESCE($6, is_first_login),
           avatar_url               = COALESCE($7, avatar_url),
           notification_preferences = COALESCE($8, notification_preferences),
           updated_at               = NOW()
       WHERE firebase_uid = $9`,
      [first_name || null, last_name || null, phone || null, role || null,
       onboarding_step !== undefined ? onboarding_step : null,
       is_first_login !== undefined ? is_first_login : null,
       avatar_url || null,
       notification_preferences ? JSON.stringify(notification_preferences) : null,
       firebaseUid]
    )

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('❌ PATCH /api/auth/profile error:', err)
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 })
  }
}
