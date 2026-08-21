/**
 * GET  /api/paddocks  — Lista de potreros de la organización (con GeoJSON)
 * POST /api/paddocks  — Crea uno o más potreros desde un GeoJSON
 *
 * FIX v27-EUDR:
 *   - extractAllGeometries() procesa TODOS los Features de un FeatureCollection
 *     (antes extractGeometry() solo procesaba el primero — bug crítico para uploads de 20 potreros)
 *   - Detecta y advierte sobre CRS no-WGS84 (frecuente en archivos del Chaco con POSGAR/EPSG:5346)
 *   - Si el GeoJSON tiene N Features, crea N paddocks con nombres "{name} (1..N)"
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { serviceQuery, serviceMutate } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const paddocks = await serviceQuery(
      `SELECT
         p.id, p.org_id, p.name, p.area_ha, p.current_status, p.is_grazable,
         p.is_active,
         p.estimated_adh, p.dry_matter_kg_ha, p.current_ndvi,
         p.previous_dry_matter_kg_ha, p.previous_ndvi_date, p.technical_data,
         p.created_at, p.updated_at,
         -- EUDR GIS metadata (populated by v26 trigger)
         p.eudr_area_ha,
         p.eudr_geom_type,
         p.eudr_validated_at,
         ST_AsGeoJSON(p.geom)::json AS boundary,
         ST_AsGeoJSON(p.geom)::json AS geometry,
         (SELECT MAX(recorded_at) FROM biological_monitoring bm WHERE bm.paddock_id = p.id) as last_monitoring_date,
         (SELECT status FROM deforestation_checks dc WHERE dc.paddock_id = p.id ORDER BY checked_at DESC LIMIT 1) as deforestation_status
       FROM paddocks p
       WHERE p.org_id = $1
       ORDER BY p.name ASC`,
      [auth.orgId]
    )

    return NextResponse.json({ paddocks })
  } catch (err: any) {
    console.error('GET /api/paddocks error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de geometría
// ─────────────────────────────────────────────────────────────────────────────

interface GeomResult {
  geometry: any
  /** Nombre opcional tomado del Feature.properties.name */
  featureName?: string
}

/**
 * Extrae TODAS las geometrías válidas de un GeoJSON arbitrario.
 * Soporta: Feature, FeatureCollection (N features), Geometry directa.
 * Detecta CRS no-WGS84 y emite una advertencia (no rechaza — la reproyección
 * se hace en PostgreSQL con ST_Transform cuando el SRID es conocido).
 */
