import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ROUTE_PERMISSION_MAP } from '@/lib/navigation'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Build a response we can modify
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  // Create a Supabase client that works in middleware (Edge runtime)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — this is critical to keep cookies fresh
  const { data: { user } } = await supabase.auth.getUser()

  // ── Redirect rules ─────────────────────────────────────────────────────────

  // 1. Root → landing page (or dashboard if already logged in)
  if (pathname === '/') {
    if (user) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.redirect(new URL('/landing', request.url))
  }

  // 2. /join is always public — allow without auth
  if (pathname.startsWith('/join')) {
    return response
  }

  // 3. Auth routes (/login, /register, /forgot-password, /reset-password)
  //    If user is already authenticated → send to /dashboard
  const authRoutes = ['/login', '/register', '/forgot-password', '/reset-password']
  if (authRoutes.some(r => pathname.startsWith(r))) {
    if (user) {
      // Fetch profile to check onboarding step
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_step,team_role')
        .eq('id', user.id)
        .single()

      // Guests (has team_role) skip owner onboarding
      if (profile?.team_role && profile.team_role !== 'OWNER') {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }

      if (profile && profile.onboarding_step < 3) {
        return NextResponse.redirect(new URL('/onboarding', request.url))
      }
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return response
  }

  // 4. Protected routes (/dashboard/*, /onboarding)
  //    If NOT authenticated → redirect to /login
  const protectedRoutes = ['/dashboard', '/onboarding']
  if (protectedRoutes.some(r => pathname.startsWith(r))) {
    if (!user) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Fetch full profile for guests to check:
    // a) onboarding completion
    // b) module permissions
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_step,team_role,permissions')
      .eq('id', user.id)
      .single()

    // ── Guest setup: if invited user hasn't set their name/password yet ──
    // We signal this via a custom flag: onboarding_step = -1 for new invitees
    if (
      profile?.team_role &&
      profile.team_role !== 'OWNER' &&
      profile.onboarding_step === -1 &&
      !pathname.startsWith('/dashboard/guest-setup')
    ) {
      return NextResponse.redirect(new URL('/dashboard/guest-setup', request.url))
    }

    // ── Owner onboarding ──
    if (!pathname.startsWith('/onboarding') && !pathname.startsWith('/dashboard/guest-setup')) {
      // Only enforce for owners
      if (!profile?.team_role || profile.team_role === 'OWNER') {
        if (profile && profile.onboarding_step < 3) {
          return NextResponse.redirect(new URL('/onboarding', request.url))
        }
      }
    }

    // ── Permission check for module-specific routes ──
    const permKey = Object.entries(ROUTE_PERMISSION_MAP).find(
      ([route]) => pathname === route || pathname.startsWith(route + '/')
    )?.[1]

    if (permKey && profile?.team_role && profile.team_role !== 'OWNER') {
      const perms = profile.permissions as Record<string, boolean> | null
      if (!perms || perms[permKey] !== true) {
        // Redirect to dashboard (not 403 page, to keep UX smooth)
        return NextResponse.redirect(new URL('/dashboard?unauthorized=1', request.url))
      }
    }

    return response
  }

  // 5. /landing → redirect logged-in users to dashboard
  if (pathname === '/landing' && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files
     * - API routes (handled separately)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
