/**
 * GET   /api/organizations  — Datos de la organización actual
 * PATCH /api/organizations  — Actualiza la organización
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { serviceQueryOne, serviceMutate } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Columns are managed by full_schema_migration.js

async function getOrgId(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim() || ''
  if (!token) return null
  const decoded = await verifyFirebaseToken(token).catch(() => null)
  if (!decoded) return null
  let profile: { organization_id: string } | null = null
  try {
    profile = await serviceQueryOne<{ organization_id: string }>(
      'SELECT organization_id FROM profiles WHERE firebase_uid = $1',
      [decoded.uid]
    )
  } catch (dbErr: any) {
    console.error('[organizations] DB error in getOrgId:', dbErr?.message)
    return null
  }
  if (!profile?.organization_id) return null
  return { orgId: profile.organization_id, uid: decoded.uid }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getOrgId(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const org = await serviceQueryOne(
      `SELECT
         id, owner_id, name, total_area_ha, region_id, drought_plan_buffer,
         default_daily_allocation_kg, default_target_remnant_kg_ha,
         location_label, technical_data,
         ST_AsGeoJSON(location)::json AS location,
         ST_AsGeoJSON(boundaries)::json AS boundaries,
         created_at, updated_at
       FROM organizations
       WHERE id = $1`,
      [auth.orgId]
    )

    return NextResponse.json({ organization: org })
  } catch (err: any) {
    console.error('GET /api/organizations error:', err)
    return NextResponse.json({ error: 'Error interno del servidor', detail: err?.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getOrgId(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const {
      name, total_area_ha, region_id, boundaries,
      default_daily_allocation_kg, default_target_remnant_kg_ha,
      location_label, technical_data
    } = body

    const sets: string[] = ['updated_at = NOW()']
    const vals: any[] = []
    let i = 1

    if (name !== undefined)           { sets.push(`name = $${i++}`);           vals.push(name) }
    if (total_area_ha !== undefined)  { sets.push(`total_area_ha = $${i++}`);  vals.push(total_area_ha) }
    if (region_id !== undefined)      { sets.push(`region_id = $${i++}`);      vals.push(region_id) }
    if (location_label !== undefined) { sets.push(`location_label = $${i++}`); vals.push(location_label) }
    if (technical_data !== undefined) { sets.push(`technical_data = $${i++}`); vals.push(JSON.stringify(technical_data)) }
    if (default_daily_allocation_kg !== undefined)  { sets.push(`default_daily_allocation_kg = $${i++}`);  vals.push(Number(default_daily_allocation_kg)) }
    if (default_target_remnant_kg_ha !== undefined) { sets.push(`default_target_remnant_kg_ha = $${i++}`); vals.push(Number(default_target_remnant_kg_ha)) }
    if (boundaries !== undefined) {
      if (boundaries === null) {
        sets.push(`boundaries = NULL`)
      } else {
        const geomJson = boundaries.geometry ?? boundaries
        sets.push(`boundaries = ST_SetSRID(ST_GeomFromGeoJSON($${i++}), 4326)`)
        vals.push(JSON.stringify(geomJson))
      }
    }

    vals.push(auth.orgId)
    await serviceMutate(`UPDATE organizations SET ${sets.join(', ')} WHERE id = $${i}`, vals)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('PATCH /api/organizations error:', err)
    return NextResponse.json({ error: 'Error interno del servidor', detail: err?.message }, { status: 500 })
  }
}
