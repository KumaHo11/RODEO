/**
 * GET  /api/paddocks  — Lista de potreros de la organización (con GeoJSON)
 * POST /api/paddocks  — Crea un nuevo potrero
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

/** Extrae objeto Geometry de Feature, FeatureCollection, o Geometry directa */
function extractGeometry(geojson: any): any | null {
  if (!geojson) return null
  if (geojson.type === 'Feature') return geojson.geometry ?? null
  if (geojson.type === 'FeatureCollection') {
    const first = geojson.features?.[0]
    return first ? extractGeometry(first) : null
  }
  if (geojson.type && geojson.coordinates) return geojson
  return null
}

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

    const safeArea = Math.max(0, Number(area_ha) || 0)
    const safeDryMatter = dry_matter_kg_ha !== undefined && dry_matter_kg_ha !== null
      ? Number(dry_matter_kg_ha)
      : null

    // Extraer y validar geometría
    const geomJson = extractGeometry(geojson) ?? extractGeometry(boundary)

    // Verificar que el objeto de geometría sea un tipo PostGIS válido
    const VALID_GEOM_TYPES = ['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon', 'GeometryCollection']
    if (geomJson && !VALID_GEOM_TYPES.includes(geomJson.type)) {
      return NextResponse.json({ error: `Tipo de geometría inválido: "${geomJson.type}"` }, { status: 400 })
    }

    let result
    try {
      if (geomJson) {
        result = await serviceMutate(
          `INSERT INTO paddocks (org_id, name, area_ha, current_status, geom, technical_data, dry_matter_kg_ha, created_at, updated_at)
           VALUES ($1, $2, $3, $4, ST_SetSRID(ST_GeomFromGeoJSON($5), 4326), $6::jsonb, $7, NOW(), NOW())
           RETURNING id`,
          [
            auth.orgId,
            name.trim(),
            safeArea,
            current_status,
            JSON.stringify(geomJson),
            JSON.stringify(technical_data ?? {}),
            safeDryMatter,
          ]
        )
      } else {
        result = await serviceMutate(
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
      }
    } catch (dbErr: any) {
      // Mapear errores PostGIS/PostgreSQL conocidos a respuestas descriptivas
      const dbMsg: string = dbErr?.message ?? ''
      if (dbMsg.includes('ST_GeomFromGeoJSON') || dbMsg.includes('geometry')) {
        console.error('POST /api/paddocks — PostGIS geometry error:', dbMsg)
        return NextResponse.json({
          error: 'Geometría del polígono inválida. Verificá el trazado en el mapa.',
          detail: dbMsg,
        }, { status: 400 })
      }
      // Re-lanzar para que el catch externo lo maneje como 500 controlado
      throw dbErr
    }

    const id = result.rows[0]?.id

    // Log initial dry matter in biological_monitoring if provided
    if (safeDryMatter !== null && id) {
      try {
        await serviceMutate(
          `INSERT INTO biological_monitoring (paddock_id, dry_matter_estimate_kg, recorded_at)
           VALUES ($1, $2, NOW())`,
          [id, safeDryMatter]
        )
      } catch (bmErr: any) {
        // No crítico — el potrero ya fue creado
        console.warn('POST /api/paddocks — biological_monitoring insert skipped:', bmErr?.message)
      }
    }

    return NextResponse.json({ id }, { status: 201 })
  } catch (err: any) {
    console.error('POST /api/paddocks error:', err)
    return NextResponse.json({
      error: 'Error interno del servidor',
      detail: err?.message ?? 'Error desconocido',
    }, { status: 500 })
  }
}
