import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { serviceQueryOne, serviceQuery } from '@/lib/db'
import { adminAuth } from '@/lib/firebase/admin'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid token' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '').trim()
    const decoded = await verifyFirebaseToken(token)

    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Check if the current token is an impersonation token
    if (decoded.impersonation !== true || !decoded.impersonated_by) {
      return NextResponse.json({ error: 'Not in impersonation mode' }, { status: 400 })
    }

    const adminUid = decoded.impersonated_by as string

    // Verify the original admin still has SUPER_ADMIN rights
    const adminProfile = await serviceQueryOne<{ id: string; system_role: string; email: string }>(
      `SELECT id, system_role, email FROM profiles WHERE firebase_uid = $1`,
      [adminUid]
    )

    if (!adminProfile || adminProfile.system_role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Admin privileges revoked or not found' }, { status: 403 })
    }

    // Generate a fresh token for the super admin
    const customToken = await adminAuth.createCustomToken(adminUid)

    // Optional: Log the return action in audit logs
    await serviceQuery(
      `INSERT INTO audit_logs (actor_id, actor_email, action, entity_type, entity_id, ip_address)
       VALUES ($1, $2, 'USER_STOPPED_IMPERSONATING', 'profile', $3, $4)`,
      [
        adminProfile.id,
        adminProfile.email,
        decoded.uid, // The user that was being impersonated
        req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
      ]
    )

    return NextResponse.json({ customToken })
  } catch (error) {
    console.error('POST /api/admin/stop-impersonation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
