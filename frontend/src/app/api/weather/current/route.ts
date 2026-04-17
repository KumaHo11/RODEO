/**
 * GET /api/weather/current
 * Retorna clima actual + histórico 10 días + pronóstico 7 días
 * usando Open-Meteo (gratuito, sin API key) con la ubicación del campo (org).
 *
 * Query params: lat, lon (opcionales, usa org.location si no se proveen)
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { queryOne } from '@/lib/db'

// WMO Weather Code → condition + label (ES)
const WMO_MAP: Record<number, { condition: string; label: string }> = {
  0:  { condition: 'SUNNY',         label: 'Despejado' },
  1:  { condition: 'SUNNY',         label: 'Mayormente despejado' },
  2:  { condition: 'PARTLY_CLOUDY', label: 'Parcialmente nublado' },
  3:  { condition: 'CLOUDY',        label: 'Nublado' },
  45: { condition: 'FOGGY',         label: 'Niebla' },
  48: { condition: 'FOGGY',         label: 'Niebla depositante' },
  51: { condition: 'RAINY',         label: 'Llovizna leve' },
  53: { condition: 'RAINY',         label: 'Llovizna moderada' },
  55: { condition: 'RAINY',         label: 'Llovizna densa' },
  61: { condition: 'RAINY',         label: 'Lluvia leve' },
  63: { condition: 'RAINY',         label: 'Lluvia moderada' },
  65: { condition: 'RAINY',         label: 'Lluvia intensa' },
  71: { condition: 'SNOWY',         label: 'Nieve leve' },
  73: { condition: 'SNOWY',         label: 'Nieve moderada' },
  75: { condition: 'SNOWY',         label: 'Nieve intensa' },
  77: { condition: 'SNOWY',         label: 'Granizo' },
  80: { condition: 'RAINY',         label: 'Chubascos leves' },
  81: { condition: 'RAINY',         label: 'Chubascos moderados' },
  82: { condition: 'RAINY',         label: 'Chubascos intensos' },
  85: { condition: 'SNOWY',         label: 'Chubascos de nieve leves' },
  86: { condition: 'SNOWY',         label: 'Chubascos de nieve intensos' },
  95: { condition: 'STORMY',        label: 'Tormenta eléctrica' },
  96: { condition: 'STORMY',        label: 'Tormenta con granizo leve' },
  99: { condition: 'STORMY',        label: 'Tormenta con granizo intenso' },
}

function resolveWmo(code: number) {
  // Find exact match or nearest lower key
  const keys = Object.keys(WMO_MAP).map(Number).sort((a, b) => b - a)
  for (const k of keys) {
    if (code >= k) return WMO_MAP[k]
  }
  return { condition: 'PARTLY_CLOUDY', label: 'Variable' }
}

async function getAuth(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim() || ''
  if (!token) return null
  const decoded = await verifyFirebaseToken(token)
  if (!decoded) return null
  const profile = await queryOne<{ organization_id: string }>(
    'SELECT organization_id FROM profiles WHERE firebase_uid = $1',
    [decoded.uid]
  )
  if (!profile?.organization_id) return null
  return { orgId: profile.organization_id }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { searchParams } = new URL(req.url)

    // Try org location first, then query params, then default (Buenos Aires)
    let lat = parseFloat(searchParams.get('lat') ?? '')
    let lon = parseFloat(searchParams.get('lon') ?? '')

    if (isNaN(lat) || isNaN(lon)) {
      const org = await queryOne<{ location: unknown; name: string }>(
        'SELECT location, name FROM organizations WHERE id = $1',
        [auth.orgId]
      )
      const orgLoc = org?.location as { coordinates?: [number, number] } | null
      if (orgLoc?.coordinates) {
        lon = orgLoc.coordinates[0]
        lat = orgLoc.coordinates[1]
      } else {
        // Default: Buenos Aires area
        lat = -34.6; lon = -58.4
      }
    }

    // Reverse geocoding via Nominatim (OpenStreetMap, free, no key required)
    let locationName = `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`
    try {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=es`,
        { headers: { 'User-Agent': 'RodeoAgTech/1.0' }, signal: AbortSignal.timeout(3000) }
      )
      if (geoRes.ok) {
        const geo = await geoRes.json()
        const addr = geo.address ?? {}
        // Priority: village > town > city > county > state
        const place = addr.village ?? addr.town ?? addr.city ?? addr.county ?? addr.municipality ?? null
        const province = addr.state ?? addr.region ?? null
        if (place && province) {
          locationName = `${place}, ${province}`
        } else if (place) {
          locationName = place
        } else if (province) {
          locationName = province
        }
      }
    } catch {
      // Geocoding failed — keep coordinate fallback
    }

    // Fetch from Open-Meteo: past 10 days + 7 day forecast
    // hourly=temperature_2m for current temp approximation
    const url = new URL('https://api.open-meteo.com/v1/forecast')
    url.searchParams.set('latitude', String(lat))
    url.searchParams.set('longitude', String(lon))
    url.searchParams.set('daily', [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'weathercode',
      'windspeed_10m_max',
      'precipitation_probability_max',
      'relative_humidity_2m_max',
    ].join(','))
    url.searchParams.set('current_weather', 'true')
    url.searchParams.set('past_days', '10')
    url.searchParams.set('forecast_days', '7')
    url.searchParams.set('timezone', 'auto')
    url.searchParams.set('windspeed_unit', 'kmh')

    const response = await fetch(url.toString(), {
      next: { revalidate: 1800 }, // cache 30 min
    })

    if (!response.ok) {
      throw new Error(`Open-Meteo error: ${response.status}`)
    }

    const raw = await response.json()

    const daily = raw.daily ?? {}
    const dates: string[]         = daily.time ?? []
    const maxTemps: number[]      = daily.temperature_2m_max ?? []
    const minTemps: number[]      = daily.temperature_2m_min ?? []
    const precipitations: number[] = daily.precipitation_sum ?? []
    const weatherCodes: number[]  = daily.weathercode ?? []
    const windSpeeds: number[]    = daily.windspeed_10m_max ?? []
    const precipProbs: number[]   = daily.precipitation_probability_max ?? []
    const humidities: number[]    = daily.relative_humidity_2m_max ?? []

    const currentWeather = raw.current_weather ?? {}
    const today = new Date().toISOString().split('T')[0]
    const todayIndex = dates.indexOf(today)

    // Build unified day objects
    const allDays = dates.map((date, i) => ({
      date,
      maxTempC: Math.round(maxTemps[i] ?? 0),
      minTempC: Math.round(minTemps[i] ?? 0),
      precipitationMm: Math.round((precipitations[i] ?? 0) * 10) / 10,
      precipitationProbability: Math.round(precipProbs[i] ?? 0),
      windSpeedKmh: Math.round(windSpeeds[i] ?? 0),
      humidityPct: Math.round(humidities[i] ?? 0),
      weatherCode: weatherCodes[i] ?? 0,
      condition: resolveWmo(weatherCodes[i] ?? 0).condition,
      conditionLabel: resolveWmo(weatherCodes[i] ?? 0).label,
      isPast: date < today,
      isToday: date === today,
    }))

    // Past 10 days (excluding today)
    const history = allDays.filter(d => d.isPast)

    // Forecast (today + 7 days)
    const forecast = allDays.filter(d => !d.isPast)

    // Current conditions
    const currentCode = currentWeather.weathercode ?? (todayIndex >= 0 ? weatherCodes[todayIndex] : 0)
    const current = {
      tempC: Math.round(currentWeather.temperature ?? (todayIndex >= 0 ? (maxTemps[todayIndex] + minTemps[todayIndex]) / 2 : 20)),
      feelsLikeC: Math.round(currentWeather.temperature ?? 20), // Open-Meteo free tier doesn't provide feels-like
      condition: resolveWmo(currentCode).condition,
      conditionLabel: resolveWmo(currentCode).label,
      windSpeedKmh: Math.round(currentWeather.windspeed ?? (todayIndex >= 0 ? windSpeeds[todayIndex] : 0)),
      windDirection: currentWeather.winddirection ? `${currentWeather.winddirection}°` : '—',
      humidityPct: todayIndex >= 0 ? Math.round(humidities[todayIndex] ?? 0) : 0,
      weatherCode: currentCode,
      updatedAt: new Date().toISOString(),
    }

    return NextResponse.json({
      lat,
      lon,
      locationName,
      current,
      history,   // últimos 10 días
      forecast,  // próximos 7 días
    })
  } catch (err: unknown) {
    console.error('[GET /api/weather/current]', err)
    return NextResponse.json({ error: 'Error al obtener datos climáticos' }, { status: 500 })
  }
}
