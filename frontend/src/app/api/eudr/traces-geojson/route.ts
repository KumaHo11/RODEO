/**
 * GET /api/eudr/traces-geojson
 *
 * Exporta las geometrías de todos los potreros activos y limpios de la organización
 * en formato FeatureCollection compatible con la submission de TRACES-NT (UE 2023/1115).
 *
 * Query params:
 *   only_clean=true (default) — incluye solo potreros CLEAN; false incluye todos
 *   herd_ids=uuid,uuid       — filtra por rodeo (para DDS de una tropa específica)
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { serviceQuery, serviceQueryOne } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const onlyClean = searchParams.get('only_clean') !== 'false'
    const herdIdsParam = searchParams.get('herd_ids')
    const herdIds = herdIdsParam ? herdIdsParam.split(',').filter(Boolean) : null

    // 1. Fetch organization details (operator metadata)
    const org = await serviceQueryOne<any>(`
      SELECT o.name, o.region_id, o.total_area_ha,
             ST_AsGeoJSON(o.boundaries)::json AS boundaries_geojson
      FROM organizations o
      WHERE o.id = $1
    `, [auth.orgId])

    // 2. Build paddock query — join with grazing_plans if filtering by herd
    let paddockQuery = `
      SELECT
        p.id,
        p.name,
        p.area_ha,
        p.eudr_area_ha,
        p.eudr_geom_type,
        p.eudr_validated_at,
        ST_AsGeoJSON(
          CASE
            WHEN p.eudr_geom_type = 'POINT' THEN ST_Centroid(p.geom)  -- <4ha → centroide
            ELSE p.geom                                                  -- ≥4ha → polígono completo
          END
        )::json AS geometry,
        dc.status AS deforestation_status,
        dc.confidence AS deforestation_confidence,
        dc.checked_at AS deforestation_checked_at
      FROM paddocks p
      LEFT JOIN (
        SELECT DISTINCT ON (paddock_id) paddock_id, status, confidence, checked_at
        FROM deforestation_checks WHERE org_id = $1
        ORDER BY paddock_id, checked_at DESC
      ) dc ON dc.paddock_id = p.id
      WHERE p.org_id = $1 AND p.is_active = true AND p.geom IS NOT NULL
    `

    const queryParams: any[] = [auth.orgId]

    if (onlyClean) {
      paddockQuery += ` AND dc.status = 'CLEAN'`
    }

    if (herdIds && herdIds.length > 0) {
      paddockQuery += ` AND p.id IN (
        SELECT DISTINCT gp.paddock_id FROM grazing_plans gp
        WHERE gp.herd_id = ANY($2::uuid[])
          AND gp.status IN ('COMPLETED', 'ACTIVE', 'HISTORY')
      )`
      queryParams.push(herdIds)
    }

    paddockQuery += ` ORDER BY p.name ASC`

    const paddocks = await serviceQuery<any>(paddockQuery, queryParams)

    // 3. Build GeoJSON FeatureCollection in TRACES-NT format
    const features = paddocks.map((p: any) => ({
      type: 'Feature' as const,
      geometry: p.geometry,
      properties: {
        // Required TRACES-NT fields
        plot_id: p.id,
        plot_name: p.name,
        area_ha: p.eudr_area_ha ?? p.area_ha,
        geolocation_type: p.eudr_geom_type === 'POINT' ? 'POINT' : 'POLYGON',
        commodity_code: '0201',                     // HS code: Bovine meat, fresh/chilled
        commodity_description: 'Carne bovina fresca o refrigerada',
        country_of_production: 'AR',                // ISO 3166-1 alpha-2

        // Deforestation verification
        deforestation_status: p.deforestation_status ?? 'UNKNOWN',
        deforestation_confidence: p.deforestation_confidence ?? null,
        last_deforestation_check: p.deforestation_checked_at ?? null,
        reference_date: '2020-12-31',               // EUDR cut-off date

        // Metadata
        eudr_validated_at: p.eudr_validated_at,
      },
    }))

    const geojson = {
      type: 'FeatureCollection' as const,
      properties: {
        schema_version: '1.0',
        regulation: 'EU 2023/1115',
        operator: {
          name: org?.name ?? 'RODEO Farm',
          country: 'AR',
          org_id: auth.orgId,
        },
        commodity: {
          hs_code: '0201',
          description: 'Carne bovina fresca o refrigerada',
        },
        submission_date: new Date().toISOString().split('T')[0],
        reference_period: {
          start: '2020-12-31',
          end: new Date().toISOString().split('T')[0],
        },
        total_plots: features.length,
        total_area_ha: features.reduce((sum: number, f: any) => sum + (f.properties.area_ha ?? 0), 0),
        all_plots_clean: features.every((f: any) => f.properties.deforestation_status === 'CLEAN'),
      },
      features,
    }

    // 4. Return as downloadable .geojson file
    return new NextResponse(JSON.stringify(geojson, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/geo+json',
        'Content-Disposition': `attachment; filename="traces-nt-${auth.orgId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.geojson"`,
      },
    })
  } catch (err: any) {
    console.error('[GET /api/eudr/traces-geojson]', err)
    return NextResponse.json({ error: 'Error interno del servidor', detail: err?.message }, { status: 500 })
  }
}
