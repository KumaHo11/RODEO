'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { auth } from '@/lib/firebase/client'
import {
  onIdTokenChanged,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth'
import { cacheAuthToken, cacheProfile, getCachedProfile, getCachedAuthToken, clearAuthCache, decodeJwtExp } from '@/lib/offline/auth-cache'
import { dismissRecoveryOverlay } from '@/lib/pwa-diagnostics'
import { GA_MEASUREMENT_ID } from '@/lib/analytics'

type Profile = {
  id: string
  firebase_uid: string
  email: string
  first_name?: string
  last_name?: string
  avatar_url?: string
  organization_id?: string
  onboarding_step?: number
  team_role?: string
  permissions?: Record<string, boolean>
  country_code?: string
  role?: string
  is_first_login?: boolean
  system_role?: 'SUPER_ADMIN' | 'SUPPORT_AGENT' | null
  plan_slug?: string | null
  plan_name?: string | null
  plan_status?: string | null
  plan_trial_days?: number | null
  org_created_at?: string | null
  plan_feature_flags?: Array<{ flag_key: string; flag_value: any; flag_type: string; label?: string }>
}

type AuthContextType = {
  user: User | null
  profile: Profile | null
  isLoading: boolean
  isSuperAdmin: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isLoading: true,
  isSuperAdmin: false,
  signOut: async () => { },
  refreshProfile: async () => { },
})

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchProfile = useCallback(async (firebaseUser: User) => {
    // ── Offline fast path: use cached profile immediately ──
    // No intentar getIdToken(true) ni fetch a la API si estamos offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        // Intentar IndexedDB primero (más confiable)
        const idbProfile = await getCachedProfile()
        if (idbProfile) {
          setProfile(idbProfile)
          return
        }
        // Fallback a localStorage
        const cached = localStorage.getItem('rodeo_cached_profile')
        if (cached) {
          setProfile(JSON.parse(cached))
          return
        }
      } catch { /* ignore */ }
      // If we are here, we are supposedly offline but we have NO cache.
      // Instead of giving up and leaving the profile null, we will fall through
      // and attempt the network fetch anyway. Sometimes navigator.onLine is false
      // even when the device actually has internet access.
      console.warn('[AuthProvider] Offline but no cache found. Attempting network fetch anyway...');
    }

    try {
      // Forzar refresh del token para garantizar que el UID y claims son frescos.
      // Crítico después de la verificación de email: el token cacheado puede
      // no tener el claim email_verified=true, causando 401/404 en el backend.
      const idToken = await firebaseUser.getIdToken(/* forceRefresh */ true)

      // Timeout de 10 s (reducido de 15) para evitar que isLoading quede bloqueado si la DB tarda
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      let res: Response
      try {
        res = await fetch('/api/auth/profile?t=' + Date.now(), {
          headers: { Authorization: `Bearer ${idToken}` },
          signal: controller.signal,
          cache: 'no-store'
        })
      } finally {
        clearTimeout(timeoutId)
      }

      if (res.ok) {
        const data = await res.json()
        setProfile(data.profile)
        // Cachear perfil en IndexedDB y localStorage (redundante pero seguro)
        try {
          localStorage.setItem('rodeo_cached_profile', JSON.stringify(data.profile))
          await cacheProfile(data.profile)
        } catch { /* ignore */ }
        return
      }

      // Usuario deshabilitado por el admin → forzar cierre de sesión
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}))
        if (data.code === 'account_disabled') {
          await firebaseSignOut(auth)
          document.cookie = '__session=; path=/; max-age=0'
          window.location.href = '/login?disabled=1'
          return
        }
      }

      // Usuario autenticado en Firebase pero sin perfil en la base de datos.
      // En /register esto es esperado — la página maneja su propio flujo.
      if (res.status === 404) {
        const currentPath = window.location.pathname
        if (currentPath === '/register') {
          console.warn('[AuthProvider] Profile 404 on /register — skipping')
          setProfile(null)
          return
        }

        // Reintentamos una vez con un token fresco (race condition al crear el perfil)
        console.warn('[AuthProvider] Profile 404 — retrying once after 1.5s...')
        await new Promise(r => setTimeout(r, 1500))
        const retryToken = await firebaseUser.getIdToken(true)
        const retryRes = await fetch('/api/auth/profile?t=' + Date.now(), {
          headers: { Authorization: `Bearer ${retryToken}` },
          cache: 'no-store'
        })
        if (retryRes.ok) {
          const data = await retryRes.json()
          setProfile(data.profile)
          try {
            localStorage.setItem('rodeo_cached_profile', JSON.stringify(data.profile))
            await cacheProfile(data.profile)
          } catch { /* ignore */ }
          return
        }

        // El perfil no existe en la BD — intentar auto-crearlo con los datos del usuario Firebase
        // Esto ocurre cuando /api/auth/register falló pero el usuario Firebase sí se creó.
        console.warn('[AuthProvider] Profile still 404 — attempting auto-create via /api/auth/register')
        try {
          const freshToken = await firebaseUser.getIdToken(true)
          const autoCreate = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              idToken: freshToken,
              firstName: firebaseUser.displayName?.split(' ')[0] || '',
              lastName: firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
              phone: '',
              countryCode: 'AR',
            }),
          })
          if (autoCreate.ok) {
            // Perfil creado — buscar el perfil recién creado
            await new Promise(r => setTimeout(r, 500))
            const freshToken2 = await firebaseUser.getIdToken(true)
            const profileRes2 = await fetch('/api/auth/profile?t=' + Date.now(), {
              headers: { Authorization: `Bearer ${freshToken2}` },
              cache: 'no-store'
            })
            if (profileRes2.ok) {
              const data = await profileRes2.json()
              setProfile(data.profile)
              try {
                localStorage.setItem('rodeo_cached_profile', JSON.stringify(data.profile))
                await cacheProfile(data.profile)
              } catch { /* ignore */ }
              console.log('[AuthProvider] Profile auto-created successfully')
              return
            }
          }
        } catch (autoErr: any) {
          console.warn('[AuthProvider] Auto-create profile failed:', autoErr.message)
        }

        // Si todo falla → redirigir a registro para que el usuario complete el flujo
        console.error('[AuthProvider] Profile 404 after auto-create attempt — redirecting to register')
        await firebaseSignOut(auth)
        document.cookie = '__session=; path=/; max-age=0'
        if (currentPath !== '/login' && currentPath !== '/register') {
          window.location.href = '/register?error=profile_missing'
        }
        return
      }

      // Fallback al caché si la API falló por cualquier motivo
      try {
        const cached = localStorage.getItem('rodeo_cached_profile')
        if (cached) { setProfile(JSON.parse(cached)); return }
      } catch { /* ignore */ }
      setProfile(null)
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.warn('fetchProfile timeout — usando caché si existe')
      } else {
        console.warn('Error fetching profile (possibly offline):', err)
      }
      // Intentar desde IndexedDB primero, luego localStorage
      try {
        const idbProfile = await getCachedProfile()
        if (idbProfile) { setProfile(idbProfile); return }
      } catch { /* ignore */ }
      try {
        const cached = localStorage.getItem('rodeo_cached_profile')
        if (cached) {
          setProfile(JSON.parse(cached))
          return
        }
      } catch { /* ignore */ }
      setProfile(null)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user)
  }, [user, fetchProfile])

  useEffect(() => {
    // On mount: try to restore cookie from IndexedDB before Firebase SDK initializes
    // This is critical for iOS standalone where cookies may be purged by the OS
    const restoreCookieIfNeeded = async () => {
      if (typeof document === 'undefined') return
      const hasCookie = document.cookie.includes('__session')
      if (!hasCookie) {
        try {
          const cachedToken = await getCachedAuthToken()
          if (cachedToken) {
            const isHttps = window.location.protocol === 'https:'
            document.cookie = `__session=${cachedToken}; path=/; max-age=604800; SameSite=Lax${isHttps ? '; Secure' : ''}`
            console.log('[AuthProvider] Cookie restored from IndexedDB cache')
          }
        } catch { /* ignore */ }
      }
    }
    restoreCookieIfNeeded()

    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        // Guarda el token en cookie para el middleware
        const token = await firebaseUser.getIdToken()
        // Cachear token en IndexedDB para login offline
        const expMs = decodeJwtExp(token)
        if (expMs) cacheAuthToken(token, expMs).catch(() => { })
        // Set Secure flag only over HTTPS (production) — not in localhost dev
        // max-age=604800 (7 days) — covers rural usage patterns where users
        // may be offline for days. Token is validated server-side on each API call.
        const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'
        document.cookie = `__session=${token}; path=/; max-age=604800; SameSite=Lax${isHttps ? '; Secure' : ''}`
        await fetchProfile(firebaseUser)
        // App loaded successfully — dismiss any recovery overlay from pwa-diagnostics
        dismissRecoveryOverlay()
      } else {
        // Limpiar cookie al cerrar sesión
        document.cookie = '__session=; path=/; max-age=0'
        clearAuthCache().catch(() => { })
        setProfile(null)
      }
      setIsLoading(false)
    })

    return () => unsubscribe()
  }, [fetchProfile])

  // Initialize Google Analytics User ID
  useEffect(() => {
    const isProductionUrl = typeof window !== 'undefined' && window.location.hostname === 'rodeoagtech.com';
    if (user && GA_MEASUREMENT_ID && isProductionUrl) {
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('config', GA_MEASUREMENT_ID, {
          user_id: user.uid,
        })
      }
    }
  }, [user])

  // Fade out global native splash screen when loading finishes
  useEffect(() => {
    if (!isLoading) {
      // Pequeño delay para permitir que los Suspense boundaries de Next.js (como el login con useSearchParams) 
      // resuelvan y pinten la vista antes de quitar la pantalla verde, evitando el parpadeo blanco.
      const t = setTimeout(() => {
        const splash = document.getElementById('global-native-splash')
        if (splash) {
          splash.style.opacity = '0'
          splash.style.pointerEvents = 'none'
          setTimeout(() => { splash.style.display = 'none' }, 600)
        }
      }, 150)
      return () => clearTimeout(t)
    }
  }, [isLoading])

  const signOut = async () => {
    await firebaseSignOut(auth)
    document.cookie = '__session=; path=/; max-age=0'
  }

  const isSuperAdmin = profile?.system_role === 'SUPER_ADMIN'

  return (
    <AuthContext.Provider value={{ user, profile, isLoading, isSuperAdmin, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
