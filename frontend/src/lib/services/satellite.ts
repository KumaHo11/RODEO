import { apiFetch } from '@/lib/apiFetch'

/**
 * Satellite Service — Real NDVI via Earth Search (Sentinel-2) + TiTiler
 * Free, no API key required. Fallback to deterministic mock if unavailable.
 */

export interface SatelliteData {
  averageNdvi: number
  grazableAreaPct: number
  estimatedAvailableDryMatterHa: number
  captureDate: string
  source: 'sentinel-2-l2a' | 'estimated'
  cloudCover?: number | null
}

// In-memory cache to avoid repeated API calls (per paddock per session)
const ndviCache = new Map<string, SatelliteData>()

export async function getPaddockNDVI(
  geojsonPolygon: any,
  paddock_id: string,
  area_ha: number
): Promise<SatelliteData> {
  // Return cached result if available
  if (ndviCache.has(paddock_id)) {
    return ndviCache.get(paddock_id)!
  }

  // If no geometry, return deterministic estimate based on area + id
  if (!geojsonPolygon) {
    return deterministicFallback(paddock_id, area_ha)
  }

  try {
    const res = await apiFetch('/api/ndvi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        geojson: geojsonPolygon,
        paddock_id,
      }),
    })

    if (!res.ok) throw new Error(`NDVI API error ${res.status}`)

    const data = await res.json()
    const result: SatelliteData = {
      averageNdvi: data.averageNdvi,
      grazableAreaPct: data.grazableAreaPct,
      estimatedAvailableDryMatterHa: data.estimatedAvailableDryMatterHa,
      captureDate: data.captureDate,
      source: data.source,
      cloudCover: data.cloudCover,
    }

    ndviCache.set(paddock_id, result)
    return result
  } catch (err) {
    console.warn('[Satellite] Falling back to estimate:', err)
    return deterministicFallback(paddock_id, area_ha)
  }
}

function deterministicFallback(paddock_id: string, area_ha: number): SatelliteData {
  // Deterministic hash from paddock ID — consistent per paddock
  let hash = 0
  for (let i = 0; i < paddock_id.length; i++) {
    hash = ((hash << 5) - hash) + paddock_id.charCodeAt(i)
    hash |= 0
  }
  const normalized = (Math.abs(hash) % 1000) / 1000
  const ndvi = Number((0.35 + normalized * 0.43).toFixed(3))
  const dryMatterKgHa = Math.round(600 + normalized * 1800)

  return {
    averageNdvi: ndvi,
    grazableAreaPct: Number((84 + normalized * 12).toFixed(1)),
    estimatedAvailableDryMatterHa: dryMatterKgHa,
    captureDate: new Date().toISOString().split('T')[0],
    source: 'estimated',
    cloudCover: null,
  }
}
