'use client'

import { useState, useCallback, useEffect } from 'react'
import type { WeatherEvent, WeatherEventListResponse, CreateWeatherEventPayload, WeatherInsights } from '@/lib/types/weather'
import { useAuth } from '@/components/AuthProvider'

// ── useWeatherEvents ───────────────────────────────────────────────────────────

export function useWeatherEvents() {
  const { user } = useAuth()
  const [events, setEvents]         = useState<WeatherEvent[]>([])
  const [total, setTotal]           = useState(0)
  const [isLoading, setIsLoading]   = useState(true)
  const [isSaving, setIsSaving]     = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const fetchEvents = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    setError(null)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/weather?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Error al cargar eventos climáticos')
      const data: WeatherEventListResponse = await res.json()
      setEvents(data.events)
      setTotal(data.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }, [user])

  const createEvent = useCallback(async (payload: CreateWeatherEventPayload): Promise<boolean> => {
    if (!user) return false
    setIsSaving(true)
    setError(null)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/weather', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error ?? 'Error al guardar')
      }
      const data = await res.json()
      // Prepend to local state for instant feedback
      setEvents(prev => [data.event, ...prev])
      setTotal(prev => prev + 1)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      return false
    } finally {
      setIsSaving(false)
    }
  }, [user])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  return { events, total, isLoading, isSaving, error, createEvent, refetch: fetchEvents }
}

// ── useWeatherInsights ─────────────────────────────────────────────────────────

export function useWeatherInsights() {
  const { user } = useAuth()
  const [insights, setInsights]     = useState<WeatherInsights | null>(null)
  const [isLoading, setIsLoading]   = useState(true)
  const [error, setError]           = useState<string | null>(null)

  const fetchInsights = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/weather/insights', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Error al cargar insights')
      const data: WeatherInsights = await res.json()
      setInsights(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => { fetchInsights() }, [fetchInsights])

  return { insights, isLoading, error, refetch: fetchInsights }
}
