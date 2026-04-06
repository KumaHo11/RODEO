/**
 * PATCH /api/auth/onboarding-step
 * Persists onboarding step + partial data to DB so the user can resume
 * if they exit mid-flow.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { mutate, query } from '@/lib/db'

export async function PATCH(req: NextRequest) {
  try {
    const idToken = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!idToken) return NextResponse.json({ error: 'No token' }, { status: 401 })

    const decoded = await verifyFirebaseToken(idToken)
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    const { uid } = decoded
    const body = await req.json()
    const { step, fieldName, location } = body

    // Update onboarding_step in profiles
    await mutate(
      `UPDATE profiles SET onboarding_step = $1, updated_at = NOW() WHERE firebase_uid = $2`,
      [step, uid]
    )

    // If step >= 1 and we have field data, persist it to organizations
    if (step >= 1 && (fieldName || location)) {
      const profileRows = await query(
        `SELECT organization_id FROM profiles WHERE firebase_uid = $1`,
        [uid]
      )
      const orgId = profileRows[0]?.organization_id
      if (orgId) {
        // Always save the field name first (never blocked by geometry errors)
        if (fieldName) {
          try {
            await mutate(
              `UPDATE organizations SET name = $1, updated_at = NOW() WHERE id = $2`,
              [fieldName, orgId]
            )
          } catch (nameErr: any) {
            console.error('onboarding-step: name update failed:', nameErr.message)
          }
        }

        // Save location geometry separately — if it fails, name is already saved
        if (location) {
          try {
            const locGeom = { type: 'Point', coordinates: [location.lng, location.lat] }
            await mutate(
              `UPDATE organizations SET location = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), updated_at = NOW() WHERE id = $2`,
              [JSON.stringify(locGeom), orgId]
            )
          } catch (locErr: any) {
            console.error('onboarding-step: location geometry update failed:', locErr.message)
            // Non-fatal: name was already saved
          }
        }
      }
    }


    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('PATCH /api/auth/onboarding-step error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
