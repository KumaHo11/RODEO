/**
 * GET    /api/paddocks/[id]  — Obtiene un potrero
 * PATCH  /api/paddocks/[id]  — Actualiza un potrero
 * DELETE /api/paddocks/[id]  — Elimina un potrero
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { serviceQueryOne, serviceMutate } from '@/lib/db'

async function getOrgId(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim() || ''
  if (!token) return null
  const decoded = await verifyFirebaseToken(token)
  if (!decoded) return null
  const profile = await serviceQueryOne<{ organization_id: string }>(
    'SELECT organization_id FROM profiles WHERE firebase_uid = $1',
    [decoded.uid]
  )
  if (!profile?.organization_id) return null
  return { orgId: profile.organization_id, uid: decoded.uid }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getOrgId(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const paddock = await serviceQueryOne(
      `SELECT id, name, area_ha, current_status, dry_matter_kg_ha, current_ndvi,
              is_active, estimated_adh, technical_data,
              ST_AsGeoJSON(geom)::json AS boundary
       FROM paddocks
       WHERE id = $1 AND org_id = $2`,
      [(await params).id, auth.orgId]
    )

    if (!paddock) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ paddock })
  } catch (err: any) {
    console.error('GET /api/paddocks/[id] error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getOrgId(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const {
      name, area_ha, current_status, dry_matter_kg_ha,
      current_ndvi, previous_dry_matter_kg_ha, previous_ndvi_date,
      technical_data, geojson, is_active, active_from
    } = body

    const sets: string[] = ['updated_at = NOW()']
    const vals: any[] = []
    let i = 1

    if (name !== undefined)                    { sets.push(`name = $${i++}`); vals.push(name) }
    if (area_ha !== undefined)                 { sets.push(`area_ha = $${i++}`); vals.push(area_ha) }
    if (current_status !== undefined)          { sets.push(`current_status = $${i++}`); vals.push(current_status) }
    if (dry_matter_kg_ha !== undefined)        { sets.push(`dry_matter_kg_ha = $${i++}`); vals.push(dry_matter_kg_ha) }
    if (current_ndvi !== undefined)            { sets.push(`current_ndvi = $${i++}`); vals.push(current_ndvi) }
    if (previous_dry_matter_kg_ha !== undefined) { sets.push(`previous_dry_matter_kg_ha = $${i++}`); vals.push(previous_dry_matter_kg_ha) }
    if (previous_ndvi_date !== undefined)      { sets.push(`previous_ndvi_date = $${i++}`); vals.push(previous_ndvi_date) }
    if (technical_data !== undefined)          { sets.push(`technical_data = $${i++}`); vals.push(JSON.stringify(technical_data)) }
    if (is_active !== undefined)               { sets.push(`is_active = $${i++}`); vals.push(is_active) }
    if (active_from !== undefined)             { sets.push(`active_from = $${i++}`); vals.push(active_from) }
    if (geojson !== undefined) {
      const geomJson = geojson.geometry ?? geojson
      sets.push(`geom = ST_SetSRID(ST_GeomFromGeoJSON($${i++}), 4326)`)
      vals.push(JSON.stringify(geomJson))
    }

    vals.push((await params).id, auth.orgId)
    await serviceMutate(
      `UPDATE paddocks SET ${sets.join(', ')} WHERE id = $${i++} AND org_id = $${i}`,
      vals
    )

    if (dry_matter_kg_ha !== undefined) {
      await serviceMutate(
        `INSERT INTO biological_monitoring (paddock_id, dry_matter_estimate_kg, recorded_at) VALUES ($1, $2, NOW())`,
        [(await params).id, dry_matter_kg_ha]
      )
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('PATCH /api/paddocks/[id] error:', err)
    return NextResponse.json({ error: 'Error interno del servidor', detail: err?.message }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getOrgId(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    await serviceMutate(
      'DELETE FROM paddocks WHERE id = $1 AND org_id = $2',
      [(await params).id, auth.orgId]
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('DELETE /api/paddocks/[id] error:', err)
    return NextResponse.json({ error: err.message || 'Error del servidor' }, { status: 500 })
  }
}
