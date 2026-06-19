import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { serviceQuery, serviceQueryOne, serviceMutate } from '@/lib/db'

export async function POST(req: NextRequest) {
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

    const { tourId } = await req.json()
    if (!tourId) {
      return NextResponse.json({ error: 'Missing tourId parameter' }, { status: 400 })
    }

    await serviceMutate(
      `UPDATE profiles 
       SET completed_tours = array_append(COALESCE(completed_tours, ARRAY[]::text[]), $1) 
       WHERE firebase_uid = $2 
       AND NOT ($1 = ANY(COALESCE(completed_tours, ARRAY[]::text[])))`,
      [tourId, decoded.uid]
    )

    // Opcional: obtener los tours para retornar, aunque no es estrictamente necesario
    const profile = await serviceQueryOne<{ completed_tours: string[] }>(
      `SELECT completed_tours FROM profiles WHERE firebase_uid = $1`,
      [decoded.uid]
    )
    const completedTours = profile?.completed_tours || [tourId]

    return NextResponse.json({ ok: true, completedTours })
  } catch (err: any) {
    console.error('❌ POST /api/users/complete-onboarding error:', err)
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 })
  }
}
