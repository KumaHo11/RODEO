/**
 * POST /api/auth/set-password
 * Sets the password for the authenticated user via Firebase Admin SDK.
 * Used for guest setup flow where updatePassword() may fail due to re-auth requirements.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { adminAuth } from '@/lib/firebase/admin'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const decoded = await verifyFirebaseToken(token)
    if (!decoded) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const { password } = await req.json()
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
    }

    // Update password via Admin SDK — no re-auth required
    await adminAuth.updateUser(decoded.uid, { password })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('POST /api/auth/set-password error:', err)
    return NextResponse.json({ error: 'Error al actualizar contraseña' }, { status: 500 })
  }
}
