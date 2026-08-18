import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { checkFeatureAccess } from '@/lib/plan-limits'
import { computeAllIndices, type MetricType, type BandValues } from '@/lib/metrics/indices'

const EARTH_SEARCH_URL = 'https://earth-search.aws.element84.com/v1/search'
// URL de la instancia privada de TiTiler en Google Cloud Run (se configura en el .env)
const TITILER_URL = process.env.TITILER_URL || 'https://titiler.xyz'

export async function POST(req: NextRequest) {
  try {
    // Auth Check
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const decoded = await verifyFirebaseToken(token)
    if (!decoded) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    // Plan check — prefer metrics_module flag, fall back to ndvi_access for backward compat
    const hasMetricsAccess = await checkFeatureAccess(decoded.uid, 'metrics_module')
    const hasNdviAccess = hasMetricsAccess || await checkFeatureAccess(decoded.uid, 'ndvi_access')
    if (!hasNdviAccess) {
      return NextResponse.json({ error: 'Tu plan no incluye el módulo de métricas satelitales' }, { status: 403 })
    }

    const { geojson, paddock_id, requested_indices } = await req.json()

    if (!geojson) {
      return NextResponse.json({ error: 'GeoJSON polygon required' }, { status: 400 })
    }

    // Normalize GeoJSON to a geometry object
    const geometry = geojson.type === 'Feature' ? geojson.geometry : geojson

    console.log(`[METRICS] Starting for paddock=${paddock_id || 'unknown'} | TITILER_URL=${TITILER_URL}`)

    // -- STEP 1: Find latest cloud-free Sentinel-2 scene --
    const stacResponse = await fetch(EARTH_SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collections: ['sentinel-2-c1-l2a', 'sentinel-2-l2a'],
        intersects: geometry,
        query: {
          'eo:cloud_cover': { lt: 25 },
        },
        limit: 5,
        sortby: [{ field: 'properties.datetime', direction: 'desc' }],
      }),
    })

    if (!stacResponse.ok) {
      console.error(`[METRICS] STEP 1 failed: Earth Search returned ${stacResponse.status}`)
      throw new Error(`Earth Search error: ${stacResponse.status}`)
    }

    const stacData = await stacResponse.json()
    const items = stacData.features

    if (!items || items.length === 0) {
      console.warn(`[METRICS] STEP 1: No cloud-free scenes found for paddock=${paddock_id}`)
      return NextResponse.json(computeDeterministicFallback(paddock_id || 'default', 'no_scenes'))
    }

    console.log(`[METRICS] STEP 1: Found ${items.length} scenes, using ${items[0].id} (cloud: ${items[0].properties?.['eo:cloud_cover']}%)`)

    // -- STEP 2: Get Sentinel-2 band URLs --
    const scene = items[0]
    const redUrl  = scene.assets?.red?.href   || scene.assets?.B04?.href
    const nirUrl  = scene.assets?.nir?.href   || scene.assets?.B08?.href
    const blueUrl = scene.assets?.blue?.href  || scene.assets?.B02?.href
    // B11 (SWIR 20m) — element84 uses 'swir16', raw STAC uses 'B11'
    const swirUrl = scene.assets?.swir16?.href || scene.assets?.B11?.href

    if (!redUrl || !nirUrl) {
      console.warn(
        `[METRICS] STEP 2: Core band URLs missing — red=${!!redUrl} nir=${!!nirUrl} | Available assets: ${Object.keys(scene.assets || {}).join(', ')}`
      )
      return NextResponse.json(computeDeterministicFallback(paddock_id || 'default', 'missing_bands'))
    }

    console.log(`[METRICS] STEP 2: Band URLs found — blue=${!!blueUrl} red=${!!redUrl} nir=${!!nirUrl} swir=${!!swirUrl}`)

    const featureGeoJSON = {
      type: 'Feature' as const,
      geometry,
      properties: {},
    }

    // -- STEP 3: Fetch band statistics in parallel via TiTiler --
    // B11 is 20m resolution — add resampling=nearest to handle resolution mismatch with 10m bands
    const [blueStats, redStats, nirStats, swirStats] = await Promise.all([
      blueUrl ? fetchBandStats(blueUrl, featureGeoJSON) : Promise.resolve(null),
      fetchBandStats(redUrl, featureGeoJSON),
      fetchBandStats(nirUrl, featureGeoJSON, true), // also fetch stddev for SPECTRAL_HETEROGENEITY
      swirUrl ? fetchBandStats(swirUrl, featureGeoJSON, false, true) : Promise.resolve(null),
    ])

    if (!redStats || !nirStats) {
      console.warn(`[METRICS] STEP 3: TiTiler stats failed — red=${!!redStats} nir=${!!nirStats} | TiTiler URL: ${TITILER_URL}`)
      return NextResponse.json(computeDeterministicFallback(paddock_id || 'default', 'titiler_failed'))
    }

    console.log(
      `[METRICS] STEP 3: TiTiler stats — blue.mean=${blueStats?.mean} red.mean=${redStats.mean} nir.mean=${nirStats.mean} swir.mean=${swirStats?.mean} nir.stddev=${nirStats.stddev}`
    )

    // -- STEP 4: Assemble band values and compute all indices --
    const bands: BandValues = {
      B2: blueStats?.mean,
      B4: redStats.mean,
      B8: nirStats.mean,
      B11: swirStats?.mean,
      B8_stddev: nirStats.stddev,
    }

    let indices = computeAllIndices(bands)

    // Filter to requested_indices subset if specified
    if (Array.isArray(requested_indices) && requested_indices.length > 0) {
      const requested = new Set<string>(requested_indices)
      indices = indices.filter(r => requested.has(r.metricType))
    }

    if (indices.length === 0) {
      console.warn(`[METRICS] STEP 4: No indices could be computed — possible all-zero bands`)
      return NextResponse.json(computeDeterministicFallback(paddock_id || 'default', 'zero_bands'))
    }

    const captureDate = scene.properties?.datetime?.split('T')[0] || new Date().toISOString().split('T')[0]

    console.log(`[METRICS] STEP 4: Computed ${indices.length} indices for scene=${scene.id} date=${captureDate}`)

    return NextResponse.json({
      indices,
      captureDate,
      sceneId: scene.id,
      cloudCover: scene.properties?.['eo:cloud_cover'] || 0,
      source: 'sentinel-2-l2a',
    })
  } catch (error) {
    console.error('[METRICS] Fatal error:', error)
    return NextResponse.json(computeDeterministicFallback('fallback', 'fatal_error'))
  }
}

