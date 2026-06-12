import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { mutate, queryOne } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 })
    
    const decoded = await verifyFirebaseToken(token)
    if (!decoded?.uid) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    const body = await req.json()
    const { versionId } = body

    if (!versionId) {
      return NextResponse.json({ error: 'Version ID is required' }, { status: 400 })
    }

    // Obtener profile ID
    const profile = await queryOne<{ id: string }>(
      `SELECT id FROM profiles WHERE firebase_uid = $1 LIMIT 1`, 
      [decoded.uid]
    )

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown'

    await mutate(
      `INSERT INTO user_terms_acceptances (profile_id, version_id, ip_address)
       VALUES ($1, $2, $3)`,
      [profile.id, versionId, ipAddress]
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Error in /api/terms/accept:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
