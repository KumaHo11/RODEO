/**
 * GET  /api/paddocks  — Lista de potreros de la organización (con GeoJSON)
 * POST /api/paddocks  — Crea un nuevo potrero
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { queryOne, query, mutate } from '@/lib/db'

async function getOrgId(req: NextRequest): Promise<{ orgId: string; uid: string } | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim() || ''
  if (!token) return null
  const decoded = await verifyFirebaseToken(token)
  if (!decoded) return null
  const profile = await queryOne<{ organization_id: string }>(
    'SELECT organization_id FROM profiles WHERE firebase_uid = $1',
    [decoded.uid]
  )
  if (!profile?.organization_id) return null
  return { orgId: profile.organization_id, uid: decoded.uid }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getOrgId(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const paddocks = await query(
      `SELECT
         id, org_id, name, area_ha, current_status, is_grazable,
         estimated_adh, dry_matter_kg_ha, current_ndvi,
         previous_dry_matter_kg_ha, previous_ndvi_date, technical_data,
         created_at, updated_at,
         ST_AsGeoJSON(geom)::json AS boundary,
         ST_AsGeoJSON(geom)::json AS geometry
       FROM paddocks
       WHERE org_id = $1
       ORDER BY name ASC`,
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
    const auth = await getOrgId(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const { name, area_ha, geojson, current_status = 'RESTING' } = body

    if (!name) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

    const geomJson = extractGeometry(geojson)

    let result
    if (geomJson) {
      result = await mutate(
        `INSERT INTO paddocks (org_id, name, area_ha, current_status, geom)
         VALUES ($1, $2, $3, $4, ST_SetSRID(ST_GeomFromGeoJSON($5), 4326))
         RETURNING id`,
        [auth.orgId, name, area_ha || 0, current_status, JSON.stringify(geomJson)]
      )
    } else {
      result = await mutate(
        `INSERT INTO paddocks (org_id, name, area_ha, current_status)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [auth.orgId, name, area_ha || 0, current_status]
      )
    }

    const id = result.rows[0]?.id
    return NextResponse.json({ id }, { status: 201 })
  } catch (err: any) {
    console.error('POST /api/paddocks error:', err)
    return NextResponse.json({ error: 'Error del servidor: ' + err.message }, { status: 500 })
  }
}
