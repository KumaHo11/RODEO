import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { adminAuth } from '@/lib/firebase/admin'
import { sendEmail } from '@/lib/email'
import { queryOne } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()

    if (!token) {
      return NextResponse.json({ error: 'No token' }, { status: 401 })
    }

    const decodedToken = await verifyFirebaseToken(token)
    if (!decodedToken) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
    }

    const { uid, email } = decodedToken

    if (!email) {
      return NextResponse.json({ error: 'El usuario no tiene email' }, { status: 400 })
    }

    // Buscar el nombre del usuario en la base de datos
    const profile = await queryOne(`SELECT first_name FROM profiles WHERE firebase_uid = $1`, [uid])
    const firstName = String(profile?.first_name || 'Usuario')

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    let verifyUrl = `${appUrl}/login?verified=1`

    try {
      const { SignJWT } = await import('jose')
      const jwtSecret = process.env.EMAIL_VERIFY_JWT_SECRET
      if (!jwtSecret) throw new Error('EMAIL_VERIFY_JWT_SECRET is not configured')
      const secret = new TextEncoder().encode(jwtSecret)
      const jwtToken = await new SignJWT({ uid, email })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('24h')
        .sign(secret)

      verifyUrl = `${appUrl}/auth/action?mode=verifyCustom&token=${jwtToken}`
      console.log('[Resend] Email verify link generated via Custom JWT')
    } catch (tokenErr: any) {
      console.warn('[Resend] Failed to generate custom JWT:', tokenErr.message)
    }

    try {
      await sendEmail('verify_email', email, {
        firstName,
        verifyUrl,
      })
    } catch (emailErr: any) {
      console.warn('[Resend] Email send error:', emailErr.message)
      return NextResponse.json({ error: 'No se pudo enviar el correo vía SendGrid.' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err: any) {
    console.error('POST /api/auth/resend-verification error:', err)
    return NextResponse.json({ error: 'Error interno al reenviar correo.' }, { status: 500 })
  }
}
