/**
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  RODEO — Weather Domain Types                                        │
 * │  Interfaces para el módulo de Clima                                  │
 * └─────────────────────────────────────────────────────────────────────┘
 */

// ── Enums ──────────────────────────────────────────────────────────────────────

export type WeatherEventType = 'RAIN' | 'FROST'

export type WeatherCondition =
  | 'SUNNY'
  | 'PARTLY_CLOUDY'
  | 'CLOUDY'
  | 'RAINY'
  | 'STORMY'
  | 'FOGGY'
  | 'WINDY'
  | 'SNOWY'

// ── Core Domain Models ─────────────────────────────────────────────────────────

export interface WeatherEventPaddock {
  weatherEventId: string
  paddockId: string
  createdAt: string
  paddock?: {
    id: string
    name: string
    areaHa: number | null
  }
}

export interface WeatherEvent {
  id: string
  orgId: string
  recorderId: string | null
  type: WeatherEventType
  /** mm de lluvia o °C en heladas */
  value: number
  date: string         // ISO date string (YYYY-MM-DD)
  notes: string | null
  createdAt: string
  updatedAt: string
  paddocks: WeatherEventPaddock[]
  recorder?: {
    id: string
    firstName: string | null
    lastName: string | null
  } | null
}

// ── API Payloads ───────────────────────────────────────────────────────────────

export interface CreateWeatherEventPayload {
  type: WeatherEventType
  value: number
  date: string
  paddockIds: string[]
  notes?: string
}

export interface WeatherEventListResponse {
  events: WeatherEvent[]
  total: number
}

// ── Channel Weather API (mock-ready interfaces) ────────────────────────────────

export interface ChannelWeatherForecastDay {
  date: string
  maxTempC: number
  minTempC: number
  condition: WeatherCondition
  precipitationMm: number
  precipitationProbability: number
}

export interface ChannelWeatherCurrent {
  tempC: number
  feelsLikeC: number
  condition: WeatherCondition
  humidityPct: number
  windSpeedKmh: number
  windDirection: string
  uvIndex: number
  visibilityKm: number
  updatedAt: string // ISO datetime
}

export interface ChannelWeatherResponse {
  locationName: string
  lat: number
  lon: number
  current: ChannelWeatherCurrent
  forecast: ChannelWeatherForecastDay[]  // próximos 3-5 días
}

// ── Insights & Metrics ─────────────────────────────────────────────────────────

export interface PaddockRainfallStat {
  paddockId: string
  paddockName: string
  totalMm: number
  eventCount: number
}

export interface PaddockFrostStat {
  paddockId: string
  paddockName: string
  frostEventCount: number
  minTempC: number    // temperatura mínima registrada
}

export interface BlindPaddock {
  paddockId: string
  paddockName: string
  daysSinceLastEvent: number | null   // null = nunca tuvo registro
}

export interface WeatherInsights {
  topRainfallPaddocks: PaddockRainfallStat[]
  topFrostPaddocks: PaddockFrostStat[]
  blindPaddocks: BlindPaddock[]
  computedAt: string
}

// ── Mock data helper type ──────────────────────────────────────────────────────

export const WEATHER_CONDITION_LABELS: Record<WeatherCondition, string> = {
  SUNNY:         'Soleado',
  PARTLY_CLOUDY: 'Parcialmente nublado',
  CLOUDY:        'Nublado',
  RAINY:         'Lluvioso',
  STORMY:        'Tormentoso',
  FOGGY:         'Niebla',
  WINDY:         'Ventoso',
  SNOWY:         'Nevado',
}

export const WEATHER_EVENT_LABELS: Record<WeatherEventType, string> = {
  RAIN:  'Lluvia',
  FROST: 'Helada',
}
