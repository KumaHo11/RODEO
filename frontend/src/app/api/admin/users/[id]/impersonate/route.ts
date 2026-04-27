/**
 * POST /api/admin/users/[id]/impersonate
 * Genera un Firebase Custom Token para impersonar a un usuario.
 * Solo accesible por SUPER_ADMIN. Registra en audit_logs.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { query, queryOne } from '@/lib/db'
import { adminAuth } from '@/lib/firebase/admin'

async function requireSuperAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (!token) return null
  const decoded = await verifyFirebaseToken(token)
  if (!decoded) return null

  // Verificar en DB que tiene system_role = SUPER_ADMIN (doble verificación)
  const profile = await queryOne<{ system_role: string; email: string }>(
    `SELECT system_role, email FROM profiles WHERE firebase_uid = $1`,
    [decoded.uid]
  )
  if (!profile || profile.system_role !== 'SUPER_ADMIN') return null

  return { ...decoded, dbEmail: profile.email }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await requireSuperAdmin(req)
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: targetUserId } = await params
  const { reason } = await req.json()

  // Obtener el usuario target
  const targetProfile = await queryOne<{ firebase_uid: string; email: string; is_active: boolean }>(
    `SELECT firebase_uid, email, is_active FROM profiles WHERE id = $1`,
    [targetUserId]
  )

  if (!targetProfile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (!targetProfile.is_active) {
    return NextResponse.json({ error: 'Cannot impersonate inactive user' }, { status: 400 })
  }

  try {
    // Generar Custom Token con flag de impersonation
    const customToken = await adminAuth.createCustomToken(targetProfile.firebase_uid, {
      impersonated_by: adminUser.uid,
      impersonation: true,
    })

    // Registrar sesión de impersonación
    const [session] = await query<{ id: string }>(
      `INSERT INTO impersonation_sessions (admin_id, admin_email, target_user_id, target_email, reason)
       SELECT ap.id, $1, tp.id, $2, $3
       FROM profiles ap, profiles tp
       WHERE ap.firebase_uid = $4 AND tp.id = $5
       RETURNING id`,
      [adminUser.dbEmail, targetProfile.email, reason || null, adminUser.uid, targetUserId]
    )

    // Audit log
    await query(
      `INSERT INTO audit_logs (actor_id, actor_email, action, entity_type, entity_id, new_value, ip_address)
       SELECT p.id, $1, 'USER_IMPERSONATED', 'profile', $2, $3, $4
       FROM profiles p WHERE p.firebase_uid = $5`,
      [
        adminUser.dbEmail,
        targetUserId,
        JSON.stringify({ target_email: targetProfile.email, reason }),
        req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        adminUser.uid,
      ]
    )

    return NextResponse.json({
      customToken,
      sessionId: session?.id,
      targetEmail: targetProfile.email,
    })
  } catch (err) {
    console.error('POST /api/admin/users/impersonate error:', err)
    return NextResponse.json({ error: 'Failed to generate impersonation token' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/users/[id]/impersonate
 * Termina una sesión de impersonación activa.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await requireSuperAdmin(req)
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { sessionId } = await req.json()

  await query(
    `UPDATE impersonation_sessions SET ended_at = NOW()
     WHERE id = $1 AND target_user_id = $2 AND ended_at IS NULL`,
    [sessionId, id]
  )

  return NextResponse.json({ ok: true })
}