function extractAllGeometries(geojson: any): { geoms: GeomResult[]; crs_warning: string | null } {
  if (!geojson) return { geoms: [], crs_warning: null }

  // Detectar CRS no-WGS84 declarado en el GeoJSON (ej. exportaciones de QGIS con POSGAR)
  let crs_warning: string | null = null
  const crsName: string = geojson?.crs?.properties?.name ?? ''
  if (crsName && !crsName.includes('4326') && !crsName.includes('CRS84') && !crsName.includes('WGS84')) {
    crs_warning = `CRS no-WGS84 detectado: "${crsName}". Verificar proyección antes de usar en TRACES-NT.`
    console.warn(`[POST /api/paddocks] ${crs_warning}`)
  }

  const VALID_TYPES = ['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon', 'GeometryCollection']

  function extractOne(obj: any): any | null {
    if (!obj) return null
    if (obj.type === 'Feature') return extractOne(obj.geometry)
    if (VALID_TYPES.includes(obj.type) && obj.coordinates) return obj
    return null
  }

  const geoms: GeomResult[] = []

  if (geojson.type === 'FeatureCollection') {
    // ✅ FIX: iterar TODOS los Features, no solo el primero
    for (const feature of (geojson.features ?? [])) {
      const g = extractOne(feature)
      if (g) {
        geoms.push({
          geometry: g,
          featureName: feature?.properties?.name ?? feature?.properties?.nombre ?? undefined,
        })
      }
    }
  } else if (geojson.type === 'Feature') {
    const g = extractOne(geojson)
    if (g) geoms.push({ geometry: g, featureName: geojson?.properties?.name ?? undefined })
  } else {
    const g = extractOne(geojson)
    if (g) geoms.push({ geometry: g })
  }

  return { geoms, crs_warning }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — Crear paddock(s)
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Payload JSON inválido' }, { status: 400 })
    }

    const {
      name, area_ha, geojson, current_status = 'RESTING',
      technical_data, dry_matter_kg_ha, boundary,
    } = body

    // Validaciones básicas
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'El nombre del potrero es requerido' }, { status: 400 })
    }

    const safeArea      = Math.max(0, Number(area_ha) || 0)
    const safeDryMatter = dry_matter_kg_ha !== undefined && dry_matter_kg_ha !== null
      ? Number(dry_matter_kg_ha)
      : null

    // Extraer geometría/s
    const rawGeojson = geojson ?? boundary
    const { geoms, crs_warning } = rawGeojson
      ? extractAllGeometries(rawGeojson)
      : { geoms: [], crs_warning: null }

    const createdIds: string[] = []
    const errors: { index: number; name: string; error: string }[] = []

    if (geoms.length === 0) {
      // ── Sin geometría: crear un único paddock sin geom ───────────────────
      try {
        const result = await serviceMutate(
          `INSERT INTO paddocks (org_id, name, area_ha, current_status, technical_data, dry_matter_kg_ha, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW(), NOW())
           RETURNING id`,
          [
            auth.orgId,
            name.trim(),
            safeArea,
            current_status,
            JSON.stringify(technical_data ?? {}),
            safeDryMatter,
          ]
        )
        const id = result.rows[0]?.id as string | undefined
        if (id) {
          createdIds.push(id)
          await logInitialDryMatter(id, safeDryMatter)
        }
      } catch (dbErr: any) {
        return NextResponse.json({
          error: 'Error al crear el potrero',
          detail: dbErr?.message,
        }, { status: 500 })
      }
    } else {
      // ── Con geometría: crear UN paddock por cada Feature ─────────────────
      for (let i = 0; i < geoms.length; i++) {
        const { geometry: geomJson, featureName } = geoms[i]

        // Nombre: usar el del Feature si existe, sino "{name} (N)" para multi
        const paddockName = featureName?.trim()
          || (geoms.length > 1 ? `${name.trim()} (${i + 1})` : name.trim())

        try {
          const result = await serviceMutate(
            // ST_Transform asegura WGS84 aunque el GeoJSON declare otro SRID
            // ST_MakeValid corrige self-intersections menores frecuentes en archivos del campo
            `INSERT INTO paddocks (org_id, name, area_ha, current_status, geom, technical_data, dry_matter_kg_ha, created_at, updated_at)
             VALUES ($1, $2, $3, $4,
               ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($5), 4326)),
               $6::jsonb, $7, NOW(), NOW())
             RETURNING id`,
            [
              auth.orgId,
              paddockName,
              safeArea,
              current_status,
              JSON.stringify(geomJson),
              JSON.stringify(technical_data ?? {}),
              safeDryMatter,
            ]
          )
          const id = result.rows[0]?.id as string | undefined
          if (id) {
            createdIds.push(id)
            await logInitialDryMatter(id, safeDryMatter)
          }
        } catch (dbErr: any) {
          const dbMsg: string = dbErr?.message ?? ''
          console.error(`POST /api/paddocks — geom error [${i}]:`, dbMsg)
          errors.push({ index: i, name: paddockName, error: dbMsg })
        }
      }
    }

    if (createdIds.length === 0 && errors.length > 0) {
      return NextResponse.json({
        error: 'Ningún potrero pudo ser creado',
        errors,
      }, { status: 400 })
    }

    return NextResponse.json({
      id:          createdIds[0] ?? null,   // backward compat con código existente
      ids:         createdIds,
      count:       createdIds.length,
      errors:      errors.length > 0 ? errors : undefined,
      crs_warning: crs_warning ?? undefined,
    }, { status: 201 })

  } catch (err: any) {
    console.error('POST /api/paddocks error:', err)
    return NextResponse.json({
      error: 'Error interno del servidor',
      detail: err?.message ?? 'Error desconocido',
    }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function logInitialDryMatter(paddockId: string, dryMatter: number | null) {
  if (dryMatter === null) return
  try {
    await serviceMutate(
      `INSERT INTO biological_monitoring (paddock_id, dry_matter_estimate_kg, recorded_at)
       VALUES ($1, $2, NOW())`,
      [paddockId, dryMatter]
    )
  } catch (e: any) {
    // No crítico — el potrero ya fue creado
    console.warn('POST /api/paddocks — biological_monitoring insert skipped:', e?.message)
  }
}
