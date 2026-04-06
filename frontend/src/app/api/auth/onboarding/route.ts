/**
 * POST /api/auth/onboarding
 * Completa el setup inicial del campo
 * Reemplaza: onboarding/actions.ts (server action con Supabase)
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { queryOne, mutate } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
    if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const decoded = await verifyFirebaseToken(token)
    if (!decoded) return NextResponse.json({ error: "Token inválido" }, { status: 401 })
    const firebaseUid = decoded.uid

    const body = await req.json()
    const { fieldName, totalArea, location, fieldBoundary, fieldBoundaryHa, herds, paddocks } = body

    // Obtener perfil + orgId
    const profile = await queryOne<{ id: string; organization_id: string }>(
      `SELECT id, organization_id FROM profiles WHERE firebase_uid = $1`,
      [firebaseUid]
    )
    if (!profile?.organization_id) {
      return NextResponse.json({ error: 'Perfil/Org no encontrado' }, { status: 404 })
    }
    const orgId = profile.organization_id

    // 1. Actualizar organización
    const fieldGeom = fieldBoundary?.geometry ?? fieldBoundary
    const areaHa = fieldBoundaryHa || totalArea

    await mutate(
      `UPDATE organizations SET
         name = $1,
         total_area_ha = $2,
         location = ST_SetSRID(ST_GeomFromGeoJSON($3), 4326),
         boundaries = ST_SetSRID(ST_GeomFromGeoJSON($4), 4326),
         updated_at = NOW()
       WHERE id = $5`,
      [
        fieldName,
        areaHa,
        JSON.stringify({ type: 'Point', coordinates: [location.lng, location.lat] }),
        JSON.stringify(fieldGeom),
        orgId,
      ]
    )

    // 2. Insertar potreros
    if (paddocks?.length > 0) {
      for (const p of paddocks) {
        const geom = p.geojson?.geometry ?? p.geojson
        await mutate(
          `INSERT INTO paddocks (org_id, name, area_ha, geom)
           VALUES ($1, $2, $3, ST_SetSRID(ST_GeomFromGeoJSON($4), 4326))`,
          [orgId, p.name, p.area_ha, JSON.stringify(geom)]
        )
      }
    }

    // 3. Insertar rodeos
    if (herds?.length > 0) {
      for (const h of herds) {
        await mutate(
          `INSERT INTO herds (org_id, name, species, breed, head_count, avg_weight_kg, total_ev)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [orgId, h.name, h.species, h.breed, h.headCount, h.avgWeight, h.totalEV]
        )
      }
    }

    // 4. Marcar onboarding completo
    await mutate(
      `UPDATE profiles SET onboarding_step = 3, updated_at = NOW() WHERE firebase_uid = $1`,
      [firebaseUid]
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('POST /api/auth/onboarding error:', err)
    return NextResponse.json({ error: 'Error al guardar el campo: ' + err.message }, { status: 500 })
  }
}
