/**
 * POST /api/ndvi
 *
 * Calcula NDVI real vía Sentinel-2 (Earth Search STAC + TiTiler).
 *
 * FIX v27-EUDR — Correcciones:
 *   ❌ ANTES: Sin filtro temporal → siempre retorna la escena MÁS RECIENTE
 *   ✅ AHORA: Acepta month/year o start_date/end_date para consultas históricas EUDR
 *
 *   ❌ ANTES: cloud_cover < 25 fijo → falla en el Chaco Norte (nuboso en verano)
 *   ✅ AHORA: Fallback progresivo 25 → 40 → 60 → 80% hasta encontrar una escena válida
 *
 *   ❌ ANTES: computeDetministicNdvi() retorna 0.35-0.80 (enmascara deforestación)
 *   ✅ AHORA: Si no hay escenas, retorna { averageNdvi: null, source: 'no_data' }
 *             (la UI mostrará "Sin datos" en lugar de un valor ficticio verde)
 *
 *   ❌ ANTES: Solo buscaba en 'sentinel-2-c1-l2a' y 'sentinel-2-l2a'
 *   ✅ AHORA: Intenta ambas colecciones en paralelo para mayor cobertura
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { checkFeatureAccess } from '@/lib/plan-limits'

const EARTH_SEARCH_URL = 'https://earth-search.aws.element84.com/v1/search'
const TITILER_URL      = process.env.TITILER_URL || 'https://titiler.xyz'

// Fallback progresivo para zonas tropicales / subtropicales como el Chaco Norte
// donde el 90% del verano tiene > 25% de nubosidad
const CLOUD_COVER_THRESHOLDS = [25, 40, 60, 80] as const

export async function POST(req: NextRequest) {
  try {
    // ── Auth ───────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const decoded = await verifyFirebaseToken(token)
    if (!decoded) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const hasAccess = await checkFeatureAccess(decoded.uid, 'ndvi_access')
    if (!hasAccess) {
      return NextResponse.json({ error: 'Tu plan no incluye análisis satelital NDVI' }, { status: 403 })
    }

    const { geojson, paddock_id, start_date, end_date, month, year } = await req.json()

    if (!geojson) {
      return NextResponse.json({ error: 'GeoJSON polygon required' }, { status: 400 })
    }

    const geometry = geojson.type === 'Feature' ? geojson.geometry : geojson

    // ── Construir rango temporal ────────────────────────────────────────────
    let dateFrom: string
    let dateTo: string

    if (month && year) {
      // Auditoría EUDR mensual: calcular primer/último día del mes
      const m = parseInt(String(month))
      const y = parseInt(String(year))
      const lastDay = new Date(y, m, 0).getDate()
      dateFrom = `${y}-${String(m).padStart(2, '0')}-01`
      dateTo   = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    } else if (start_date && end_date) {
      dateFrom = start_date
      dateTo   = end_date
    } else {
      // Default: últimos 60 días (modo operativo actual)
      const now = new Date()
      dateTo   = now.toISOString().split('T')[0]
      now.setDate(now.getDate() - 60)
      dateFrom = now.toISOString().split('T')[0]
    }

    console.log(`[NDVI] ▶ paddock=${paddock_id ?? 'unknown'} period=${dateFrom}→${dateTo} TITILER=${TITILER_URL}`)

    // ── STEP 1: Buscar escena Sentinel-2 con fallback de nubosidad ─────────
    let bestScene: any = null
    let usedCloudThreshold = 0

    for (const maxCloud of CLOUD_COVER_THRESHOLDS) {
      const stacResponse = await fetch(EARTH_SEARCH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collections: ['sentinel-2-c1-l2a', 'sentinel-2-l2a'],
          intersects:  geometry,
          // FIX: filtro temporal explícito para consultas históricas EUDR
          datetime: `${dateFrom}T00:00:00Z/${dateTo}T23:59:59Z`,
          query: { 'eo:cloud_cover': { lt: maxCloud } },
          limit: 10,
          // Ordenar ascendente (primero) para obtener la escena más temprana del período
          // (útil para detectar cuándo ocurrió el desmonte)
          sortby: [{ field: 'properties.datetime', direction: 'asc' }],
        }),
      })

      if (!stacResponse.ok) {
        console.error(`[NDVI] ✗ STEP 1: Earth Search ${stacResponse.status}`)
        break
      }

      const stacData = await stacResponse.json()
      const items: any[] = stacData.features ?? []

      if (items.length > 0) {
        // De las escenas disponibles, elegir la de MENOR nubosidad
        items.sort((a, b) =>
          (a.properties?.['eo:cloud_cover'] ?? 99) - (b.properties?.['eo:cloud_cover'] ?? 99)
        )
        bestScene = items[0]
        usedCloudThreshold = maxCloud
        console.log(`[NDVI] ✓ STEP 1: ${items.length} escenas encontradas (cloud<${maxCloud}%), usando ${bestScene.id} (cloud:${bestScene.properties?.['eo:cloud_cover']}%)`)
        break
      }

      console.warn(`[NDVI] ⚠ STEP 1: Sin escenas (cloud<${maxCloud}%) para ${dateFrom}→${dateTo}, probando threshold mayor...`)
    }

    // ── Sin escenas disponibles → retornar null explícito (NO mock) ─────────
    // La UI debe mostrar "Sin datos" en lugar de un NDVI ficticio verde
    if (!bestScene) {
      console.warn(`[NDVI] ⚠ Sin escenas Sentinel-2 disponibles para paddock=${paddock_id} en ${dateFrom}→${dateTo}`)
      return NextResponse.json({
        averageNdvi:   null,
        source:        'no_data',
        reason:        'no_scenes',
        message:       `Sin imágenes Sentinel-2 disponibles para el período ${dateFrom} a ${dateTo} en esta área`,
        dateFrom,
        dateTo,
        paddock_id,
      })
    }

    // ── STEP 2: Obtener URLs de bandas B04 (Red) y B08 (NIR) ──────────────
    const redUrl = bestScene.assets?.red?.href  || bestScene.assets?.B04?.href
    const nirUrl = bestScene.assets?.nir?.href  || bestScene.assets?.B08?.href

    if (!redUrl || !nirUrl) {
      console.warn(`[NDVI] ⚠ STEP 2: URLs de bandas no encontradas | assets: ${Object.keys(bestScene.assets ?? {}).join(', ')}`)
      return NextResponse.json({
        averageNdvi: null,
        source:      'no_data',
        reason:      'missing_bands',
        message:     'Las bandas Red/NIR no están disponibles para esta escena',
        scene_id:    bestScene.id,
        dateFrom,
        dateTo,
      })
    }

    // ── STEP 3: Estadísticas de banda vía TiTiler ─────────────────────────
    const featureGeoJSON = { type: 'Feature' as const, geometry, properties: {} }

    const [redStats, nirStats] = await Promise.all([
      fetchBandStats(redUrl, featureGeoJSON),
      fetchBandStats(nirUrl, featureGeoJSON),
    ])

    if (!redStats || !nirStats) {
      console.warn(`[NDVI] ⚠ STEP 3: TiTiler stats fallaron — red=${!!redStats} nir=${!!nirStats}`)
      return NextResponse.json({
        averageNdvi: null,
        source:      'no_data',
        reason:      'titiler_failed',
        message:     'Error al procesar estadísticas de banda en TiTiler',
        scene_id:    bestScene.id,
        dateFrom,
        dateTo,
      })
    }

    // ── STEP 4: Calcular NDVI ──────────────────────────────────────────────
    // Sentinel-2 L2A: valores en reflectancia × 10000
    const red = redStats.mean
    const nir = nirStats.mean

    if (red === 0 && nir === 0) {
      console.warn(`[NDVI] ⚠ STEP 4: Ambas bandas = 0 — posible área sin datos`)
      return NextResponse.json({
        averageNdvi: null,
        source:      'no_data',
        reason:      'zero_bands',
        message:     'Las bandas retornan cero — posible área sin cobertura o error de enmascaramiento',
        dateFrom, dateTo,
      })
    }

    const ndvi        = (nir - red) / (nir + red)
    const ndviClamped = Math.max(-1, Math.min(1, ndvi))

    // Estimación de materia seca calibrada para Chaco (no Pampa)
    // NDVI 0.55 → ~2000 Kg MS/Ha (bosque chaqueño denso)
    // NDVI 0.30 → ~800 Kg MS/Ha  (bosque chaqueño abierto / pastizal)
    // NDVI 0.15 → ~200 Kg MS/Ha  (suelo desnudo / desmonte)
    const dryMatterKgHa = ndviClamped >= 0.30
      ? Math.round(800 + ((ndviClamped - 0.30) / 0.40) * 1200)
      : Math.round(50  + ((ndviClamped - 0.05) / 0.25) * 750)

    const grazableAreaPct = ndviClamped > 0.30 ? 90
                          : ndviClamped > 0.15 ? 72
                          : 40

    const captureDate = bestScene.properties?.datetime?.split('T')[0]
      || new Date().toISOString().split('T')[0]

    console.log(`[NDVI] ✓ NDVI=${ndviClamped.toFixed(3)} DM=${dryMatterKgHa}kg/ha scene=${bestScene.id} cloud=${usedCloudThreshold}% date=${captureDate}`)

    return NextResponse.json({
      averageNdvi:                    Number(ndviClamped.toFixed(3)),
      grazableAreaPct,
      estimatedAvailableDryMatterHa:  dryMatterKgHa,
      captureDate,
      dateFrom,
      dateTo,
      source:       'sentinel-2-l2a',
      sceneId:      bestScene.id,
      cloudCover:   bestScene.properties?.['eo:cloud_cover'] ?? 0,
      cloudThresholdUsed: usedCloudThreshold,
      paddock_id,
    })

  } catch (error: any) {
    console.error('[NDVI] ✗ Fatal error:', error)
    // Retornar null (no mock) para que la UI muestre "Sin datos"
    return NextResponse.json({
      averageNdvi: null,
      source:      'no_data',
      reason:      'fatal_error',
      message:     'Error interno procesando la imagen satelital',
    }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: estadísticas de banda vía TiTiler /cog/statistics
// ─────────────────────────────────────────────────────────────────────────────
async function fetchBandStats(cogUrl: string, featureGeoJSON: object): Promise<{ mean: number } | null> {
  try {
    const url = `${TITILER_URL}/cog/statistics?url=${encodeURIComponent(cogUrl)}`
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(featureGeoJSON),
      signal:  AbortSignal.timeout(12000),
    })

    if (!res.ok) {
      console.warn(`[NDVI] ⚠ TiTiler ${res.status} para ${url.substring(0, 80)}...`)
      return null
    }

    const data = await res.json()
    const bandKey = Object.keys(data)[0]
    return data[bandKey] ? { mean: data[bandKey].mean } : null
  } catch (err: any) {
    console.warn(`[NDVI] ⚠ TiTiler fetch error: ${err.message}`)
    return null
  }
}
