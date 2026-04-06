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
}

type AuthContextType = {
  user: User | null
  profile: Profile | null
  isLoading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isLoading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
})

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser]       = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchProfile = useCallback(async (firebaseUser: User) => {
    try {
      const idToken = await firebaseUser.getIdToken()
      const res = await fetch('/api/auth/profile', {
        headers: { Authorization: `Bearer ${idToken}` },
      })
      if (res.ok) {
        const data = await res.json()
        setProfile(data.profile)
      } else {
        setProfile(null)
      }
    } catch (err) {
      console.error('Error fetching profile:', err)
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
        document.cookie = `__session=${token}; path=/; max-age=3600; SameSite=Lax`
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

  return (
    <AuthContext.Provider value={{ user, profile, isLoading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
