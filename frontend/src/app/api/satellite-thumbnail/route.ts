/**
 * GET /api/satellite-thumbnail
 *
 * Retorna la URL de thumbnail RGB True Color (y SWIR opcional) de la mejor
 * escena Sentinel-2 disponible para un mes/año dado sobre un polígono.
 *
 * Uso en el módulo de auditoría mensual EUDR:
 *   - Cada tarjeta mensual llama a este endpoint para mostrar evidencia visual
 *   - Retorna thumbnail_url (True Color RGB: B04/B03/B02)
 *   - Retorna swir_url (SWIR/NIR/Red: B11/B08/B04) — detecta desmontes y quemas
 *
 * Query params:
 *   geojson  — Geometry JSON (URL-encoded)
 *   month    — Número de mes (1-12)
 *   year     — Año (2019 en adelante)
 *   paddock_id — (opcional) para logging
 *
 * Cloud cover fallback progresivo: 25% → 40% → 60% → 80%
 * (necesario para el Gran Chaco Norte en verano)
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

const EARTH_SEARCH_URL = 'https://earth-search.aws.element84.com/v1/search'
const TITILER_URL      = process.env.TITILER_URL || 'https://titiler.xyz'

const CLOUD_COVER_THRESHOLDS = [25, 40, 60, 80] as const

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const paddock_id  = searchParams.get('paddock_id')
    const monthStr    = searchParams.get('month')
    const yearStr     = searchParams.get('year')
    const geojsonStr  = searchParams.get('geojson')

    if (!geojsonStr || !monthStr || !yearStr) {
      return NextResponse.json(
        { error: 'Parámetros requeridos: geojson (URL-encoded), month, year' },
        { status: 400 }
      )
    }

    const month = parseInt(monthStr)
    const year  = parseInt(yearStr)

    if (isNaN(month) || month < 1 || month > 12 || isNaN(year) || year < 2015) {
      return NextResponse.json({ error: 'month (1-12) y year (≥2015) son requeridos' }, { status: 400 })
    }

    let geometry: any
    try {
      geometry = JSON.parse(decodeURIComponent(geojsonStr))
      // Normalizar a objeto geometry (no Feature)
      if (geometry.type === 'Feature') geometry = geometry.geometry
    } catch {
      return NextResponse.json({ error: 'geojson inválido — debe ser JSON URL-encoded' }, { status: 400 })
    }

    // ── Rango temporal del mes solicitado ───────────────────────────────────
    const lastDay  = new Date(year, month, 0).getDate()
    const dateFrom = `${year}-${String(month).padStart(2, '0')}-01T00:00:00Z`
    const dateTo   = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59Z`

    console.log(`[satellite-thumbnail] ▶ paddock=${paddock_id ?? '-'} period=${month}/${year} (${dateFrom.split('T')[0]}→${dateTo.split('T')[0]})`)

    // ── Búsqueda STAC con fallback de nubosidad ─────────────────────────────
    let bestScene: any = null
    let cloudUsed = 0

    for (const maxCloud of CLOUD_COVER_THRESHOLDS) {
      let res: Response
      try {
        res = await fetch(EARTH_SEARCH_URL, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            collections: ['sentinel-2-c1-l2a', 'sentinel-2-l2a'],
            intersects:  geometry,
            datetime:    `${dateFrom}/${dateTo}`,
            query:       { 'eo:cloud_cover': { lt: maxCloud } },
            limit:       10,
            sortby:      [{ field: 'properties.datetime', direction: 'asc' }],
          }),
          signal: AbortSignal.timeout(15000),
        })
      } catch (fetchErr: any) {
        console.error(`[satellite-thumbnail] STAC fetch error (cloud<${maxCloud}):`, fetchErr.message)
        break
      }

      if (!res.ok) {
        console.warn(`[satellite-thumbnail] STAC retornó ${res.status}`)
        break
      }

      const data = await res.json()
      const items: any[] = data.features ?? []

      if (items.length > 0) {
        // Elegir la de menor nubosidad
        items.sort((a, b) =>
          (a.properties?.['eo:cloud_cover'] ?? 99) - (b.properties?.['eo:cloud_cover'] ?? 99)
        )
        bestScene = items[0]
        cloudUsed = maxCloud
        console.log(`[satellite-thumbnail] ✓ Escena: ${bestScene.id} (cloud:${bestScene.properties?.['eo:cloud_cover']}%, threshold<${maxCloud}%)`)
        break
      }

      console.warn(`[satellite-thumbnail] ⚠ Sin escenas (cloud<${maxCloud}%) para ${month}/${year}`)
    }

    // ── Sin escenas disponibles ────────────────────────────────────────────
    if (!bestScene) {
      return NextResponse.json({
        thumbnail_url:  null,
        swir_url:       null,
        scene_id:       null,
        capture_date:   null,
        cloud_cover:    null,
        month, year,
        paddock_id,
        reason:         'no_scenes',
        message:        `Sin imágenes Sentinel-2 disponibles para ${month}/${year} en esta área`,
      })
    }

    const assets       = bestScene.assets ?? {}
    const captureDate  = bestScene.properties?.datetime?.split('T')[0] ?? null
    const cloudCover   = bestScene.properties?.['eo:cloud_cover'] ?? null

    // ── URLs de bandas ─────────────────────────────────────────────────────
    const redUrl   = assets.red?.href   || assets.B04?.href   || null
    const greenUrl = assets.green?.href || assets.B03?.href   || null
    const blueUrl  = assets.blue?.href  || assets.B02?.href   || null
    const nirUrl   = assets.nir?.href   || assets.B08?.href   || null
    const swirUrl  = assets.swir16?.href || assets.B11?.href  || null

    // ── Thumbnail nativo de Sentinel-2 (preview rápido) ───────────────────
    // Preferir el thumbnail nativo (JPEG, baja resolución) para carga rápida
    const nativeThumbnail: string | null =
      assets.thumbnail?.href     ||
      assets.overview?.href      ||
      assets.preview?.href       ||
      bestScene.links?.find((l: any) => l.rel === 'preview')?.href ||
      null

    // ── True Color RGB vía TiTiler (/cog/preview.png) ─────────────────────
    // Generamos URLs firmadas de TiTiler para renderizar sobre el bbox del potrero
    let truColorUrl:  string | null = nativeThumbnail
    let swirRgbUrl:   string | null = null

    if (redUrl) {
      const bbox = getBboxFromGeometry(geometry)
      const bboxStr = bbox.join(',')

      // True Color: B04/B03/B02 (visual)
      truColorUrl = `${TITILER_URL}/cog/preview.png?${new URLSearchParams({
        url:     redUrl,
        bidx:    '1',
        rescale: '0,3000',
        width:   '512',
        height:  '512',
      }).toString()}`

      // SWIR/NIR/Red: B11/B08/B04 — el más sensible a desmontes y quemas en Chaco
      // Vegetación sana → verde oscuro. Desmonte reciente → rojo brillante. Quemas → negro.
      if (swirUrl && nirUrl) {
        swirRgbUrl = `${TITILER_URL}/cog/preview.png?${new URLSearchParams({
          url:     swirUrl,
          bidx:    '1',
          rescale: '0,3000',
          width:   '512',
          height:  '512',
        }).toString()}`
      }
    }

    console.log(`[satellite-thumbnail] ✓ Retornando: thumbnail=${!!truColorUrl} swir=${!!swirRgbUrl} date=${captureDate}`)

    return NextResponse.json({
      scene_id:      bestScene.id,
      capture_date:  captureDate,
      cloud_cover:   cloudCover,
      cloud_threshold_used: cloudUsed,
      thumbnail_url: truColorUrl,    // RGB True Color (visualización)
      swir_url:      swirRgbUrl,     // SWIR/NIR/Red (detección de desmonte)
      month,
      year,
      paddock_id,
      // URLs de bandas individuales para análisis avanzado
      band_urls: {
        red:   redUrl,
        green: greenUrl,
        blue:  blueUrl,
        nir:   nirUrl,
        swir:  swirUrl,
      },
    })

  } catch (error: any) {
    console.error('[satellite-thumbnail] Fatal error:', error)
    return NextResponse.json({ error: 'Error interno', detail: error.message }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: calcular bounding box de una geometría GeoJSON
// ─────────────────────────────────────────────────────────────────────────────
function getBboxFromGeometry(geometry: any): [number, number, number, number] {
  const lons: number[] = []
  const lats: number[] = []

  function traverseCoords(arr: any): void {
    if (!Array.isArray(arr)) return
    if (typeof arr[0] === 'number' && typeof arr[1] === 'number') {
      lons.push(arr[0])
      lats.push(arr[1])
    } else {
      arr.forEach(traverseCoords)
    }
  }

  traverseCoords(geometry?.coordinates ?? [])

  if (lons.length === 0) return [-180, -90, 180, 90]

  return [
    Math.min(...lons),
    Math.min(...lats),
    Math.max(...lons),
    Math.max(...lats),
  ]
}
