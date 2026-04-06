/**
 * Middleware — Firebase Auth via JWT (jose)
 * Edge-compatible: NO usa firebase-admin (no funciona en Edge)
 * Verifica el ID token de Firebase con JWKS público de Google
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify, createRemoteJWKSet } from 'jose'
import { ROUTE_PERMISSION_MAP } from '@/lib/navigation'

const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!

// JWKS público de Firebase/Google — edge-compatible
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
)

async function verifyFirebaseToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    })
    return payload as { sub: string; email?: string; [key: string]: unknown }
  } catch {
    return null
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const response = NextResponse.next({ request: { headers: request.headers } })

  // 1. Root → landing
  if (pathname === '/') {
    const token = request.cookies.get('__session')?.value
    if (token) {
      const payload = await verifyFirebaseToken(token)
      if (payload) return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.redirect(new URL('/landing', request.url))
  }

  // 2. /join → siempre público
  if (pathname.startsWith('/join')) return response

  // 3. Auth routes → si ya autenticado, redirect a dashboard
  const authRoutes = ['/login', '/register', '/forgot-password', '/reset-password']
  if (authRoutes.some(r => pathname.startsWith(r))) {
    const token = request.cookies.get('__session')?.value
    if (token) {
      const payload = await verifyFirebaseToken(token)
      if (payload) return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return response
  }

  // 4. Rutas protegidas → verificar token
  const protectedRoutes = ['/dashboard', '/onboarding']
  if (protectedRoutes.some(r => pathname.startsWith(r))) {
    const token = request.cookies.get('__session')?.value

    if (!token) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }

    const payload = await verifyFirebaseToken(token)
    if (!payload) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Nota: las verificaciones de onboarding_step y permisos se hacen
    // en el AuthProvider y en cada page via /api/auth/profile
    // El middleware solo verifica autenticación básica (token válido)
    return response
  }

  // 5. /landing → si autenticado → dashboard
  if (pathname === '/landing') {
    const token = request.cookies.get('__session')?.value
    if (token) {
      const payload = await verifyFirebaseToken(token)
      if (payload) return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
