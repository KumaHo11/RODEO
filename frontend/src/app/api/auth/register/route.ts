/**
 * POST /api/auth/register
 * 1. Verifica el ID token de Firebase del usuario recién creado
 * 2. Crea perfil + organización en Cloud SQL
 * 3. Genera link de verificación de email con Firebase Admin
 * 4. Envía email de bienvenida con el link via SendGrid
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { adminAuth } from '@/lib/firebase/admin'
import { mutate, query } from '@/lib/db'
import { sendEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { idToken, firstName, lastName, phone, country, countryCode, termsVersionId } = body

    if (!idToken) {
      return NextResponse.json({ error: 'ID Token requerido' }, { status: 400 })
    }

    // 1. Verificar el ID Token de Firebase
    const decodedToken = await verifyFirebaseToken(idToken)
    if (!decodedToken) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
    }

    const { uid, email } = decodedToken

    // 2. Verificar si ya existe un perfil (idempotente por UID)
    const existing = await query(
      `SELECT id FROM profiles WHERE firebase_uid = $1`,
      [uid]
    )
    if (existing.length > 0) {
      return NextResponse.json({ success: true, uid }, { status: 200 })
    }

    // 2.5 Verificar si existe por email (Prevención de Error 500 de Base de Datos)
    // Esto ocurre si borraste tu usuario en Firebase Console a mano pero 
    // su perfil SQL siguió existiendo.
    const existingEmail = await query(`SELECT id FROM profiles WHERE email = $1`, [email])
    if (existingEmail.length > 0) {
      return NextResponse.json({ error: 'El correo electrónico ya se encuentra registrado. Por favor inicia sesión.' }, { status: 400 })
    }

    // 3. Crear organización con trial automático del plan Holístico
    // trial_days es configurable desde el admin — lo leemos de la BD
    const trialPlan = await query<{ id: string; trial_days: number }>(
      `SELECT id, trial_days FROM subscriptions_plans WHERE slug = 'holistico' AND is_active = true LIMIT 1`
    )
    const planRow = trialPlan[0]

    const orgResult = await mutate(
      `INSERT INTO organizations
         (id, name, subscription_plan_id, plan_status, trial_ends_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
       RETURNING id`,
      [
        `${firstName || 'Mi'} Ranch`,
        planRow?.id ?? null,
        planRow ? 'trialing' : 'active',
        planRow?.trial_days
          ? new Date(Date.now() + planRow.trial_days * 24 * 60 * 60 * 1000).toISOString()
          : null,
      ]
    )
    const orgId = orgResult.rows[0]?.id

    const profileResult = await mutate(
      `INSERT INTO profiles
        (id, firebase_uid, email, first_name, last_name, phone, organization_id,
         role, onboarding_step, country_code, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'OWNER', 0, $7, NOW())
       RETURNING id`,
      [uid, email, firstName, lastName, phone || null, orgId, countryCode || 'AR']
    )
    const profileId = profileResult.rows[0]?.id

    // Update organization with the proper owner_id (profile_id is a UUID, firebase_uid is not)
    if (orgId && profileId) {
      await mutate(`UPDATE organizations SET owner_id = $1 WHERE id = $2`, [profileId, orgId])
    }

    // 3.5. Registrar aceptación de Términos y Condiciones
    if (termsVersionId && profileId) {
      const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown'
      await mutate(
        `INSERT INTO user_terms_acceptances (id, profile_id, version_id, ip_address)
         VALUES (gen_random_uuid(), $1, $2, $3)`,
        [profileId, termsVersionId, ipAddress]
      )
    }

    // 4. Generar link de verificación de email usando Custom JWT (Evita bloqueos de Identity Platform)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    let verifyUrl = `${appUrl}/login?verified=1`

    try {
      const { SignJWT } = await import('jose')
      // EMAIL_VERIFY_JWT_SECRET is a private server-side secret, NOT the public Firebase API key.
      // Generate with: node -e "require('crypto').randomBytes(48).toString('base64url')" and store
      // as a Cloud Run secret (never in NEXT_PUBLIC_* variables).
      const jwtSecret = process.env.EMAIL_VERIFY_JWT_SECRET
      if (!jwtSecret) throw new Error('EMAIL_VERIFY_JWT_SECRET is not configured')
      const secret = new TextEncoder().encode(jwtSecret)
      const token = await new SignJWT({ uid, email })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('24h')
        .sign(secret)

      verifyUrl = `${appUrl}/auth/action?mode=verifyCustom&token=${token}`
      console.log('[Register] Email verify link generated via Custom JWT')
    } catch (tokenErr: any) {
      console.warn('[Register] Failed to generate custom JWT:', tokenErr.message)
    }

    // 5. Enviar email de bienvenida + verificación via SendGrid
    try {
      await sendEmail('verify_email', email!, {
        firstName: firstName || 'Usuario',
        verifyUrl,
      })
    } catch (emailErr: any) {
      console.warn('[Register] Email send error:', emailErr.message)
      // Don't block registration if email fails
    }

    return NextResponse.json({ success: true, uid }, { status: 201 })
  } catch (err: any) {
    console.error('POST /api/auth/register error:', err)
    return NextResponse.json({ error: 'Error al crear el perfil. Intenta nuevamente.' }, { status: 500 })
  }
}
