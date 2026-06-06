import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { query, queryOne } from '@/lib/db'

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

    // Obtener los tours actuales para hacer push
    const profile = await queryOne(
      `SELECT completed_tours FROM profiles WHERE firebase_uid = $1`,
      [decoded.uid]
    )

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const completedTours: string[] = (profile.completed_tours as string[]) || []
    
    if (!completedTours.includes(tourId)) {
      completedTours.push(tourId)
      
      // Actualizar en DB
      // Pasamos el array de strings. Node-postgres maneja los arrays si están mapeados correctamente,
      // pero para asegurarnos podemos construir el array en postgresql usando ANY o pasarlo.
      // O más fácil: usar array_append si es nativo, pero al pasarlo como $1 ya funciona.
      await query(
        `UPDATE profiles SET completed_tours = $1 WHERE firebase_uid = $2`,
        [completedTours, decoded.uid]
      )
    }

    return NextResponse.json({ ok: true, completedTours })
  } catch (err: any) {
    console.error('❌ POST /api/users/complete-onboarding error:', err)
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 })
  }
}
