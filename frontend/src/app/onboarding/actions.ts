'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function finishOnboarding(formData: {
  fieldName: string
  totalArea: number
  location: { lat: number, lng: number, address: string }
  fieldBoundary: any
  fieldBoundaryHa: number
  herds: any[]
  paddocks: Array<{ name: string; geojson: any; area_ha: number }>
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No session')

  // 1. Get Profile → Org
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.organization_id) throw new Error('Profile/Org not found')

  const orgId = profile.organization_id

  // 2. Update Organization — use RPC for PostGIS geometries
  const fieldGeom = formData.fieldBoundary?.geometry ?? formData.fieldBoundary
  const locGeom = { type: 'Point', coordinates: [formData.location.lng, formData.location.lat] }

  const { error: orgError } = await supabase.rpc('update_org_onboarding_data', {
    p_name:               formData.fieldName,
    p_total_area:         formData.fieldBoundaryHa || formData.totalArea,
    p_location_geojson:   locGeom,
    p_boundaries_geojson: fieldGeom
  })

  if (orgError) throw new Error(`Org update failed: ${orgError.message}`)

  // 3. Insert Paddocks
  if (formData.paddocks && formData.paddocks.length > 0) {
    await Promise.all(
      formData.paddocks.map(p =>
        supabase.rpc('create_paddock', {
          p_name:    p.name,
          p_area_ha: p.area_ha,
          p_geojson: p.geojson?.geometry ?? p.geojson,
        })
      )
    )
  }

  // 4. Insert Herds
  if (formData.herds && formData.herds.length > 0) {
    const herdsToInsert = formData.herds.map(h => ({
      org_id:        orgId,
      name:          h.name,
      species:       h.species,
      breed:         h.breed,
      head_count:    h.headCount,
      avg_weight_kg: h.avgWeight,
      age_months:    h.age ?? 0,
      total_ev:      h.totalEV,
    }))

    const { error: herdsError } = await supabase
      .from('herds')
      .insert(herdsToInsert)

    if (herdsError) throw new Error(`Herds insertion failed: ${herdsError.message}`)
  }

  // 5. Update Profile onboarding step — CRITICAL: must reach step 3
  const { error: stepError } = await supabase
    .from('profiles')
    .update({ 
      onboarding_step: 3,
      country_code: user.user_metadata?.country_code || 'AR'
    })
    .eq('id', user.id)

  if (stepError) throw new Error(`Step update failed: ${stepError.message}`)

  revalidatePath('/onboarding')
  revalidatePath('/dashboard')
  
  return { success: true }
}
