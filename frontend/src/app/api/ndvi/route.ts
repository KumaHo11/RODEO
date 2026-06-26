import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { checkFeatureAccess } from '@/lib/plan-limits'

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

    // Plan check
    const hasAccess = await checkFeatureAccess(decoded.uid, 'ndvi_access')
    if (!hasAccess) {
      return NextResponse.json({ error: 'Tu plan no incluye análisis satelital NDVI' }, { status: 403 })
    }

    const { geojson, paddock_id } = await req.json()

    if (!geojson) {
      return NextResponse.json({ error: 'GeoJSON polygon required' }, { status: 400 })
    }

    // Normalize GeoJSON to a geometry object
    const geometry = geojson.type === 'Feature' ? geojson.geometry : geojson

    console.log(`[NDVI] ▶ Starting for paddock=${paddock_id || 'unknown'} | TITILER_URL=${TITILER_URL}`)

    // ── STEP 1: Find latest cloud-free Sentinel-2 scene ──────────────────────
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
      console.error(`[NDVI] ✗ STEP 1 failed: Earth Search returned ${stacResponse.status}`)
      throw new Error(`Earth Search error: ${stacResponse.status}`)
    }

    const stacData = await stacResponse.json()
    const items = stacData.features

    if (!items || items.length === 0) {
      console.warn(`[NDVI] ⚠ STEP 1: No cloud-free scenes found for paddock=${paddock_id}`)
      // Fallback: if no scene found (very cloudy period), return deterministic mock
      return NextResponse.json(computeDetministicNdvi(paddock_id || 'default', 'no_scenes'))
    }

    console.log(`[NDVI] ✓ STEP 1: Found ${items.length} scenes, using ${items[0].id} (cloud: ${items[0].properties?.['eo:cloud_cover']}%)`)

    // ── STEP 2: Get Sentinel-2 band URLs ─────────────────────────────────────
    const scene = items[0]
    const redUrl = scene.assets?.red?.href || scene.assets?.B04?.href
    const nirUrl = scene.assets?.nir?.href || scene.assets?.B08?.href

    if (!redUrl || !nirUrl) {
      console.warn(`[NDVI] ⚠ STEP 2: Band URLs missing — red=${!!redUrl} nir=${!!nirUrl} | Available assets: ${Object.keys(scene.assets || {}).join(', ')}`)
      return NextResponse.json(computeDetministicNdvi(paddock_id || 'default', 'missing_bands'))
    }

    console.log(`[NDVI] ✓ STEP 2: Band URLs found`)

    const featureGeoJSON = {
      type: 'Feature' as const,
      geometry,
      properties: {},
    }

    // ── STEP 3: Get band statistics via TiTiler ──────────────────────────────
    const [redStats, nirStats] = await Promise.all([
      fetchBandStats(redUrl, featureGeoJSON),
      fetchBandStats(nirUrl, featureGeoJSON),
    ])

    if (!redStats || !nirStats) {
      console.warn(`[NDVI] ⚠ STEP 3: TiTiler stats failed — red=${!!redStats} nir=${!!nirStats} | TiTiler URL: ${TITILER_URL}`)
      return NextResponse.json(computeDetministicNdvi(paddock_id || 'default', 'titiler_failed'))
    }

    console.log(`[NDVI] ✓ STEP 3: TiTiler stats — red.mean=${redStats.mean} nir.mean=${nirStats.mean}`)

    // ── STEP 4: Compute NDVI ─────────────────────────────────────────────────
    // Sentinel-2 L2A values are in reflectance * 10000
    const red = redStats.mean
    const nir = nirStats.mean

    if (red === 0 && nir === 0) {
      console.warn(`[NDVI] ⚠ STEP 4: Both bands are 0 — possible data issue`)
      return NextResponse.json(computeDetministicNdvi(paddock_id || 'default', 'zero_bands'))
    }

    const ndvi = (nir - red) / (nir + red)
    const ndviClamped = Math.max(-1, Math.min(1, ndvi))

    // Estimate dry matter from NDVI (heuristic calibrated for Pampas)
    // NDVI 0.8 → ~3000 Kg MS/Ha, NDVI 0.2 → ~500 Kg MS/Ha
    const dryMatterKgHa = Math.round(500 + Math.max(0, (ndviClamped - 0.2) / 0.6) * 2500)

    // Grazable area: exclude areas with NDVI < 0.1 (water, bare soil)
    const grazableAreaPct = ndviClamped > 0.3 ? 92 : ndviClamped > 0.15 ? 78 : 60

    const captureDate = scene.properties?.datetime?.split('T')[0] || new Date().toISOString().split('T')[0]

    console.log(`[NDVI] ✓ STEP 4: REAL NDVI=${ndviClamped.toFixed(3)} DM=${dryMatterKgHa} kg/ha scene=${scene.id} date=${captureDate}`)

    return NextResponse.json({
      averageNdvi: Number(ndviClamped.toFixed(3)),
      grazableAreaPct,
      estimatedAvailableDryMatterHa: dryMatterKgHa,
      captureDate,
      source: 'sentinel-2-l2a',
      sceneId: scene.id,
      cloudCover: scene.properties?.['eo:cloud_cover'] || 0,
    })
  } catch (error) {
    console.error('[NDVI] ✗ Fatal error:', error)
    // Graceful fallback
    return NextResponse.json(computeDetministicNdvi('fallback', 'fatal_error'))
  }
}

async function fetchBandStats(cogUrl: string, featureGeoJSON: object): Promise<{ mean: number } | null> {
  try {
    const url = `${TITILER_URL}/cog/statistics?url=${encodeURIComponent(cogUrl)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(featureGeoJSON),
      signal: AbortSignal.timeout(12000),
    })

    if (!res.ok) {
      console.warn(`[NDVI] ⚠ TiTiler returned ${res.status} for ${url.substring(0, 80)}...`)
      return null
    }
    const data = await res.json()

    // TiTiler returns { b1: { mean, ... } }
    const bandKey = Object.keys(data)[0]
    return data[bandKey] ? { mean: data[bandKey].mean } : null
  } catch (err: any) {
    console.warn(`[NDVI] ⚠ TiTiler fetch error: ${err.message}`)
    return null
  }
}

// Deterministic mock based on paddock_id seed (consistent per paddock)
// Now includes a 'reason' field to help diagnose why real data wasn't available
function computeDetministicNdvi(seed: string, reason: string = 'unknown') {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i)
    hash |= 0
  }
  const normalized = (Math.abs(hash) % 1000) / 1000
  const ndvi = Number((0.35 + normalized * 0.45).toFixed(3))
  const dryMatterKgHa = Math.round(600 + normalized * 2000)

  console.warn(`[NDVI] ⚠ Returning ESTIMATED data for seed=${seed} reason=${reason}`)

  return {
    averageNdvi: ndvi,
    grazableAreaPct: 88 + Math.round(normalized * 10),
    estimatedAvailableDryMatterHa: dryMatterKgHa,
    captureDate: new Date().toISOString().split('T')[0],
    source: 'estimated',
    estimatedReason: reason,
    sceneId: null,
    cloudCover: null,
  }
}
