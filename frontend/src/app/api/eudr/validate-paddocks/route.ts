/**
 * GET /api/eudr/validate-paddocks
 *
 * Valida el estado GIS de los paddocks de la organización para cumplimiento EUDR.
 * Clasifica cada paddock en POLYGON (≥4ha) o POINT (<4ha) según TRACES-NT.
 * Disparar esto siempre antes de generar una DDS.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { serviceQuery, serviceMutate } from '@/lib/db'

export const dynamic = 'force-dynamic'

export interface PaddockValidationResult {
  paddock_id: string
  paddock_name: string
  has_geometry: boolean
  area_ha: number | null
  eudr_area_ha: number | null
  eudr_geom_type: 'POLYGON' | 'POINT' | 'INVALID' | 'MISSING'
  deforestation_status: string | null
  deforestation_confidence: string | null
  is_valid_for_eudr: boolean
  validation_issues: string[]
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    // 1. Refresh GIS classifications for all paddocks with geometry
    // (idempotent — the trigger also does this on update, but we force it here for fresh data)
    try {
      await serviceMutate(`
        DO $$
        DECLARE rec RECORD;
        BEGIN
            FOR rec IN SELECT id FROM paddocks WHERE geom IS NOT NULL AND org_id = $1 LOOP
                PERFORM update_paddock_eudr_gis(rec.id);
            END LOOP;
        END $$;
      `.replace('$1', `'${auth.orgId}'`), [])
    } catch (e: any) {
      // update_paddock_eudr_gis function might not be deployed yet — handle gracefully
      console.warn('[eudr/validate-paddocks] PostGIS function not available:', e.message)
    }

    // 2. Fetch paddocks with latest deforestation check
    const rows = await serviceQuery<any>(`
      SELECT
        p.id,
        p.name,
        p.area_ha,
        p.geom IS NOT NULL AS has_geometry,
        p.eudr_area_ha,
        p.eudr_geom_type,
        p.eudr_validated_at,
        COALESCE(
          ST_Area(p.geom::geography) / 10000.0,
          p.area_ha
        ) AS computed_area_ha,
        ST_IsValid(p.geom) AS geom_is_valid,
        dc.status AS deforestation_status,
        dc.confidence AS deforestation_confidence,
        dc.checked_at AS deforestation_checked_at
      FROM paddocks p
      LEFT JOIN (
        SELECT DISTINCT ON (paddock_id) paddock_id, status, confidence, checked_at
        FROM deforestation_checks
        WHERE org_id = $1
        ORDER BY paddock_id, checked_at DESC
      ) dc ON dc.paddock_id = p.id
      WHERE p.org_id = $1
        AND p.is_active = true
      ORDER BY p.name ASC
    `, [auth.orgId])

    // 3. Build validation report per paddock
    const results: PaddockValidationResult[] = rows.map((row: any) => {
      const issues: string[] = []

      // Check geometry presence
      if (!row.has_geometry) {
        issues.push('Sin geometría registrada — requerida para TRACES-NT')
      }

      // Check geometry validity
      if (row.has_geometry && row.geom_is_valid === false) {
        issues.push('Geometría inválida (self-intersection u otro error topológico) — ejecutar ST_MakeValid')
      }

      // Check deforestation
      if (!row.deforestation_status || row.deforestation_status === 'PENDING') {
        issues.push('Sin verificación de deforestación — ejecutar Deforestation Check')
      } else if (row.deforestation_status === 'DEFORESTED') {
        issues.push('ALERTA: Deforestación detectada post-2020 — este potrero NO puede incluirse en DDS')
      } else if (row.deforestation_status === 'AT_RISK') {
        issues.push('Potrero en riesgo de deforestación — verificar manualmente')
      }

      // Check check staleness (>90 days old)
      if (row.deforestation_checked_at) {
        const daysSinceCheck = (Date.now() - new Date(row.deforestation_checked_at).getTime()) / (1000 * 60 * 60 * 24)
        if (daysSinceCheck > 90) {
          issues.push(`Verificación de deforestación desactualizada (${Math.round(daysSinceCheck)} días) — recomendado ≤90 días`)
        }
      }

      // Determine EUDR geometry type
      let eudrGeomType: PaddockValidationResult['eudr_geom_type'] = 'MISSING'
      if (row.has_geometry) {
        if (row.geom_is_valid === false) {
          eudrGeomType = 'INVALID'
        } else {
          const areaHa = parseFloat(row.computed_area_ha) || 0
          eudrGeomType = areaHa >= 4.0 ? 'POLYGON' : 'POINT'
        }
      }

      const isValid =
        row.has_geometry &&
        row.geom_is_valid !== false &&
        row.deforestation_status === 'CLEAN' &&
        issues.filter(i => i.startsWith('ALERTA')).length === 0

      return {
        paddock_id: row.id,
        paddock_name: row.name,
        has_geometry: row.has_geometry,
        area_ha: row.area_ha ? parseFloat(row.area_ha) : null,
        eudr_area_ha: row.eudr_area_ha ? parseFloat(row.eudr_area_ha) : (row.computed_area_ha ? parseFloat(row.computed_area_ha) : null),
        eudr_geom_type: eudrGeomType,
        deforestation_status: row.deforestation_status || null,
        deforestation_confidence: row.deforestation_confidence || null,
        is_valid_for_eudr: isValid,
        validation_issues: issues,
      }
    })

    // 4. Summary statistics
    const summary = {
      total_paddocks: results.length,
      valid_for_dds: results.filter(r => r.is_valid_for_eudr).length,
      missing_geometry: results.filter(r => !r.has_geometry).length,
      deforested: results.filter(r => r.deforestation_status === 'DEFORESTED').length,
      at_risk: results.filter(r => r.deforestation_status === 'AT_RISK').length,
      clean: results.filter(r => r.deforestation_status === 'CLEAN').length,
      pending_check: results.filter(r => !r.deforestation_status || r.deforestation_status === 'PENDING').length,
      polygon_type: results.filter(r => r.eudr_geom_type === 'POLYGON').length,
      point_type: results.filter(r => r.eudr_geom_type === 'POINT').length,
      ready_for_dds: results.every(r => r.is_valid_for_eudr),
    }

    return NextResponse.json({
      org_id: auth.orgId,
      validated_at: new Date().toISOString(),
      summary,
      paddocks: results,
    })
  } catch (err: any) {
    console.error('[GET /api/eudr/validate-paddocks]', err)
    return NextResponse.json({ error: 'Error interno del servidor', detail: err?.message }, { status: 500 })
  }
}
