'use client'
/**
 * WeatherContext — Contexto compartido de clima
 * Provee datos de Open-Meteo a ambos widgets (Panel y Clima).
 * Un único fetch por sesión garantiza paridad de datos.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WeatherDay {
  date: string
  maxTempC: number
  minTempC: number
  precipitationMm: number
  precipitationProbability: number
  windSpeedKmh: number
  humidityPct: number
  weatherCode: number
  condition: string
  conditionLabel: string
  isPast: boolean
  isToday: boolean
}

export interface CurrentWeather {
  tempC: number
  feelsLikeC: number
  condition: string
  conditionLabel: string
  windSpeedKmh: number
  windDirection: string
  humidityPct: number
  weatherCode: number
  updatedAt: string
}

export interface WeatherContextValue {
  current: CurrentWeather | null
  history: WeatherDay[]   // últimos 10 días
  forecast: WeatherDay[]  // próximos 7 días
  lat: number | null
  lon: number | null
  locationName: string | null
  locationSource: 'org' | 'fallback' | null  // 'org' = coordenadas del campo, 'fallback' = Buenos Aires
  isLoading: boolean
  error: string | null
  refetch: () => void
}

// ── Context ────────────────────────────────────────────────────────────────────

const WeatherContext = createContext<WeatherContextValue>({
  current: null,
  history: [],
  forecast: [],
  lat: null,
  lon: null,
  locationName: null,
  locationSource: null,
  isLoading: true,
  error: null,
  refetch: () => {},
})

// ── Provider ───────────────────────────────────────────────────────────────────

export function WeatherProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [current, setCurrent]         = useState<CurrentWeather | null>(null)
  const [history, setHistory]         = useState<WeatherDay[]>([])
  const [forecast, setForecast]       = useState<WeatherDay[]>([])
  const [lat, setLat]                 = useState<number | null>(null)
  const [lon, setLon]                 = useState<number | null>(null)
  const [locationName, setLocationName] = useState<string | null>(null)
  const [locationSource, setLocationSource] = useState<'org' | 'fallback' | null>(null)
  const [isLoading, setIsLoading]     = useState(true)
  const [error, setError]             = useState<string | null>(null)

  const fetchWeather = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    setError(null)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/weather/current', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Error al obtener clima')
      const data = await res.json()
      setCurrent(data.current)
      setHistory(data.history ?? [])
      setForecast(data.forecast ?? [])
      setLat(data.lat)
      setLon(data.lon)
      setLocationName(data.locationName)
      setLocationSource(data.locationSource ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) fetchWeather()
  }, [user, fetchWeather])

  return (
    <WeatherContext.Provider value={{
      current, history, forecast,
      lat, lon, locationName, locationSource,
      isLoading, error, refetch: fetchWeather,
    }}>
      {children}
    </WeatherContext.Provider>
  )
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useWeather() {
  return useContext(WeatherContext)
}

// ── WMO helpers (client-side) ──────────────────────────────────────────────────

export const CONDITION_EMOJI: Record<string, string> = {
  SUNNY:         '☀️',
  PARTLY_CLOUDY: '⛅',
  CLOUDY:        '☁️',
  RAINY:         '🌧️',
  STORMY:        '⛈️',
  FOGGY:         '🌫️',
  WINDY:         '💨',
  SNOWY:         '❄️',
}
