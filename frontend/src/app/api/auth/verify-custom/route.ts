import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { adminAuth } from '@/lib/firebase/admin'

/**
 * POST /api/auth/verify-custom
 * 
 * Verifies a custom JWT token from the verification email,
 * then marks the user's email as verified in Firebase Auth.
 * 
 * This is the handler for the verifyCustom mode in the auth action page.
 */
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    // ── Step 1: Verify the JWT secret is configured ──
    const jwtSecret = process.env.EMAIL_VERIFY_JWT_SECRET
    if (!jwtSecret) {
      console.error('[verify-custom] EMAIL_VERIFY_JWT_SECRET is not configured')
      return NextResponse.json({ error: 'Error de configuración del servidor' }, { status: 500 })
    }
    const secret = new TextEncoder().encode(jwtSecret)
    
    // ── Step 2: Verify and decode the JWT ──
    let payload;
    try {
      const result = await jwtVerify(token, secret)
      payload = result.payload
    } catch (e: any) {
      console.error('[verify-custom] JWT verification failed:', e.code || e.message)
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 400 })
    }

    const { uid, email } = payload

    if (!uid || typeof uid !== 'string') {
      console.error('[verify-custom] Invalid payload — uid missing or not string:', { uid, email })
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
    }

    console.log(`[verify-custom] Processing verification for uid=${uid}, email=${email}`)

    // ── Step 3: Mark email as verified in Firebase Auth ──
    try {
      await adminAuth.updateUser(uid, { emailVerified: true })
      console.log(`[verify-custom] ✓ emailVerified set to true for uid=${uid}`)
    } catch (firebaseErr: any) {
      const errCode = firebaseErr.code || firebaseErr.errorInfo?.code || 'unknown'
      const errMsg = firebaseErr.message || 'unknown error'
      console.error(`[verify-custom] ⚠ Firebase Admin updateUser FAILED for uid=${uid}:`, JSON.stringify({
        code: errCode,
        message: errMsg,
        errorInfo: firebaseErr.errorInfo,
        fullError: String(firebaseErr),
        stack: firebaseErr.stack?.split('\n').slice(0, 5).join('\n'),
      }, null, 2))
      
      // User doesn't exist in this Firebase project (possible project mismatch)
      if (errCode === 'auth/user-not-found') {
        return NextResponse.json(
          { error: 'Usuario no encontrado en Firebase. Registrate nuevamente.' },
          { status: 404 }
        )
      }
      
      // Firebase Admin credentials issue
      if (errCode === 'app/invalid-credential' || 
          errCode === 'auth/insufficient-permission' ||
          errMsg.includes('credential') ||
          errMsg.includes('PERMISSION_DENIED')) {
        console.error('[verify-custom] ⚠ Firebase Admin credentials/permissions issue — check SA roles')
        return NextResponse.json(
          { error: 'Error de permisos del servidor. Contactá a soporte.' },
          { status: 500 }
        )
      }

      // For any other Firebase Admin error, return a descriptive 500
      return NextResponse.json(
        { error: `Error al verificar email: ${errCode}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    // This catches errors from req.json(), admin initialization, etc.
    console.error('POST /api/auth/verify-custom UNHANDLED error:', err?.message || err)
    console.error('Stack:', err?.stack?.split('\n').slice(0, 5).join('\n'))
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
