import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { serviceQueryOne } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) {
      return NextResponse.json({ error: 'No token' }, { status: 401 })
    }

    const decoded = await verifyFirebaseToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const tourId = searchParams.get('tourId')
    
    if (!tourId) {
      return NextResponse.json({ error: 'Missing tourId parameter' }, { status: 400 })
    }

    // Buscar el campo completed_tours en el perfil
    const profile = await serviceQueryOne(
      `SELECT completed_tours FROM profiles WHERE firebase_uid = $1`,
      [decoded.uid]
    )

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const completedTours: string[] = (profile.completed_tours as string[]) || []
    const hasCompleted = completedTours.includes(tourId)

    return NextResponse.json({ hasCompleted })
  } catch (err: any) {
    console.error('❌ GET /api/users/onboarding-status error:', err)
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 })
  }
}
