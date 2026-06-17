/**
 * POST /api/admin/verify-email
 * Forces email verification for a user in Firebase (admin only)
 * Body: { email: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { serviceQueryOne } from '@/lib/db'
import { adminAuth } from '@/lib/firebase/admin'

export async function POST(req: NextRequest) {
  try {
    // Require super admin auth
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const decoded = await verifyFirebaseToken(token)
    if (!decoded) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    // Check caller is super admin
    const callerProfile = await serviceQueryOne<{ system_role: string }>(
      `SELECT system_role FROM profiles WHERE firebase_uid = $1`,
      [decoded.uid]
    )
    if (callerProfile?.system_role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Solo super admin puede usar este endpoint' }, { status: 403 })
    }

    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: 'email requerido' }, { status: 400 })

    // Look up user in Firebase by email
    const userRecord = await adminAuth.getUserByEmail(email)

    // Check DB profile
    const dbProfile = await serviceQueryOne(
      `SELECT id, firebase_uid, email, onboarding_step, is_active FROM profiles WHERE email = $1`,
      [email]
    )

    // Force verify email in Firebase
    await adminAuth.updateUser(userRecord.uid, { emailVerified: true })

    // If DB UID differs from Firebase UID, fix it
    if (dbProfile && (dbProfile as any).firebase_uid !== userRecord.uid) {
      await serviceQueryOne(
        `UPDATE profiles SET firebase_uid = $1, updated_at = NOW() WHERE email = $2`,
        [userRecord.uid, email]
      )
    }

    return NextResponse.json({
      ok: true,
      firebase: {
        uid: userRecord.uid,
        email: userRecord.email,
        emailVerified: true, // just set to true
        previouslyVerified: userRecord.emailVerified,
      },
      db: dbProfile || 'NO_PROFILE_IN_DB',
      uidMismatchFixed: dbProfile && (dbProfile as any).firebase_uid !== userRecord.uid,
    })
  } catch (err: any) {
    console.error('[admin/verify-email] Error:', err)
    if (err.code === 'auth/user-not-found') {
      return NextResponse.json({ error: 'Usuario no encontrado en Firebase' }, { status: 404 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
