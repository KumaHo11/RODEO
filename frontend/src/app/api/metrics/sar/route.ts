import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { checkFeatureAccess } from '@/lib/plan-limits'
import { computeSoilMoisture, computeRFDI } from '@/lib/metrics/indices'

const EARTH_SEARCH_URL = 'https://earth-search.aws.element84.com/v1/search'
const TITILER_URL = process.env.TITILER_URL || 'https://titiler.xyz'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const decoded = await verifyFirebaseToken(token)
    if (!decoded) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const hasMetricsAccess = await checkFeatureAccess(decoded.uid, 'metrics_module')
    if (!hasMetricsAccess) {
      return NextResponse.json({ error: 'Tu plan no incluye el módulo de métricas satelitales' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const bboxParam = searchParams.get('bbox')
    const dateParam = searchParams.get('date') // YYYY-MM-DD
    const paddock_id = searchParams.get('paddock_id')

    if (!bboxParam) {
      return NextResponse.json({ error: 'bbox parameter required' }, { status: 400 })
    }

    const bbox = bboxParam.split(',').map(Number)
    if (bbox.length !== 4 || bbox.some(isNaN)) {
      return NextResponse.json({ error: 'invalid bbox' }, { status: 400 })
    }

    // datetime: últimos 12 días
    const targetDate = dateParam ? new Date(dateParam) : new Date()
    const startDate = new Date(targetDate)
    startDate.setDate(targetDate.getDate() - 12)
    const datetime = `${startDate.toISOString()}/${targetDate.toISOString()}`

    console.log(`[SAR] Searching sentinel-1-grd for bbox=${bboxParam} datetime=${datetime}`)

    const stacResponse = await fetch(EARTH_SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collections: ['sentinel-1-grd'],
        bbox,
        datetime,
        limit: 1,
        sortby: [{ field: 'properties.datetime', direction: 'desc' }],
      }),
    })

    if (!stacResponse.ok) {
      throw new Error(`Earth Search error: ${stacResponse.status}`)
    }

    const stacData = await stacResponse.json()
    const items = stacData.features

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No Sentinel-1 scenes found in the last 12 days' }, { status: 404 })
    }

    const scene = items[0]
    const vvUrl = scene.assets?.vv?.href
    const vhUrl = scene.assets?.vh?.href

    if (!vvUrl || !vhUrl) {
      return NextResponse.json({ error: 'Missing VV or VH assets' }, { status: 404 })
    }

    const captureDate = scene.properties?.datetime?.split('T')[0] || targetDate.toISOString().split('T')[0]

    // Fetch band stats from TiTiler via GET with bbox
    const [vvStats, vhStats] = await Promise.all([
      fetchBandStatsBbox(vvUrl, bbox),
      fetchBandStatsBbox(vhUrl, bbox)
    ])

    if (!vvStats || !vhStats) {
      return NextResponse.json({ error: 'Failed to fetch stats from TiTiler' }, { status: 500 })
    }

    const soilMoisture = computeSoilMoisture(vvStats.mean)
    const rfdi = computeRFDI(vvStats.mean, vhStats.mean)

    const indices = [
      { metricType: 'SOIL_MOISTURE', value: Number(soilMoisture.toFixed(4)), unit: 'index', confidence: 'HIGH' }
    ]

    return NextResponse.json({
      indices,
      rfdi: Number(rfdi.toFixed(4)),
      captureDate,
      sceneId: scene.id,
      source: 'sentinel-1-sar',
    })
  } catch (error) {
    console.error('[SAR] Fatal error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function fetchBandStatsBbox(
  cogUrl: string,
  bbox: number[]
): Promise<{ mean: number } | null> {
  try {
    const bboxStr = bbox.join(',')
    // GET {TITILER_URL}/cog/statistics?url={asset_href}&bbox={bbox}&resampling=bilinear
    const url = `${TITILER_URL}/cog/statistics?url=${encodeURIComponent(cogUrl)}&bbox=${bboxStr}&resampling=bilinear`

    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(12000),
    })

    if (!res.ok) {
      console.warn(`[SAR] TiTiler returned ${res.status} for ${url.substring(0, 80)}...`)
      return null
    }

    const data = await res.json()
    const bandKey = Object.keys(data)[0]
    if (!data[bandKey]) return null

    return { mean: data[bandKey].mean }
  } catch (err: any) {
    console.warn(`[SAR] TiTiler fetch error: ${err.message}`)
    return null
  }
}
