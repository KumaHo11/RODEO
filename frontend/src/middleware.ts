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
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
  {
    timeoutDuration: 3000,   // 3s — prevents hanging on iOS standalone with bad network
    cacheMaxAge: 600_000,    // 10min — reduces refetches in rural/low-connectivity
  }
)

// In-memory rate limiter (WAF / DDoS protection)
const rateLimitMap = new Map<string, { count: number, resetAt: number }>()

function checkRateLimit(request: NextRequest): boolean {
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  const now = Date.now()
  const windowMs = 60 * 1000 // 1 min
  const maxRequests = 300 // allow normal usage but block spam
  
  const record = rateLimitMap.get(ip)
  if (!record || record.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (record.count >= maxRequests) {
    return false
  }
  record.count += 1
  return true
}

/**
 * Resultado de la verificación del token Firebase.
 * - { payload } → token válido y verificado
 * - { networkError: true } → no se pudo alcanzar los servidores de Google (offline)
 * - null → token ausente, inválido o expirado
 */
type VerifyResult =
  | { payload: { sub: string; email?: string; system_role?: string; [key: string]: unknown } }
  | { networkError: true }
  | null

async function verifyFirebaseToken(token: string): Promise<VerifyResult> {
  try {
    // Wrap in AbortController for explicit timeout (belt & suspenders with jose timeout)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3500)

    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
        audience: FIREBASE_PROJECT_ID,
      })
      return { payload: payload as { sub: string; email?: string; system_role?: string; [key: string]: unknown } }
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (err: any) {
    // Distinguir error de red (offline) de token realmente inválido
    // jose lanza TypeError o errores de fetch cuando no puede contactar el JWKS endpoint
    // iOS Safari en standalone mode puede lanzar variantes adicionales
    const errMsg = (err?.message || '').toLowerCase()
    const errCode = err?.code || ''
    const isNetworkError =
      err instanceof TypeError ||                        // fetch failed
      err?.name === 'AbortError' ||                     // our timeout or jose timeout
      errCode === 'ERR_JWKS_TIMEOUT' ||                 // jose timeout
      errCode === 'ERR_JWKS_MULTIPLE_MATCHING_KEYS' ||
      errCode === 'ERR_JWKS_NO_MATCHING_KEY' ||         // stale cache
      errMsg.includes('fetch') ||
      errMsg.includes('network') ||
      errMsg.includes('enotfound') ||
      errMsg.includes('econnrefused') ||
      errMsg.includes('failed to fetch') ||
      errMsg.includes('load failed') ||                 // Safari-specific
      errMsg.includes('the internet connection appears to be offline') || // iOS Safari
      errMsg.includes('a server with the specified hostname could not be found') // iOS Safari

    if (isNetworkError) {
      console.warn('[middleware] JWKS fetch failed (offline?) — allowing pass-through')
      return { networkError: true }
    }
    // Token realmente inválido (firma incorrecta, expirado, malformado)
    return null
  }
}


/**
 * Detecta si la request viene del subdominio admin.
 * En producción: SOLO el subdominio real admin.* es válido.
 * En desarrollo: también acepta header X-Admin-Subdomain o query param ?_admin=1
 */
function isAdminSubdomain(request: NextRequest): boolean {
  const host = request.headers.get('host') || ''
  // Producción: admin.rodeo.app
  if (host.startsWith('admin.')) return true
  // Desarrollo únicamente — jamás en producción
  if (process.env.NODE_ENV !== 'production') {
    if (request.headers.get('x-admin-subdomain') === '1') return true
    if (request.nextUrl.searchParams.get('_admin') === '1') return true
  }
  return false
}

