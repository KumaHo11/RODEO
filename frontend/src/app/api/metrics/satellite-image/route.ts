/**
 * GET /api/metrics/satellite-image
 *
 * Proxies a TiTiler STAC crop request for a Sentinel-2 scene, returning a
 * PNG cropped to the paddock's bounding box.
 *
 * This proxy exists to:
 *   1. Keep the Firebase auth check server-side (TiTiler endpoint is public)
 *   2. Validate that the paddock belongs to the requesting user's org
 *   3. Set aggressive Cache-Control (images are immutable per scene)
 *   4. Decouple the TiTiler base URL from the frontend
 *
 * Query params:
 *   - scene_id   (required): Sentinel-2 scene identifier from Earth Search
 *                 e.g. "S2B_36MTD_20220615_0_L2A"
 *   - paddock_id (required): UUID of the paddock (used to get its bounding box)
 *   - width      (optional, default 400): output image width in pixels
 *   - height     (optional, default 400): output image height in pixels
 *
 * Environment variables:
 *   TITILER_BASE_URL — defaults to https://titiler.xyz
 *   EARTH_SEARCH_STAC_URL — defaults to https://earth-search.aws.element84.com/v1
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { serviceQueryOne } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const TITILER_BASE_URL    = process.env.TITILER_BASE_URL    || 'https://titiler.xyz'
const EARTH_SEARCH_BASE   = process.env.EARTH_SEARCH_STAC_URL || 'https://earth-search.aws.element84.com/v1'
const SENTINEL2_COLLECTION = 'sentinel-2-l2a'

export async function GET(req: NextRequest) {
  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const decoded = await verifyFirebaseToken(token)
    if (!decoded) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    // ── Params ────────────────────────────────────────────────────────────────
    const sceneId   = req.nextUrl.searchParams.get('scene_id')
    const paddockId = req.nextUrl.searchParams.get('paddock_id')
    const width     = Math.min(600, Math.max(100, parseInt(req.nextUrl.searchParams.get('width')  || '400', 10)))
    const height    = Math.min(600, Math.max(100, parseInt(req.nextUrl.searchParams.get('height') || '400', 10)))

    if (!sceneId || !paddockId) {
      return NextResponse.json({ error: 'scene_id y paddock_id son requeridos' }, { status: 400 })
    }

    // ── Org ownership check + bounding box ───────────────────────────────────
    const profile = await serviceQueryOne<{ organization_id: string }>(
      `SELECT organization_id FROM profiles WHERE firebase_uid = $1`, [decoded.uid]
    )
    if (!profile?.organization_id) {
      return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 })
    }

    // Fetch paddock bounding box — confirms ownership and gets geometry
    const paddock = await serviceQueryOne<{
      minx: number; miny: number; maxx: number; maxy: number
    }>(`
      SELECT
        ST_XMin(ST_Envelope(geom))::float AS minx,
        ST_YMin(ST_Envelope(geom))::float AS miny,
        ST_XMax(ST_Envelope(geom))::float AS maxx,
        ST_YMax(ST_Envelope(geom))::float AS maxy
      FROM paddocks
      WHERE id = $1 AND org_id = $2 AND geom IS NOT NULL
    `, [paddockId, profile.organization_id])

    if (!paddock) {
      return NextResponse.json({ error: 'Potrero no encontrado o sin geometría' }, { status: 404 })
    }

    // ── Build TiTiler STAC crop URL ───────────────────────────────────────────
    // Add a small buffer (~500m) so the field isn't edge-clipped
    const BUFFER = 0.005 // ~500m in degrees
    const { minx, miny, maxx, maxy } = paddock
    const bbox = `${(minx - BUFFER).toFixed(6)},${(miny - BUFFER).toFixed(6)},${(maxx + BUFFER).toFixed(6)},${(maxy + BUFFER).toFixed(6)}`

    // Earth Search STAC item URL
    const stacItemUrl = encodeURIComponent(
      `${EARTH_SEARCH_BASE}/collections/${SENTINEL2_COLLECTION}/items/${sceneId}`
    )

    // TiTiler STAC crop endpoint — returns PNG with true-color RGB
    // rescale=0,3000 maps typical Sentinel-2 L2A surface reflectance (0–10000 range) to 0–255
    const tiTilerUrl = `${TITILER_BASE_URL}/stac/crop/${bbox}.png` +
      `?url=${stacItemUrl}` +
      `&assets=visual` +          // "visual" is the pre-built TCI (True Color Image) asset
      `&width=${width}` +
      `&height=${height}` +
      `&rescale=0,3000` +
      `&resampling=bilinear`

    // ── Fetch from TiTiler ────────────────────────────────────────────────────
    const tiResponse = await fetch(tiTilerUrl, {
      signal: AbortSignal.timeout(20_000),
    })

    if (!tiResponse.ok) {
      // TiTiler returns 404 when the scene doesn't have the requested asset
      // or 500 when the scene is unavailable — both cases fall back to gradient in UI
      console.warn(`[satellite-image] TiTiler returned ${tiResponse.status} for scene ${sceneId}`)
      return NextResponse.json(
        { error: `TiTiler error: ${tiResponse.status}` },
        { status: tiResponse.status === 404 ? 404 : 502 }
      )
    }

    // ── Stream the PNG back ───────────────────────────────────────────────────
    const imageBuffer = await tiResponse.arrayBuffer()

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type':  'image/png',
        // Satellite images are immutable for a given scene — cache aggressively
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
        'X-Scene-Id':    sceneId,
      },
    })
  } catch (err: any) {
    console.error('[/api/metrics/satellite-image]', err)
    // Return 502 so the UI can fall back to gradient without throwing
    return NextResponse.json({ error: 'Error al obtener imagen satelital' }, { status: 502 })
  }
}