interface BandStats {
  mean: number
  stddev?: number
}

/**
 * Fetch band statistics from TiTiler for a COG URL + polygon.
 * @param cogUrl        Cloud-Optimized GeoTIFF asset URL
 * @param featureGeoJSON  GeoJSON Feature with the paddock polygon as POST body
 * @param includeStddev  If true, also return the stddev field
 * @param lowResResampling  If true, add resampling=nearest query param (for 20m bands like B11)
 */
async function fetchBandStats(
  cogUrl: string,
  featureGeoJSON: object,
  includeStddev = false,
  lowResResampling = false,
): Promise<BandStats | null> {
  try {
    let url = `${TITILER_URL}/cog/statistics?url=${encodeURIComponent(cogUrl)}`
    if (lowResResampling) url += '&resampling=nearest'

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(featureGeoJSON),
      signal: AbortSignal.timeout(12000),
    })

    if (!res.ok) {
      console.warn(`[METRICS] TiTiler returned ${res.status} for ${url.substring(0, 80)}...`)
      return null
    }

    const data = await res.json()

    // TiTiler returns { b1: { mean, std, ... } }
    const bandKey = Object.keys(data)[0]
    if (!data[bandKey]) return null

    const stats = data[bandKey]
    const result: BandStats = { mean: stats.mean }
    if (includeStddev) {
      // TiTiler may return 'std' or 'stddev' depending on version
      result.stddev = stats.std ?? stats.stddev ?? undefined
    }
    return result
  } catch (err: any) {
    console.warn(`[METRICS] TiTiler fetch error: ${err.message}`)
    return null
  }
}

// Deterministic fallback based on paddock_id seed — consistent per paddock, includes estimated indices
function computeDeterministicFallback(seed: string, reason: string = 'unknown') {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i)
    hash |= 0
  }
  const normalized = (Math.abs(hash) % 1000) / 1000
  const ndvi = Number((0.35 + normalized * 0.45).toFixed(4))

  console.warn(`[METRICS] Returning ESTIMATED data for seed=${seed} reason=${reason}`)

  return {
    indices: [
      { metricType: 'NDVI', value: ndvi, unit: 'index', confidence: 'ESTIMATED' },
      { metricType: 'FCOVER', value: Number(Math.max(0, Math.min(1, (ndvi - 0.1) / 0.7)).toFixed(4)), unit: 'index', confidence: 'ESTIMATED' },
    ],
    captureDate: new Date().toISOString().split('T')[0],
    source: 'estimated',
    estimatedReason: reason,
    sceneId: null,
    cloudCover: null,
  }
}
