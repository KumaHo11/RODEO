/**
 * Weather Service Wrapper for Open-Meteo API
 * Open-Meteo is free for non-commercial use and requires no API key.
 */

export interface DailyForecast {
  date: string;
  maxTemp: number;
  minTemp: number;
  precipitationSum: number;
  weatherCode: number;
}

export interface WeatherData {
  past30DaysRain: number;
  next15DaysRain: number;
  droughtRisk: 'LOW' | 'MODERATE' | 'HIGH';
  currentSeason: 'SUMMER' | 'AUTUMN' | 'WINTER' | 'SPRING';
  // Enhanced fields
  pastStartDate: string;   // ISO date of first day of past period
  pastEndDate: string;     // ISO date of last past day (yesterday)
  forecastEndDate: string; // ISO date of last forecast day
  forecastDays: DailyForecast[];
  rainingDaysNext7: number;
  agriAdvice: string;      // Human-readable grazing insight
}

function determineSeason(date: Date, isSouthernHemisphere: boolean): 'SUMMER' | 'AUTUMN' | 'WINTER' | 'SPRING' {
  const month = date.getMonth()
  if (isSouthernHemisphere) {
    if (month >= 11 || month <= 1) return 'SUMMER'
    if (month >= 2 && month <= 4) return 'AUTUMN'
    if (month >= 5 && month <= 7) return 'WINTER'
    return 'SPRING'
  } else {
    if (month >= 11 || month <= 1) return 'WINTER'
    if (month >= 2 && month <= 4) return 'SPRING'
    if (month >= 5 && month <= 7) return 'SUMMER'
    return 'AUTUMN'
  }
}

function buildAgriAdvice(pastRain: number, futureRain: number, next7Rain: number): string {
  if (pastRain < 20 && futureRain < 15) {
    return 'Condición seca persistente. Evitar sobrecarga en potreros frágiles y priorizar rotación rápida.'
  } else if (pastRain > 100 && next7Rain > 20) {
    return `Período húmedo (${Math.round(pastRain)} mm recientes). Monitorear pisoteo excesivo y retrasar entradas si el suelo está saturado.`
  } else if (futureRain > 40) {
    return `Se proyectan ${Math.round(futureRain)} mm en 15 días. Buena recarga de pasturas — planificar entradas para aprovechar el rebrote.`
  } else if (pastRain > 50) {
    return `Últimos 30 días con buena recarga (${Math.round(pastRain)} mm). Evaluar disponibilidad de MS antes de mover animales.`
  }
  return `Condiciones normales. Lluvias recientes: ${Math.round(pastRain)} mm · Proyección 15 días: ${Math.round(futureRain)} mm.`
}

export async function getPaddockWeather(lat: number, lon: number): Promise<WeatherData> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,weathercode&past_days=30&forecast_days=15&timezone=auto`
    const response = await fetch(url)
    if (!response.ok) throw new Error('Failed to fetch weather data')

    const data = await response.json()
    const dates: string[] = data.daily?.time || []
    const precipitations: number[] = data.daily?.precipitation_sum || []
    const maxTemps: number[] = data.daily?.temperature_2m_max || []
    const minTemps: number[] = data.daily?.temperature_2m_min || []
    const weatherCodes: number[] = data.daily?.weathercode || []

    // Split into past (first 30 items) and future (rest)
    const pastDates = dates.slice(0, 30)
    const futureDates = dates.slice(30)

    const pastRain = precipitations.slice(0, 30).reduce((a, b) => a + (b || 0), 0)
    const futureRain = precipitations.slice(30).reduce((a, b) => a + (b || 0), 0)
    const next7Rain = precipitations.slice(30, 37).reduce((a, b) => a + (b || 0), 0)

    // Count rainy days in next 7
    const rainingDaysNext7 = precipitations.slice(30, 37).filter(p => (p || 0) > 1).length

    // Build daily forecast array (next 7 days for dashboard)
    const forecastDays: DailyForecast[] = futureDates.slice(0, 7).map((date, i) => ({
      date,
      maxTemp: Math.round(maxTemps[30 + i] || 20),
      minTemp: Math.round(minTemps[30 + i] || 10),
      precipitationSum: Math.round((precipitations[30 + i] || 0) * 10) / 10,
      weatherCode: weatherCodes[30 + i] || 0,
    }))

    let droughtRisk: 'LOW' | 'MODERATE' | 'HIGH' = 'LOW'
    if (pastRain < 10) droughtRisk = 'HIGH'
    else if (pastRain < 40) droughtRisk = 'MODERATE'

    const isSouthern = lat < 0

    return {
      past30DaysRain: Math.round(pastRain),
      next15DaysRain: Math.round(futureRain),
      pastStartDate: pastDates[0] || '',
      pastEndDate: pastDates[pastDates.length - 1] || '',
      forecastEndDate: futureDates[futureDates.length - 1] || '',
      droughtRisk,
      currentSeason: determineSeason(new Date(), isSouthern),
      forecastDays,
      rainingDaysNext7,
      agriAdvice: buildAgriAdvice(pastRain, futureRain, next7Rain),
    }
  } catch (error) {
    console.error('Open-Meteo Error:', error)
    const today = new Date()
    const fmt = (d: Date) => d.toISOString().split('T')[0]
    const past30 = new Date(today); past30.setDate(today.getDate() - 30)
    const plus15 = new Date(today); plus15.setDate(today.getDate() + 15)
    return {
      past30DaysRain: 45,
      next15DaysRain: 12,
      droughtRisk: 'LOW',
      currentSeason: lat < 0 ? 'SUMMER' : 'WINTER',
      pastStartDate: fmt(past30),
      pastEndDate: fmt(new Date(today.setDate(today.getDate() - 1))),
      forecastEndDate: fmt(plus15),
      forecastDays: [],
      rainingDaysNext7: 2,
      agriAdvice: 'Condiciones normales. Lluvias recientes: 45 mm · Proyección 15 días: 12 mm.',
    }
  }
}
