import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/apiFetch'

export interface ComplianceScore {
  total: number
  breakdown: Record<string, { score: number, max: number, met: boolean }>
}

export interface PaddockDetail {
  id: string
  name: string
  ndvi: string
  ndviTrend: number
  deforest: string
  fCover: string
  eudr: number
  eov: number
}

export interface Recommendation {
  paddockId: string
  paddockName: string
  level: 'URGENTE' | 'ADVERTENCIA'
  message: string
}

export interface ComplianceData {
  scores: {
    eudr: ComplianceScore
    eov: ComplianceScore
    grsb: ComplianceScore
  }
  paddocks_detail: PaddockDetail[]
  recommendations: Recommendation[]
  last_updated: string
}

export function useCompliance() {
  const [data, setData] = useState<ComplianceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refetch = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const res = await apiFetch('/api/metrics/compliance')
        const dataJson = await res.json()
        if (!cancelled) {
          setData(dataJson)
          setLoading(false)
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Error loading compliance data')
          setLoading(false)
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [tick])

  return { 
    scores: data?.scores, 
    paddocksDetail: data?.paddocks_detail, 
    recommendations: data?.recommendations, 
    lastUpdated: data?.last_updated,
    loading, 
    error, 
    refetch 
  }
}
