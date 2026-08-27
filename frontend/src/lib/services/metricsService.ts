import { apiFetch } from '@/lib/apiFetch'

/**
 * Metrics Service — Multi-index satellite metrics via Earth Search (Sentinel-2) + TiTiler
 * Free, no API key required. Returns all available spectral indices for a paddock polygon.
 */

export interface MetricsData {
  indices: Array<{ metricType: string; value: number; unit: string; confidence: string }>
  captureDate: string
  source: 'sentinel-2-l2a' | 'estimated'
  cloudCover?: number | null
}

// In-memory cache to avoid repeated API calls (per paddock per session)
const metricsCache = new Map<string, MetricsData>()

export async function getPaddockMetrics(
  geojsonPolygon: any,
  paddock_id: string,
): Promise<MetricsData | null> {
  // Return cached result if available
  if (metricsCache.has(paddock_id)) {
    return metricsCache.get(paddock_id)!
  }

  // If no geometry, return null — manual paddocks have no satellite footprint
  if (!geojsonPolygon) {
    return null
  }

  try {
    const res = await apiFetch('/api/metrics/indices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        geojson: geojsonPolygon,
        paddock_id,
      }),
    })

    if (!res.ok) throw new Error(`Metrics API error ${res.status}`)

    const data = await res.json()
    const result: MetricsData = {
      indices: data.indices,
      captureDate: data.captureDate,
      source: data.source,
      cloudCover: data.cloudCover,
    }

    metricsCache.set(paddock_id, result)
    return result
  } catch (err) {
    console.warn('[MetricsService] Metrics unavailable:', err)
    return null
  }
}
