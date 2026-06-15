import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { adminAuth } from '@/lib/firebase/admin'

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    const secret = new TextEncoder().encode(process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'default_secret')
    
    let payload;
    try {
      const result = await jwtVerify(token, secret)
      payload = result.payload
    } catch (e) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 400 })
    }

    const { uid } = payload

    if (!uid || typeof uid !== 'string') {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
    }

    // Set emailVerified to true in Firebase Auth
    await adminAuth.updateUser(uid, { emailVerified: true })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('POST /api/auth/verify-custom error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
