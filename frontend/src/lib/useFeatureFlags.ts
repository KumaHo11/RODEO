'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'

export type FeatureFlags = {
  max_paddocks:     number
  max_herds:        number
  max_team_members: number
  ndvi_access:      boolean
  ai_insights:      boolean
  offline_mode:     boolean
  voice_bitacora:   boolean
  advanced_reports: boolean
  api_access:       boolean
  [key: string]:    boolean | number | string
}

const DEFAULT_FLAGS: FeatureFlags = {
  max_paddocks:     5,
  max_herds:        1,
  max_team_members: 1,
  ndvi_access:      false,
  ai_insights:      false,
  offline_mode:     false,
  voice_bitacora:   false,
  advanced_reports: false,
  api_access:       false,
}

interface UseFeatureFlagsResult {
  flags:     FeatureFlags
  planName:  string | null
  planSlug:  string | null
  planStatus: string | null
  isLoading: boolean
  /** Verifica si el flag booleano está habilitado o si el numérico supera el threshold */
  can:       (flag: keyof FeatureFlags, threshold?: number) => boolean
  /** Retorna el valor numérico de un flag */
  limit:     (flag: keyof FeatureFlags) => number
  refresh:   () => void
}

let cachedFlags: { data: any; orgId: string; timestamp: number } | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutos

export function useFeatureFlags(): UseFeatureFlagsResult {
  const { user, profile } = useAuth()
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS)
  const [planName, setPlanName] = useState<string | null>(null)
  const [planSlug, setPlanSlug] = useState<string | null>(null)
  const [planStatus, setPlanStatus] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [refreshTick, setRefreshTick] = useState(0)

  const orgId = profile?.organization_id

  useEffect(() => {
    if (!user || !orgId) {
      setIsLoading(false)
      return
    }

    // Check cache
    const now = Date.now()
    if (cachedFlags && cachedFlags.orgId === orgId && now - cachedFlags.timestamp < CACHE_TTL) {
      const cached = cachedFlags.data
      setFlags(cached.flags)
      setPlanName(cached.planName)
      setPlanSlug(cached.planSlug)
      setPlanStatus(cached.planStatus)
      setIsLoading(false)
      return
    }

    async function load() {
      setIsLoading(true)
      try {
        const token = await user!.getIdToken()
        const res = await fetch(`/api/admin/feature-flags/resolve?org_id=${orgId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          const merged = { ...DEFAULT_FLAGS, ...(data.flags || {}) }
          setFlags(merged)
          setPlanName(data.planName)
          setPlanSlug(data.planSlug)
          setPlanStatus(data.planStatus)

          // Cache result
          cachedFlags = {
            data: { flags: merged, planName: data.planName, planSlug: data.planSlug, planStatus: data.planStatus },
            orgId: orgId!,
            timestamp: Date.now(),
          }
        }
      } catch (err) {
        console.error('useFeatureFlags error:', err)
        // Fallback to defaults on error
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [user, orgId, refreshTick])

  const can = (flag: keyof FeatureFlags, threshold?: number): boolean => {
    const val = flags[flag]
    if (typeof val === 'boolean') return val
    if (typeof val === 'number' && threshold !== undefined) return val >= threshold
    if (typeof val === 'number') return val > 0
    return Boolean(val)
  }

  const limit = (flag: keyof FeatureFlags): number => {
    const val = flags[flag]
    return typeof val === 'number' ? val : 0
  }

  const refresh = () => {
    cachedFlags = null // Invalidate cache
    setRefreshTick(t => t + 1)
  }

  return { flags, planName, planSlug, planStatus, isLoading, can, limit, refresh }
}
