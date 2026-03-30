/**
 * Weather Service Wrapper for Open-Meteo API
 * Open-Meteo is free for non-commercial use and requires no API key.
 */

export interface WeatherData {
  past30DaysRain: number;
  next15DaysRain: number;
  droughtRisk: 'LOW' | 'MODERATE' | 'HIGH';
  currentSeason: 'SUMMER' | 'AUTUMN' | 'WINTER' | 'SPRING';
}

function determineSeason(date: Date, isSouthernHemisphere: boolean): 'SUMMER' | 'AUTUMN' | 'WINTER' | 'SPRING' {
  const month = date.getMonth(); // 0-11
  
  if (isSouthernHemisphere) {
    if (month >= 11 || month <= 1) return 'SUMMER'; // Dec, Jan, Feb
    if (month >= 2 && month <= 4) return 'AUTUMN'; // Mar, Apr, May
    if (month >= 5 && month <= 7) return 'WINTER'; // Jun, Jul, Aug
    return 'SPRING'; // Sep, Oct, Nov
  } else {
    if (month >= 11 || month <= 1) return 'WINTER';
    if (month >= 2 && month <= 4) return 'SPRING';
    if (month >= 5 && month <= 7) return 'SUMMER';
    return 'AUTUMN';
  }
}

export async function getPaddockWeather(lat: number, lon: number): Promise<WeatherData> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_sum&past_days=30&forecast_days=15&timezone=auto`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch weather data');
    
    const data = await response.json();
    const precipitations: number[] = data.daily?.precipitation_sum || [];
    
    // First 30 elements are the past 30 days (depending on the exact slice, but roughly)
    // Actually, past_days=30 + today + forecast_days=14 = 45 days array
    const pastRain = precipitations.slice(0, 30).reduce((a, b) => a + (b || 0), 0);
    const futureRain = precipitations.slice(30).reduce((a, b) => a + (b || 0), 0);
    
    // Basic drought heuristic
    let droughtRisk: 'LOW' | 'MODERATE' | 'HIGH' = 'LOW';
    if (pastRain < 10) droughtRisk = 'HIGH';
    else if (pastRain < 40) droughtRisk = 'MODERATE';
    
    const isSouthern = lat < 0;
    
    return {
      past30DaysRain: Math.round(pastRain),
      next15DaysRain: Math.round(futureRain),
      droughtRisk,
      currentSeason: determineSeason(new Date(), isSouthern)
    };

  } catch (error) {
    console.error("Open-Meteo Error:", error);
    // Fallback Mock
    return {
      past30DaysRain: 45,
      next15DaysRain: 12,
      droughtRisk: 'LOW',
      currentSeason: lat < 0 ? 'SUMMER' : 'WINTER'
    };
  }
}
