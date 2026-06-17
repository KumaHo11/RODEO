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
         ST_AsGeoJSON(p.geom)::json AS boundary,
         ST_AsGeoJSON(p.geom)::json AS geometry,
         (SELECT MAX(recorded_at) FROM biological_monitoring bm WHERE bm.paddock_id = p.id) as last_monitoring_date
       FROM paddocks p
       WHERE p.org_id = $1
       ORDER BY p.name ASC`,
      [auth.orgId]
    )

    return NextResponse.json({ paddocks })
  } catch (err: any) {
    console.error('GET /api/paddocks error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
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

    const body = await req.json()
    const {
      name, area_ha, geojson, current_status = 'RESTING',
      technical_data, dry_matter_kg_ha, boundary,
    } = body

    if (!name) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

    // Accept both geojson (drawn polygon) and boundary (KML)
    const geomJson = extractGeometry(geojson) ?? extractGeometry(boundary)

    let result
    if (geomJson) {
      result = await serviceMutate(
        `INSERT INTO paddocks (org_id, name, area_ha, current_status, geom, technical_data, dry_matter_kg_ha)
         VALUES ($1, $2, $3, $4, ST_SetSRID(ST_GeomFromGeoJSON($5), 4326), $6::jsonb, $7)
         RETURNING id`,
        [
          auth.orgId,
          name,
          area_ha || 0,
          current_status,
          JSON.stringify(geomJson),
          JSON.stringify(technical_data ?? {}),
          dry_matter_kg_ha ?? null,
        ]
      )
    } else {
      result = await serviceMutate(
        `INSERT INTO paddocks (org_id, name, area_ha, current_status, technical_data, dry_matter_kg_ha)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6)
         RETURNING id`,
        [
          auth.orgId,
          name,
          area_ha || 0,
          current_status,
          JSON.stringify(technical_data ?? {}),
          dry_matter_kg_ha ?? null,
        ]
      )
    }

    const id = result.rows[0]?.id

    // Log initial dry matter in biological_monitoring if provided
    if (dry_matter_kg_ha !== undefined && dry_matter_kg_ha !== null && id) {
      await serviceMutate(
        `INSERT INTO biological_monitoring (paddock_id, dry_matter_estimate_kg, recorded_at)
         VALUES ($1, $2, NOW())`,
        [id, dry_matter_kg_ha]
      )
    }

    return NextResponse.json({ id }, { status: 201 })
  } catch (err: any) {
    console.error('POST /api/paddocks error:', err)
    return NextResponse.json({ error: 'Error del servidor: ' + err.message }, { status: 500 })
  }
}
