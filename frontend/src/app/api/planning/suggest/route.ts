import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { queryOne, query } from '@/lib/db'

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

export async function POST(req: NextRequest) {
  try {
    const auth = await getOrgId(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const payload = await req.json()
    const { herd_id, start_date, start_paddock_id, limit = 5, utilization_percent = 50 } = payload

    if (!herd_id || !start_date) {
      return NextResponse.json({ error: 'herd_id y start_date requeridos' }, { status: 400 })
    }

    // 1. Obtener EV del rebaño
    const herd = await queryOne<{ total_ev: number }>('SELECT total_ev FROM herds WHERE id = $1 AND org_id = $2', [herd_id, auth.orgId])
    if (!herd) return NextResponse.json({ error: 'Rebaño no encontrado' }, { status: 404 })
    const totalEV = Number(herd.total_ev) || 1

    // 2. Obtener temporalidad (otoño, invierno, etc.)
    const m = new Date(start_date).getMonth() + 1
    let recoveryPenaltyDays = 60
    if (m >= 12 || m <= 2) recoveryPenaltyDays = 40 // Verano
    if (m >= 3 && m <= 5) recoveryPenaltyDays = 65  // Otoño
    if (m >= 6 && m <= 8) recoveryPenaltyDays = 95  // Invierno
    if (m >= 9 && m <= 11) recoveryPenaltyDays = 45 // Primavera

    const utlizationDecimal = (utilization_percent || 50) / 100 // Default 50%

    // 3. PostGIS: Consultar todos los potreros disponibles y variables de Forraje + Geometría
    const candidateQuery = `
      SELECT
        p.id as paddock_id,
        p.name,
        p.area_ha,
        p.dry_matter_kg_ha,
        p.estimated_adh,
        ST_X(ST_Centroid(p.geom)) as lng,
        ST_Y(ST_Centroid(p.geom)) as lat,
        -- Variable forrajera
        COALESCE(p.dry_matter_kg_ha, p.estimated_adh * 66, 0) as ms_actual,
        (SELECT MAX(exit_date) FROM grazing_plans cp WHERE cp.paddock_id = p.id AND status = 'COMPLETED') as last_grazed_date
      FROM paddocks p
      WHERE p.org_id = $1 AND p.is_grazable = true AND p.current_status = 'RESTING'
    `
    const candidatesResult = await query<any>(candidateQuery, [auth.orgId])
    let candidates = candidatesResult

    // Variable PostGIS de distancia entre potreros se puede emular pidiendo distancias relativas al start_paddock_id
    // Si tenemos un paddock inicial, obtenemos sus coordenadas para medir distancias
    let currentCentroid: { lng: number, lat: number } | null = null
    if (start_paddock_id) {
       const initialCoordsQuery = `SELECT ST_X(ST_Centroid(geom)) as lng, ST_Y(ST_Centroid(geom)) as lat FROM paddocks WHERE id = $1`
       const res = await queryOne<{lng: number, lat: number}>(initialCoordsQuery, [start_paddock_id])
       if (res) currentCentroid = res
    }

    if (!currentCentroid && candidates.length > 0) {
      currentCentroid = { lng: candidates[0].lng, lat: candidates[0].lat }
    }

    let currentDate = new Date(start_date)
    const suggestedPlans = []

    for (let step = 0; step < limit; step++) {
      if (candidates.length === 0) break

      // Si tenemos centroid, podemos buscar el más cercano en JS para no saturar DB, pero usamos PostGIS en DB idealmente.
      // Como ya extrajimos en la primera query los candidatos con lng/lat, podemos ordenar por Score heurístico aquí:
      // Score = Dias de Forraje (positivo) - Penalización por Distancia (negativo) - Penalización por falta descanso
      let bestCandidate = null
      let bestScore = -Infinity
      let bestDays = 0

      for (const c of candidates) {
        // T_i = ((MS_actual * util) * Ha) / (EV_total * 12)
        const msActual = Number(c.ms_actual)
        const area = Number(c.area_ha) || 1
        const dryMatterAvailable = msActual * utlizationDecimal * area
        const daysStay = Math.floor(dryMatterAvailable / (totalEV * 12)) // 12 kg requirement as requested
        
        let score = daysStay

        // Distancia relativa aproximada (grados a metros estimación rapida) o ignorar si no hay currentCentroid
        let distanceMeters = 0
        if (currentCentroid && c.lng != null && c.lat != null) {
           // Usar formula haversine o equirectangular simple
           const R = 6371e3; // metres
           const φ1 = currentCentroid.lat * Math.PI/180;
           const φ2 = c.lat * Math.PI/180;
           const Δφ = (c.lat-currentCentroid.lat) * Math.PI/180;
           const Δλ = (c.lng-currentCentroid.lng) * Math.PI/180;
           const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
           const cc = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
           distanceMeters = R * cc;
        }

        // Penalizar largas caminatas (>500m)
        if (distanceMeters > 500) {
          score -= (distanceMeters - 500) * 0.01 // penalidad suave
        }

        // Penalizar tiempo de descanso
        if (c.last_grazed_date) {
            const restDays = Math.floor((currentDate.getTime() - new Date(c.last_grazed_date).getTime()) / 86400000)
            if (restDays < recoveryPenaltyDays) {
                score -= (recoveryPenaltyDays - restDays) // castigo directo
            }
        }

        if (score > bestScore && daysStay > 0) {
            bestScore = score
            bestCandidate = c
            bestDays = daysStay
        }
      }

      if (!bestCandidate) break // No more suitable paddocks (all have 0 days)

      const entryIso = currentDate.toISOString().split('T')[0]
      currentDate.setDate(currentDate.getDate() + bestDays)
      const exitIso = currentDate.toISOString().split('T')[0]

      suggestedPlans.push({
          paddock_id: bestCandidate.paddock_id,
          name: bestCandidate.name,
          herd_id: herd_id,
          entry_date: entryIso,
          exit_date: exitIso,
          days: bestDays,
          status: 'PLANNED',
          warning: bestDays < 2 ? 'Estancia muy corta' : null
      })

      // Actualizar centroid para el siguiente paso
      currentCentroid = { lng: bestCandidate.lng, lat: bestCandidate.lat }
      // Remover de candidatos
      candidates = candidates.filter((c: any) => c.paddock_id !== bestCandidate.paddock_id)
    }

    return NextResponse.json({ suggestions: suggestedPlans })
  } catch (err: any) {
    console.error('POST /api/planning/suggest error:', err)
    return NextResponse.json({ error: 'Error del servidor: ' + err.message }, { status: 500 })
  }
}
