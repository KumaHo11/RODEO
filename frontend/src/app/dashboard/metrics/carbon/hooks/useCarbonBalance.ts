import { useState, useEffect, useCallback } from 'react'

export interface PaddockCarbon {
  paddock_id: string
  name: string
  area_ha: number
  avg_head_count: number
  gross_tco2e: number
  sequestration_tco2e: number
  net_balance_tco2e: number
}

export interface CarbonSummary {
  total_gross_tco2e: number
  total_sequestration_tco2e: number
  net_balance_tco2e: number
  paddocks: PaddockCarbon[]
  months: any[]
}

export function useCarbonBalance(year: string) {
  const [summary, setSummary] = useState<CarbonSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBalance = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/carbon/summary?year=${year}`)
      if (!res.ok) throw new Error('Failed to load carbon summary')
      const data = await res.json()
      setSummary(data)
    } catch (err: any) {
      setError(err.message || 'Error fetching carbon data')
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  return {
    summary,
    paddockBreakdown: summary?.paddocks || [],
    loading,
    error,
    refetch: fetchBalance
  }
}
