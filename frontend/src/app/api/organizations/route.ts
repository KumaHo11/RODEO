/**
 * GET   /api/organizations  — Datos de la organización actual
 * PATCH /api/organizations  — Actualiza la organización
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { queryOne, mutate } from '@/lib/db'

// Migración on-demand: agrega columnas si no existen (idempotente)
async function ensurePlanningColumns() {
  await mutate(`
    ALTER TABLE organizations
      ADD COLUMN IF NOT EXISTS default_daily_allocation_kg  NUMERIC(8,2)  DEFAULT 12,
      ADD COLUMN IF NOT EXISTS default_target_remnant_kg_ha NUMERIC(10,2) DEFAULT 600
  `)
}

async function getOrgId(req: NextRequest) {
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

    await ensurePlanningColumns()

    const org = await queryOne(
      `SELECT
         id, owner_id, name, total_area_ha, region_id, drought_plan_buffer,
         default_daily_allocation_kg, default_target_remnant_kg_ha,
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
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getOrgId(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const { name, total_area_ha, region_id, boundaries, default_daily_allocation_kg, default_target_remnant_kg_ha } = body

    await ensurePlanningColumns()

    const sets: string[] = ['updated_at = NOW()']
    const vals: any[] = []
    let i = 1

    if (name !== undefined)         { sets.push(`name = $${i++}`); vals.push(name) }
    if (total_area_ha !== undefined) { sets.push(`total_area_ha = $${i++}`); vals.push(total_area_ha) }
    if (region_id !== undefined)    { sets.push(`region_id = $${i++}`); vals.push(region_id) }
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
    await mutate(`UPDATE organizations SET ${sets.join(', ')} WHERE id = $${i}`, vals)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('PATCH /api/organizations error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
