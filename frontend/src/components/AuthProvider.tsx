'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { auth } from '@/lib/firebase/client'
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth'

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
  signOut: async () => {},
  refreshProfile: async () => {},
})

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser]       = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchProfile = useCallback(async (firebaseUser: User) => {
    // ── Offline fast path: use cached profile immediately ──
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        const cached = localStorage.getItem('rodeo_cached_profile')
        if (cached) {
          setProfile(JSON.parse(cached))
          return
        }
      } catch { /* ignore */ }
    }

    try {
      const idToken = await firebaseUser.getIdToken()

      // Timeout de 10 s (reducido de 15) para evitar que isLoading quede bloqueado si la DB tarda
      const controller = new AbortController()
      const timeoutId  = setTimeout(() => controller.abort(), 10000)

      let res: Response
      try {
        res = await fetch('/api/auth/profile', {
          headers: { Authorization: `Bearer ${idToken}` },
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timeoutId)
      }

      if (res.ok) {
        const data = await res.json()
        setProfile(data.profile)
        try {
          localStorage.setItem('rodeo_cached_profile', JSON.stringify(data.profile))
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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        // Guarda el token en cookie para el middleware
        const token = await firebaseUser.getIdToken()
        // Set Secure flag only over HTTPS (production) — not in localhost dev
        const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'
        document.cookie = `__session=${token}; path=/; max-age=3600; SameSite=Lax${isHttps ? '; Secure' : ''}`
        await fetchProfile(firebaseUser)
      } else {
        // Limpiar cookie al cerrar sesión
        document.cookie = '__session=; path=/; max-age=0'
        setProfile(null)
      }
      setIsLoading(false)
    })

    return () => unsubscribe()
  }, [fetchProfile])

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
