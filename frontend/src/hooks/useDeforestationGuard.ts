import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/apiFetch'

export type DeforestationStatus = {
  paddock_id: string
  status: 'CLEAN' | 'AT_RISK' | 'DEFORESTED' | 'PENDING' | 'ERROR'
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW'
  checked_at?: string
}

export function useDeforestationGuard(enabled: boolean = true) {
  const [statuses, setStatuses] = useState<DeforestationStatus[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStatuses = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const res = await apiFetch('/api/deforestation/status')
      if (res.ok) {
        const data = await res.json()
        setStatuses(Array.isArray(data) ? data : [])
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    fetchStatuses()
  }, [fetchStatuses])

  const getStatusForPaddock = useCallback((paddockId: string) => {
    return statuses.find(s => s.paddock_id === paddockId) || null
  }, [statuses])

  const checkPaddock = useCallback(async (paddockId: string) => {
    if (!enabled) return
    try {
      const res = await apiFetch('/api/deforestation/check', {
        method: 'POST',
        body: JSON.stringify({ paddock_id: paddockId })
      })
      if (res.ok) {
        await fetchStatuses() // Refresh statuses
      } else {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Error verificando deforestación')
      }
    } catch (err: any) {
      console.error(err)
      throw err
    }
  }, [fetchStatuses, enabled])

  return {
    statuses,
    loading,
    error,
    getStatusForPaddock,
    checkPaddock
  }
}
