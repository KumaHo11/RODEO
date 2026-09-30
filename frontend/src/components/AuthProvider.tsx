'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { auth } from '@/lib/firebase/client'
import {
  onIdTokenChanged,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth'
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
  isImpersonating: boolean
  stopImpersonation: () => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isLoading: true,
  isSuperAdmin: false,
  isImpersonating: false,
  stopImpersonation: async () => { },
  signOut: async () => { },
  refreshProfile: async () => { },
})

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isImpersonating, setIsImpersonating] = useState(false)

  const fetchProfile = useCallback(async (firebaseUser: User) => {
    try {
      // Force-refresh token to ensure claims are fresh (critical after email verification)
      const idToken = await firebaseUser.getIdToken(/* forceRefresh */ true)

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
        // Keep a localStorage copy for fast initial render on next visit
        try {
          localStorage.setItem('rodeo_cached_profile', JSON.stringify(data.profile))
        } catch { /* ignore */ }
        return
      }

      // User disabled by admin → force sign-out
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}))
        if (data.code === 'account_disabled') {
          await firebaseSignOut(auth)
          document.cookie = '__session=; path=/; max-age=0'
          window.location.href = '/login?disabled=1'
          return
        }
      }

      // User authenticated in Firebase but no DB profile yet (expected on /register)
      if (res.status === 404) {
        const currentPath = window.location.pathname
        if (currentPath === '/register') {
          setProfile(null)
          return
        }

        // Retry once (race condition during profile creation)
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
          } catch { /* ignore */ }
          return
        }

        // Attempt auto-create profile from Firebase user data
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
              } catch { /* ignore */ }
              return
            }
          }
        } catch (autoErr: any) {
          console.warn('[AuthProvider] Auto-create profile failed:', autoErr.message)
        }

        // All retries failed → redirect to register
        console.error('[AuthProvider] Profile 404 after auto-create attempt — redirecting to register')
        await firebaseSignOut(auth)
        document.cookie = '__session=; path=/; max-age=0'
        if (currentPath !== '/login' && currentPath !== '/register') {
          window.location.href = '/register?error=profile_missing'
        }
        return
      }

      // Other errors: try localStorage cache as last resort
      try {
        const cached = localStorage.getItem('rodeo_cached_profile')
        if (cached) { setProfile(JSON.parse(cached)); return }
      } catch { /* ignore */ }
      setProfile(null)
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.warn('fetchProfile timeout — trying localStorage cache')
      } else {
        console.warn('Error fetching profile:', err)
      }
      // Fallback to localStorage cache
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
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken()
        const tokenResult = await firebaseUser.getIdTokenResult()
        setIsImpersonating(!!tokenResult.claims.impersonation)
        // Set session cookie for middleware auth checks
        const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'
        document.cookie = `__session=${token}; path=/; max-age=604800; SameSite=Lax${isHttps ? '; Secure' : ''}`
        await fetchProfile(firebaseUser)
      } else {
        // Clear session on sign-out, also purge localStorage profile cache
        document.cookie = '__session=; path=/; max-age=0'
        try { localStorage.removeItem('rodeo_cached_profile') } catch { /* ignore */ }
        setProfile(null)
        setIsImpersonating(false)
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

  const signOut = async () => {
    await firebaseSignOut(auth)
    document.cookie = '__session=; path=/; max-age=0'
    try { localStorage.removeItem('rodeo_cached_profile') } catch { /* ignore */ }
  }

  const stopImpersonation = async () => {
    if (!user) return
    const token = await user.getIdToken()
    const res = await fetch('/api/admin/stop-impersonation', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) {
      alert('Error al volver al modo admin.')
      return
    }
    const { customToken } = await res.json()
    const { signInWithCustomToken } = await import('firebase/auth')
    const credential = await signInWithCustomToken(auth, customToken)
    const idToken = await credential.user.getIdToken()
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'
    document.cookie = '__session=' + idToken + '; path=/; max-age=604800; SameSite=Lax' + (isHttps ? '; Secure' : '')
    window.location.href = '/admin/users'
  }

  const isSuperAdmin = profile?.system_role === 'SUPER_ADMIN'

  return (
    <AuthContext.Provider value={{ user, profile, isLoading, isSuperAdmin, isImpersonating, stopImpersonation, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
