'use client'
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import { apiFetch } from '@/lib/apiFetch'
import { useAuth } from '@/components/AuthProvider'
import { usePlan } from '@/hooks/usePlan'

export interface ClimateSnapshot {
  id: string
  paddock_id: string
  paddock_name: string
  area_ha: number
  ndvi: number
  rainfall_7d_mm: number
  humidity_pct: number
  drought_index: string
  forage_ms_ha: number
  total_ev: number
  grass_growth_rate: number
  climate_multiplier: number
  base_remaining_days: number
  adjusted_remaining_days: number
  alert_level: 'ok' | 'warning' | 'critical'
  alert_message: string | null
  delta_from_plan: number
  calculated_at: string
  multiplier_breakdown?: any
}

interface ClimateAnalyticsContextValue {
  snapshots: ClimateSnapshot[]
  latestByPaddock: Map<string, ClimateSnapshot>
  avgGrowthRate: number
  totalRainfall7d: number
  isLoading: boolean
  refreshSnapshots: () => Promise<void>
}

const ClimateAnalyticsContext = createContext<ClimateAnalyticsContextValue>({
  snapshots: [],
  latestByPaddock: new Map(),
  avgGrowthRate: 0,
  totalRainfall7d: 0,
  isLoading: true,
  refreshSnapshots: async () => {},
})

export function ClimateAnalyticsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const { hasFeature } = usePlan()
  const hasAccess = hasFeature('climate_adjustment')
  
  const [snapshots, setSnapshots] = useState<ClimateSnapshot[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchSnapshots = useCallback(async () => {
    if (!user || !hasAccess) {
      setIsLoading(false)
      return
    }
    try {
      const res = await apiFetch('/api/climate-adjustment')
      if (res.ok) {
        const data = await res.json()
        setSnapshots(data.snapshots ?? [])
      }
    } catch (err) {
      console.error('[ClimateAnalyticsProvider] Error fetching snapshots:', err)
    } finally {
      setIsLoading(false)
    }
  }, [user, hasAccess])

  useEffect(() => {
    fetchSnapshots()
  }, [fetchSnapshots])

  const { latestByPaddock, avgGrowthRate, totalRainfall7d } = useMemo(() => {
    const map = new Map<string, ClimateSnapshot>()
    for (const s of snapshots) {
      if (!map.has(s.paddock_id)) {
        map.set(s.paddock_id, s)
      }
    }
    
    let totalGrowth = 0
    let maxRainfall = 0
    let count = 0
    for (const snap of map.values()) {
      totalGrowth += Number(snap.grass_growth_rate) || 0
      maxRainfall = Math.max(maxRainfall, Number(snap.rainfall_7d_mm) || 0)
      count++
    }
    
    return {
      latestByPaddock: map,
      avgGrowthRate: count > 0 ? parseFloat((totalGrowth / count).toFixed(1)) : 20, // 20 default
      totalRainfall7d: maxRainfall, // Using max across paddocks since they usually share weather
    }
  }, [snapshots])

  return (
    <ClimateAnalyticsContext.Provider value={{
      snapshots,
      latestByPaddock,
      avgGrowthRate,
      totalRainfall7d,
      isLoading,
      refreshSnapshots: fetchSnapshots,
    }}>
      {children}
    </ClimateAnalyticsContext.Provider>
  )
}

export function useClimateAnalytics() {
  return useContext(ClimateAnalyticsContext)
}
