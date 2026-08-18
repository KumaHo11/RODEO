import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'

export function useAnimals(params: { status?: string, herd_id?: string, search?: string }) {
  const [animals, setAnimals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const { user } = useAuth()

  const fetchAnimals = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const token = await user.getIdToken()
      const searchParams = new URLSearchParams()
      if (params.status && params.status !== 'Todos') searchParams.append('status', params.status)
      if (params.herd_id) searchParams.append('herd_id', params.herd_id)
      if (params.search) searchParams.append('search', params.search)

      const res = await fetch(`/api/animals?${searchParams.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (!res.ok) throw new Error('Failed to fetch animals')
      
      const data = await res.json()
      setAnimals(data.animals || [])
    } catch (err: any) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [user, params.status, params.herd_id, params.search])

  useEffect(() => {
    fetchAnimals()
  }, [fetchAnimals])

  return {
    animals,
    total: animals.length,
    loading,
    error,
    refetch: fetchAnimals
  }
}
