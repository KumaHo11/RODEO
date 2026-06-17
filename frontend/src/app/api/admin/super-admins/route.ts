/**
 * POST /api/admin/super-admins
 * Crear un nuevo Super Admin (solo accesible por SUPER_ADMIN existente).
 * GET  /api/admin/super-admins → lista todos los super admins
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { serviceQuery, serviceQueryOne } from '@/lib/db'
import { adminAuth } from '@/lib/firebase/admin'

async function requireSuperAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (!token) return null
  const decoded = await verifyFirebaseToken(token)
  if (!decoded) return null
  const profile = await serviceQueryOne<{ system_role: string; email: string }>(
    `SELECT system_role, email FROM profiles WHERE firebase_uid = $1`,
    [decoded.uid]
  )
  if (!profile || profile.system_role !== 'SUPER_ADMIN') return null
  return { ...decoded, dbEmail: profile.email }
}

export async function GET(req: NextRequest) {
  const adminUser = await requireSuperAdmin(req)
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admins = await serviceQuery(`
    SELECT id, email, first_name, last_name, is_active, created_at, system_role
    FROM profiles
    WHERE system_role IN ('SUPER_ADMIN', 'SUPPORT_AGENT')
    ORDER BY created_at
  `)

  return NextResponse.json({ admins })
}

export async function POST(req: NextRequest) {
  const adminUser = await requireSuperAdmin(req)
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, first_name, last_name, system_role, password } = await req.json()

  if (!email || !password || !first_name) {
    return NextResponse.json({ error: 'email, password y first_name son requeridos' }, { status: 400 })
  }

  const validRoles = ['SUPER_ADMIN', 'SUPPORT_AGENT']
  if (!validRoles.includes(system_role)) {
    return NextResponse.json({ error: `Rol inválido. Debe ser: ${validRoles.join(' | ')}` }, { status: 400 })
  }

  try {
    // 1. Crear usuario en Firebase Auth
    const fbUser = await adminAuth.createUser({
      email,
      password,
      displayName: `${first_name} ${last_name || ''}`.trim(),
      emailVerified: true,
    })

    // 2. Setear custom claim system_role en Firebase
    await adminAuth.setCustomUserClaims(fbUser.uid, { system_role })

    // 3. Insertar perfil en la DB
    await serviceQuery(
      `INSERT INTO profiles (firebase_uid, email, first_name, last_name, system_role, is_active, onboarding_step)
       VALUES ($1, $2, $3, $4, $5, true, 99)
       ON CONFLICT (firebase_uid) DO UPDATE
       SET system_role = $5, first_name = $3, last_name = $4`,
      [fbUser.uid, email, first_name, last_name || null, system_role]
    )

    // 4. Audit log
    await serviceQuery(
      `INSERT INTO audit_logs (actor_email, action, entity_type, new_value)
       VALUES ($1, 'SUPER_ADMIN_CREATED', 'profile', $2)`,
      [adminUser.dbEmail, JSON.stringify({ email, system_role, first_name })]
    )

    return NextResponse.json({ ok: true, uid: fbUser.uid }, { status: 201 })
  } catch (err: any) {
    console.error('POST /api/admin/super-admins error:', err)
    if (err.code === 'auth/email-already-exists') {
      return NextResponse.json({ error: 'Email ya existe en Firebase Auth' }, { status: 409 })
    }
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
