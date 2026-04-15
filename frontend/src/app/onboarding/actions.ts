'use server'

import { revalidatePath } from 'next/cache'
import { queryOne, mutate, query } from '@/lib/db'

/**
 * Extrae el objeto Geometry de un GeoJSON que puede ser:
 *  - una Feature  { type: 'Feature', geometry: {...} }
 *  - directamente una Geometry { type: 'Polygon', coordinates: [...] }
 *  - null / undefined
 */
function extractGeometry(geojson: any): any | null {
  if (!geojson) return null
  if (geojson.type === 'Feature') return geojson.geometry ?? null
  if (geojson.type === 'FeatureCollection') {
    const first = geojson.features?.[0]
    return first ? extractGeometry(first) : null
  }
  // Already a Geometry (Polygon, MultiPolygon, etc.)
  if (geojson.type && geojson.coordinates) return geojson
  return null
}

/**
 * finishOnboarding — Server Action
 * Called from Step4Confirm.tsx with firebaseUid + all onboarding data.
 * Saves directly to GCP Cloud SQL via the DB pool.
 */
export async function finishOnboarding(formData: {
  firebaseUid: string
  fieldName: string
  totalArea: number
  location: { lat: number; lng: number; address: string }
  fieldBoundary: any
  fieldBoundaryHa: number
  herds: any[]
  paddocks: Array<{ name: string; geojson: any; area_ha: number; dry_matter_kg_ha?: number }>
}) {
  if (!formData.firebaseUid) throw new Error('No session')

  // 1. Get Profile → Org
  const profile = await queryOne<{ organization_id: string; id: string }>(
    'SELECT id, organization_id FROM profiles WHERE firebase_uid = $1',
    [formData.firebaseUid]
  )
  if (!profile?.organization_id) throw new Error('Profile/Org not found for uid: ' + formData.firebaseUid)

  const orgId = profile.organization_id
  const areaHa = formData.fieldBoundaryHa || formData.totalArea || 0

  // 2. Update Organization — safely extract geometry
  const fieldGeom = extractGeometry(formData.fieldBoundary)
  const locGeom   = { type: 'Point', coordinates: [formData.location.lng, formData.location.lat] }

  try {
    if (fieldGeom) {
      await mutate(
        `UPDATE organizations SET
           name          = $1,
           total_area_ha = $2,
           location      = ST_SetSRID(ST_GeomFromGeoJSON($3), 4326),
           boundaries    = ST_SetSRID(ST_GeomFromGeoJSON($4), 4326),
           updated_at    = NOW()
         WHERE id = $5`,
        [
          formData.fieldName,
          areaHa,
          JSON.stringify(locGeom),
          JSON.stringify(fieldGeom),
          orgId,
        ]
      )
    } else {
      // No boundary drawn — save name, area AND location point from step 1
      await mutate(
        `UPDATE organizations SET name = $1, total_area_ha = $2,
         location = ST_SetSRID(ST_GeomFromGeoJSON($3), 4326),
         updated_at = NOW() WHERE id = $4`,
        [formData.fieldName, areaHa, JSON.stringify(locGeom), orgId]
      )
    }
  } catch (err: any) {
    console.error('Error updating organization:', err.message)
    // If geometry fails, at least save name/area
    try {
      await mutate(
        `UPDATE organizations SET name = $1, total_area_ha = $2, updated_at = NOW() WHERE id = $3`,
        [formData.fieldName, areaHa, orgId]
      )
    } catch (e2: any) {
      console.error('Fallback org update also failed:', e2.message)
    }
  }

  // 3. Insert Paddocks
  if (formData.paddocks && formData.paddocks.length > 0) {
    for (const p of formData.paddocks) {
      const geomJson = extractGeometry(p.geojson)
      if (!geomJson) {
        console.warn('Skipping paddock without valid geometry:', p.name)
        continue
      }
      try {
        if (p.dry_matter_kg_ha && p.dry_matter_kg_ha > 0) {
          await mutate(
            `INSERT INTO paddocks (org_id, name, area_ha, current_status, dry_matter_kg_ha, geom)
             VALUES ($1, $2, $3, 'RESTING', $4, ST_SetSRID(ST_GeomFromGeoJSON($5), 4326))`,
            [orgId, p.name, p.area_ha, p.dry_matter_kg_ha, JSON.stringify(geomJson)]
          )
        } else {
          await mutate(
            `INSERT INTO paddocks (org_id, name, area_ha, current_status, geom)
             VALUES ($1, $2, $3, 'RESTING', ST_SetSRID(ST_GeomFromGeoJSON($4), 4326))`,
            [orgId, p.name, p.area_ha, JSON.stringify(geomJson)]
          )
        }
      } catch (err: any) {
        console.error('Insert paddock error:', err.message, p.name)
      }
    }
  }

  // 4. Insert Herds — admission_date and age_months now exist in table
  if (formData.herds && formData.herds.length > 0) {
    for (const h of formData.herds) {
      try {
        // Try full insert with all columns
        await mutate(
          `INSERT INTO herds
             (org_id, name, species, breed, head_count, avg_weight_kg, total_ev, categoria, admission_date, age_months)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            orgId,
            h.name,
            h.species     || 'Bovine',
            h.breed       || null,
            h.headCount,
            h.avgWeight   || null,
            h.totalEV     || 0,
            h.categoria   || null,
            h.admissionDate || null,
            h.ageMonths   ?? null,
          ]
        )
      } catch (err: any) {
        console.error('Insert herd (full) error:', err.message, h.name)
        // Fallback: insert only guaranteed columns
        try {
          await mutate(
            `INSERT INTO herds (org_id, name, species, breed, head_count, avg_weight_kg, total_ev, categoria)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [orgId, h.name, h.species || 'Bovine', h.breed || null,
             h.headCount, h.avgWeight || null, h.totalEV || 0, h.categoria || null]
          )
        } catch (fallbackErr: any) {
          console.error('Insert herd (fallback) also failed:', fallbackErr.message, h.name)
        }
      }
    }
  }

  // 5. Update Profile — mark onboarding complete (step 4 = fully done)
  await mutate(
    `UPDATE profiles SET onboarding_step = 4, updated_at = NOW() WHERE firebase_uid = $1`,
    [formData.firebaseUid]
  )

  revalidatePath('/onboarding')
  revalidatePath('/dashboard')

  return { success: true }
}