export async function middleware(request: NextRequest) {
  // WAF Rate Limiting
  if (!checkRateLimit(request)) {
    return new NextResponse(
      JSON.stringify({ error: 'Too Many Requests (WAF Blocked)' }),
      { status: 429, headers: { 'content-type': 'application/json' } }
    )
  }

  const { pathname } = request.nextUrl
  const response = NextResponse.next({ request: { headers: request.headers } })

  // Helper: create response with offline passthrough header
  const offlinePassthrough = () => {
    const r = NextResponse.next({ request: { headers: request.headers } })
    r.headers.set('X-Rodeo-Auth-Status', 'offline-passthrough')
    return r
  }

  const adminSubdomain = isAdminSubdomain(request)

  // ── ADMIN SUBDOMAIN ────────────────────────────────────────────────────
  if (adminSubdomain) {
    const adminPath = pathname === '/' ? '/admin/dashboard' : `/admin${pathname}`

    if (pathname === '/login' || pathname === '/admin-login') {
      const token = request.cookies.get('__session')?.value
      if (token) {
        const result = await verifyFirebaseToken(token)
        if (result && !('networkError' in result) && result.payload.system_role === 'SUPER_ADMIN') {
          return NextResponse.redirect(new URL('/admin/dashboard', request.url))
        }
      }
      return NextResponse.rewrite(new URL('/admin/login', request.url))
    }

    const token = request.cookies.get('__session')?.value
    if (!token) return NextResponse.redirect(new URL('/login', request.url))

    const result = await verifyFirebaseToken(token)
    // Si hay error de red (offline), permitir paso sin redirigir
    if (!result) return NextResponse.redirect(new URL('/login', request.url))
    if ('networkError' in result) return offlinePassthrough()

    if (result.payload.system_role !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL(`${process.env.NEXT_PUBLIC_APP_URL || 'https://rodeo.app'}/dashboard`, request.url))
    }
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
      const result = await verifyFirebaseToken(token)
      if (result && !('networkError' in result)) {
        if (result.payload.system_role === 'SUPER_ADMIN') {
          const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || '/admin/dashboard'
          return NextResponse.redirect(new URL(adminUrl, request.url))
        }
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
      // networkError → tiene cookie → asumir sesión válida, ir al dashboard
      if (result && 'networkError' in result) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
      // Cookie exists but token verification failed — in standalone mode,
      // allow dashboard access to avoid blank screen
      if (!result && request.headers.get('sec-fetch-mode') === 'navigate') {
        // Check if it might be a standalone PWA launch
        const isStandaloneLaunch = request.headers.get('sec-fetch-dest') === 'document'
        if (isStandaloneLaunch) {
          return NextResponse.redirect(new URL('/dashboard', request.url))
        }
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
    const result = await verifyFirebaseToken(token)
    if (!result) return NextResponse.redirect(new URL('/dashboard', request.url))
    if ('networkError' in result) return response // offline → permitir
    if (result.payload.system_role !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return response
  }

  // 4. Auth routes → si ya autenticado, redirect
  const authRoutes = ['/login', '/register', '/forgot-password', '/reset-password']
  if (authRoutes.some(r => pathname.startsWith(r))) {
    const token = request.cookies.get('__session')?.value
    if (token) {
      const result = await verifyFirebaseToken(token)
      if (result && !('networkError' in result)) {
        if (result.payload.system_role === 'SUPER_ADMIN') {
          return NextResponse.redirect(new URL('/admin/dashboard', request.url))
        }
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
      // networkError → hay cookie activa → redirect al dashboard
      if (result && 'networkError' in result) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
    return response
  }

  // 5. Rutas protegidas → verificar token
  const protectedRoutes = ['/dashboard', '/onboarding']
  const isSoporteTerminos = pathname.startsWith('/soporte/terminos-de-uso')

  if (protectedRoutes.some(r => pathname.startsWith(r)) || isSoporteTerminos) {
    const token = request.cookies.get('__session')?.value

    // Sin token en cookie → definitivamente no autenticado
    if (!token) {
      if (isSoporteTerminos) return NextResponse.redirect(new URL('/', request.url))
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }

    const result = await verifyFirebaseToken(token)

    // Token inválido (firma mala, expirado) → login
    if (!result) {
      if (isSoporteTerminos) return NextResponse.redirect(new URL('/', request.url))
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Error de red (offline) + hay cookie → permitir paso sin verificar firma
    // El cliente (Firebase SDK) ya validó la sesión en su momento
    if ('networkError' in result) return offlinePassthrough()

    // Super Admin no debería estar en /dashboard
    if (result.payload.system_role === 'SUPER_ADMIN' && !isSoporteTerminos) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url))
    }

    return response
  }

  // 6. /landing → si autenticado → dashboard
  if (pathname === '/landing') {
    const token = request.cookies.get('__session')?.value
    if (token) {
      const result = await verifyFirebaseToken(token)
      if (result && !('networkError' in result)) {
        if (result.payload.system_role === 'SUPER_ADMIN') {
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
