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
      `SELECT id, firebase_uid, email, first_name, last_name, avatar_url,
              organization_id, onboarding_step, team_role, permissions,
              country_code, role, phone, is_first_login
       FROM profiles
       WHERE firebase_uid = $1`,
      [firebaseUid]
    )

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    return NextResponse.json({ profile })
  } catch (err: any) {
    console.error('GET /api/auth/profile error:', err)
    if (err.code === 'auth/id-token-expired' || err.code === 'auth/argument-error') {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
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

    const { first_name, last_name, phone, role, onboarding_step, is_first_login } = await req.json()

    await query(
      `UPDATE profiles
       SET first_name       = COALESCE($1, first_name),
           last_name        = COALESCE($2, last_name),
           phone            = COALESCE($3, phone),
           role             = COALESCE($4, role),
           onboarding_step  = COALESCE($5, onboarding_step),
           is_first_login   = COALESCE($6, is_first_login),
           updated_at       = NOW()
       WHERE firebase_uid = $7`,
      [first_name || null, last_name || null, phone || null, role || null,
       onboarding_step !== undefined ? onboarding_step : null,
       is_first_login !== undefined ? is_first_login : null,
       firebaseUid]
    )

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('PATCH /api/auth/profile error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
