/**
 * Middleware — Firebase Auth via JWT (jose) + Super Admin RBAC
 * Soporta subdomain: admin.rodeo.app → rutas /admin/*
 * Edge-compatible: NO usa firebase-admin
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify, createRemoteJWKSet } from 'jose'
import { ROUTE_PERMISSION_MAP } from '@/lib/navigation'

const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!

const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
)

async function verifyFirebaseToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    })
    return payload as { sub: string; email?: string; system_role?: string; [key: string]: unknown }
  } catch {
    return null
  }
}

/**
 * Detecta si la request viene del subdominio admin.
 * En desarrollo: usa header X-Admin-Subdomain o query param ?_admin=1
 */
function isAdminSubdomain(request: NextRequest): boolean {
  const host = request.headers.get('host') || ''
  // Producción: admin.rodeo.app
  if (host.startsWith('admin.')) return true
  // Desarrollo: header o query param
  if (request.headers.get('x-admin-subdomain') === '1') return true
  if (request.nextUrl.searchParams.get('_admin') === '1') return true
  return false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const response = NextResponse.next({ request: { headers: request.headers } })

  const adminSubdomain = isAdminSubdomain(request)

  // ── ADMIN SUBDOMAIN ────────────────────────────────────────────────────
  if (adminSubdomain) {
    // Reescribir todas las rutas al prefijo /admin/*
    const adminPath = pathname === '/' ? '/admin/dashboard' : `/admin${pathname}`

    // Rutas públicas del admin (login)
    if (pathname === '/login' || pathname === '/admin-login') {
      const token = request.cookies.get('__session')?.value
      if (token) {
        const payload = await verifyFirebaseToken(token)
        if (payload?.system_role === 'SUPER_ADMIN') {
          return NextResponse.redirect(new URL('/admin/dashboard', request.url))
        }
      }
      // Rewrite a la vista de login del admin
      return NextResponse.rewrite(new URL('/admin/login', request.url))
    }

    // Todas las demás rutas del admin requieren autenticación + SUPER_ADMIN
    const token = request.cookies.get('__session')?.value
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const payload = await verifyFirebaseToken(token)
    if (!payload) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Verificar system_role en custom claims del JWT
    // Firebase Admin SDK debe setear este claim al crear el Super Admin
    if (payload.system_role !== 'SUPER_ADMIN') {
      // Redirigir al dashboard normal si está autenticado pero no es Super Admin
      return NextResponse.redirect(new URL(`${process.env.NEXT_PUBLIC_APP_URL || 'https://rodeo.app'}/dashboard`, request.url))
    }

    // Rewrite a /admin/* si no está ya en ese prefijo
    if (!pathname.startsWith('/admin')) {
      return NextResponse.rewrite(new URL(adminPath, request.url))
    }

    return response
  }

  // ── MAIN APP ────────────────────────────────────────────────────────────

  // 1. Root → landing
  if (pathname === '/') {
    const token = request.cookies.get('__session')?.value
    if (token) {
      const payload = await verifyFirebaseToken(token)
      if (payload) {
        // Super Admin en app principal → redirect al admin
        if (payload.system_role === 'SUPER_ADMIN') {
          const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || '/admin/dashboard'
          return NextResponse.redirect(new URL(adminUrl, request.url))
        }
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
    return NextResponse.redirect(new URL('/landing', request.url))
  }

  // 2. /join → siempre público
  if (pathname.startsWith('/join')) return response

  // 3. /admin/* en la app principal → solo accesible con SUPER_ADMIN
  if (pathname.startsWith('/admin')) {
    const token = request.cookies.get('__session')?.value
    if (!token) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }
    const payload = await verifyFirebaseToken(token)
    if (!payload || payload.system_role !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return response
  }

  // 4. Auth routes → si ya autenticado, redirect
  const authRoutes = ['/login', '/register', '/forgot-password', '/reset-password']
  if (authRoutes.some(r => pathname.startsWith(r))) {
    const token = request.cookies.get('__session')?.value
    if (token) {
      const payload = await verifyFirebaseToken(token)
      if (payload) {
        if (payload.system_role === 'SUPER_ADMIN') {
          return NextResponse.redirect(new URL('/admin/dashboard', request.url))
        }
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
    return response
  }

  // 5. Rutas protegidas → verificar token
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

    // Super Admin no debería estar en /dashboard — redirect al admin
    if (payload.system_role === 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url))
    }

    return response
  }

  // 6. /landing → si autenticado → dashboard
  if (pathname === '/landing') {
    const token = request.cookies.get('__session')?.value
    if (token) {
      const payload = await verifyFirebaseToken(token)
      if (payload) {
        if (payload.system_role === 'SUPER_ADMIN') {
          return NextResponse.redirect(new URL('/admin/dashboard', request.url))
        }
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
