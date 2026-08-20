/**
 * GET /api/eudr/timeline/[animalId]
 *
 * Reconstruye la línea de vida (cadena de custodia) de un animal individual.
 * Consolida animal_events + grazing_plans con estado de deforestación por potrero.
 * Usado para validar la cadena de custodia EUDR antes de emitir una DDS.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { serviceQuery, serviceQueryOne } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ animalId: string }> }
) {
  try {
    const auth = await requireAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { animalId } = await params
    if (!animalId) return NextResponse.json({ error: 'animalId requerido' }, { status: 400 })

    // 1. Verify animal belongs to org
    const animal = await serviceQueryOne<any>(`
      SELECT
        a.id, a.rfid_code, a.visual_tag, a.name, a.sex, a.breed,
        a.birth_date, a.status, a.org_id,
        p.name AS current_paddock_name,
        h.name AS current_herd_name
      FROM animals a
      LEFT JOIN paddocks p ON p.id = a.current_paddock_id
      LEFT JOIN herds h ON h.id = a.current_herd_id
      WHERE a.id = $1 AND a.org_id = $2
    `, [animalId, auth.orgId])

    if (!animal) {
      return NextResponse.json({ error: 'Animal no encontrado' }, { status: 404 })
    }

    // 2. Animal Events (bitácora individual) — sorted ascending
    const events = await serviceQuery<any>(`
      SELECT
        ae.id,
        ae.event_type,
        ae.event_date,
        ae.details,
        ae.photo_urls,
        ae.source,
        pr.first_name || ' ' || pr.last_name AS recorded_by_name,
        -- If the event has a paddock_id in details, join to paddocks + deforestation
        CASE WHEN (ae.details->>'paddock_id') IS NOT NULL THEN
          (SELECT name FROM paddocks WHERE id = (ae.details->>'paddock_id')::UUID)
        END AS paddock_name,
        CASE WHEN (ae.details->>'paddock_id') IS NOT NULL THEN
          (SELECT eudr_area_ha FROM paddocks WHERE id = (ae.details->>'paddock_id')::UUID)
        END AS paddock_eudr_area_ha,
        CASE WHEN (ae.details->>'paddock_id') IS NOT NULL THEN
          (SELECT status FROM deforestation_checks WHERE paddock_id = (ae.details->>'paddock_id')::UUID ORDER BY checked_at DESC LIMIT 1)
        END AS paddock_deforestation_status
      FROM animal_events ae
      LEFT JOIN profiles pr ON pr.id = ae.recorded_by
      WHERE ae.animal_id = $1 AND ae.org_id = $2
      ORDER BY ae.event_date ASC
    `, [animalId, auth.orgId])

    // 3. Grazing plans from the herds this animal has belonged to
    // We use the animal's current herd, plus any MOVIMIENTO events that reference past herds
    const grazingHistory = await serviceQuery<any>(`
      SELECT
        gp.id AS plan_id,
        gp.entry_date,
        gp.exit_date,
        gp.actual_entry_date,
        gp.actual_exit_date,
        gp.status AS plan_status,
        gp.cycle_id,
        p.id AS paddock_id,
        p.name AS paddock_name,
        p.area_ha,
        p.eudr_area_ha,
        p.eudr_geom_type,
        h.id AS herd_id,
        h.name AS herd_name,
        dc.status AS deforestation_status,
        dc.confidence AS deforestation_confidence,
        dc.checked_at AS deforestation_checked_at
      FROM grazing_plans gp
      JOIN paddocks p ON p.id = gp.paddock_id
      JOIN herds h ON h.id = gp.herd_id
      LEFT JOIN (
        SELECT DISTINCT ON (paddock_id) paddock_id, status, confidence, checked_at
        FROM deforestation_checks
        WHERE org_id = $2
        ORDER BY paddock_id, checked_at DESC
      ) dc ON dc.paddock_id = p.id
      WHERE gp.org_id = $2
        AND gp.herd_id = (
          SELECT current_herd_id FROM animals WHERE id = $1
        )
        AND gp.status IN ('COMPLETED', 'ACTIVE', 'HISTORY')
      ORDER BY COALESCE(gp.actual_entry_date, gp.entry_date) ASC
    `, [animalId, auth.orgId])

    // 4. EUDR chain of custody analysis
    const paddocksVisited = new Map<string, any>()
    let allPaddocksClean = true
    let hasMissingChecks = false
    let hasInvalidGeometry = false

    for (const gp of grazingHistory) {
      if (!paddocksVisited.has(gp.paddock_id)) {
        paddocksVisited.set(gp.paddock_id, gp)
      }
      if (gp.deforestation_status === 'DEFORESTED') allPaddocksClean = false
      if (!gp.deforestation_status || gp.deforestation_status === 'PENDING') hasMissingChecks = true
      if (gp.eudr_geom_type === 'INVALID') hasInvalidGeometry = true
    }

    const custodyStatus =
      !allPaddocksClean ? 'FAIL' :
      hasMissingChecks || hasInvalidGeometry ? 'WARNING' :
      grazingHistory.length === 0 ? 'INCOMPLETE' :
      'PASS'

    const custodyIssues: string[] = []
    if (!allPaddocksClean) custodyIssues.push('Uno o más potreros tienen deforestación detectada post-2020')
    if (hasMissingChecks) custodyIssues.push('Algunos potreros no tienen verificación de deforestación actualizada')
    if (hasInvalidGeometry) custodyIssues.push('Hay potreros con geometría inválida — corregir antes de emitir DDS')
    if (grazingHistory.length === 0) custodyIssues.push('No se registraron rotaciones de pastoreo para este animal')
    if (!animal.birth_date) custodyIssues.push('El animal no tiene fecha de nacimiento registrada')

    return NextResponse.json({
      animal,
      events,
      grazing_history: grazingHistory,
      paddocks_visited: Array.from(paddocksVisited.values()),
      custody_analysis: {
        status: custodyStatus,         // 'PASS' | 'FAIL' | 'WARNING' | 'INCOMPLETE'
        issues: custodyIssues,
        total_paddocks_visited: paddocksVisited.size,
        all_paddocks_clean: allPaddocksClean,
        has_missing_checks: hasMissingChecks,
        has_invalid_geometry: hasInvalidGeometry,
        total_grazing_events: grazingHistory.length,
      },
    })
  } catch (err: any) {
    console.error('[GET /api/eudr/timeline]', err)
    return NextResponse.json({ error: 'Error del servidor: ' + err.message }, { status: 500 })
  }
}
