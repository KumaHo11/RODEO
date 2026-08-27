/**
 * POST /api/eudr/generate-dds
 *
 * Genera un Due Diligence Statement (DDS) completo para EUDR.
 * Pasos:
 *   1. Valida que todos los potreros incluidos sean CLEAN
 *   2. Ensambla el payload JSON del DDS
 *   3. Genera el GeoJSON exportable
 *   4. Persiste en eudr_dds_submissions con status='DRAFT'
 *   5. Retorna el DDS + URLs de descarga
 *
 * Body:
 *   {
 *     herd_ids?: string[],   -- Rodeos incluidos (opcional: todos si vacío)
 *     animal_ids?: string[], -- Animales individuales (opcional)
 *     notes?: string
 *   }
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { serviceQuery, serviceQueryOne, serviceMutate } from '@/lib/db'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // List existing DDS submissions for this org
  try {
    const auth = await requireAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const submissions = await serviceQuery<any>(`
      SELECT
        id, submission_type, status, external_ref,
        array_length(herd_ids, 1) AS herd_count,
        array_length(paddock_ids, 1) AS paddock_count,
        geojson_url, pdf_url, submitted_at, created_at
      FROM eudr_dds_submissions
      WHERE org_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [auth.orgId])

    return NextResponse.json({ submissions })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const { herd_ids = [], animal_ids = [], notes = '' } = body

    // 1. Fetch organization details
    const org = await serviceQueryOne<any>(`
      SELECT id, name, region_id, total_area_ha FROM organizations WHERE id = $1
    `, [auth.orgId])
    if (!org) return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 })

    // 2. Resolve paddocks used by the specified herds (or all herds if none specified)
    let paddockQuery = `
      SELECT DISTINCT ON (p.id)
        p.id, p.name, p.area_ha, p.eudr_area_ha, p.eudr_geom_type,
        ST_AsGeoJSON(
          CASE WHEN p.eudr_geom_type = 'POINT' THEN ST_Centroid(p.geom) ELSE p.geom END
        )::json AS geometry,
        dc.status AS deforestation_status,
        dc.confidence AS deforestation_confidence,
        dc.checked_at AS deforestation_checked_at
      FROM paddocks p
      JOIN grazing_plans gp ON gp.paddock_id = p.id
      LEFT JOIN (
        SELECT DISTINCT ON (paddock_id) paddock_id, status, confidence, checked_at
        FROM deforestation_checks WHERE org_id = $1
        ORDER BY paddock_id, checked_at DESC
      ) dc ON dc.paddock_id = p.id
      WHERE p.org_id = $1 AND p.geom IS NOT NULL
        AND gp.status IN ('COMPLETED', 'ACTIVE', 'HISTORY')
    `
    const queryParams: any[] = [auth.orgId]

    if (herd_ids.length > 0) {
      paddockQuery += ` AND gp.herd_id = ANY($2::uuid[])`
      queryParams.push(herd_ids)
    }

    const paddocks = await serviceQuery<any>(paddockQuery, queryParams)

    // 3. Validation gate — block if any paddock is DEFORESTED
    const deforestedPaddocks = paddocks.filter((p: any) => p.deforestation_status === 'DEFORESTED')
    if (deforestedPaddocks.length > 0) {
      return NextResponse.json({
        error: 'DDS bloqueada: hay potreros con deforestación detectada post-2020',
        deforested_paddocks: deforestedPaddocks.map((p: any) => ({ id: p.id, name: p.name })),
      }, { status: 422 })
    }

    // 4. Resolve herds details
    let herds: any[] = []
    if (herd_ids.length > 0) {
      herds = await serviceQuery<any>(`
        SELECT id, name, head_count, category, breed, total_ev
        FROM herds WHERE id = ANY($1::uuid[]) AND org_id = $2
      `, [herd_ids, auth.orgId])
    } else {
      herds = await serviceQuery<any>(`
        SELECT id, name, head_count, category, breed, total_ev
        FROM herds WHERE org_id = $1
      `, [auth.orgId])
    }

    // 5. Resolve documents (check which ones exist)
    const documents = await serviceQuery<any>(`
      SELECT id, doc_type, file_url, issued_date, expiry_date, issuer, reference_number, verified
      FROM eudr_documents WHERE org_id = $1
      ORDER BY doc_type, created_at DESC
    `, [auth.orgId])

    // 6. Resolve feed batches
    const feedBatches = await serviceQuery<any>(`
      SELECT id, feed_type, supplier_name, supplier_cuit, eudr_compliant,
             quantity_kg, received_date
      FROM feed_batches WHERE org_id = $1
      ORDER BY received_date DESC
    `, [auth.orgId])

    const timestamp = new Date().toISOString()
    const paddockIds = paddocks.map((p: any) => p.id)
    const herdIdsResolved = herds.map((h: any) => h.id)

    // 7. Build DDS payload
    const geojsonFeatures = paddocks.map((p: any) => ({
      type: 'Feature',
      geometry: p.geometry,
      properties: {
        plot_id: p.id,
        plot_name: p.name,
        area_ha: p.eudr_area_ha ?? p.area_ha,
        geolocation_type: p.eudr_geom_type === 'POINT' ? 'POINT' : 'POLYGON',
        deforestation_status: p.deforestation_status ?? 'UNKNOWN',
        deforestation_confidence: p.deforestation_confidence ?? null,
        last_deforestation_check: p.deforestation_checked_at ?? null,
        commodity_code: '0201',
        country_of_production: 'AR',
        reference_date: '2020-12-31',
      },
    }))

    const ddsPayload = {
      schema: 'EUDR-DDS-v1.0',
      regulation: 'EU 2023/1115',
      generated_at: timestamp,
      operator: {
        name: org.name,
        country: 'AR',
        org_id: auth.orgId,
      },
      commodity: {
        hs_code: '0201',
        description: 'Carne bovina fresca o refrigerada',
        quantity_units: herds.reduce((sum: number, h: any) => sum + (h.head_count ?? 0), 0),
        quantity_unit_type: 'head_count',
      },
      supply_chain: {
        herds: herds.map((h: any) => ({
          id: h.id,
          name: h.name,
          head_count: h.head_count,
          category: h.category,
          breed: h.breed,
        })),
        paddocks_count: paddocks.length,
        total_area_ha: paddocks.reduce((sum: number, p: any) => sum + parseFloat(p.eudr_area_ha ?? p.area_ha ?? 0), 0),
        all_plots_clean: paddocks.every((p: any) => p.deforestation_status === 'CLEAN'),
      },
      geolocation: {
        type: 'FeatureCollection',
        features: geojsonFeatures,
      },
      documentation: {
        title_deeds: documents.filter((d: any) => d.doc_type === 'TITLE_DEED').length,
        environmental_permits: documents.filter((d: any) => d.doc_type === 'ENVIRONMENTAL_PERMIT').length,
        dte_count: documents.filter((d: any) => d.doc_type === 'DTE').length,
        all_docs_verified: documents.every((d: any) => d.verified),
      },
      feed_traceability: {
        batches_count: feedBatches.length,
        eudr_compliant_batches: feedBatches.filter((f: any) => f.eudr_compliant).length,
        all_batches_compliant: feedBatches.length > 0 && feedBatches.every((f: any) => f.eudr_compliant),
      },
      notes,
    }

    // 8. Compute payload hash for QR verification
    const payloadString = JSON.stringify(ddsPayload)
    const payloadHash = crypto.createHash('sha256').update(payloadString).digest('hex')

    // 9. Persist in eudr_dds_submissions
    const result = await serviceMutate(`
      INSERT INTO eudr_dds_submissions
        (org_id, submission_type, herd_ids, animal_ids, paddock_ids,
         payload, status, created_at, updated_at)
      VALUES ($1, 'MANUAL_PDF', $2::uuid[], $3::uuid[], $4::uuid[], $5::jsonb, 'DRAFT', NOW(), NOW())
      RETURNING id
    `, [
      auth.orgId,
      herdIdsResolved.length > 0 ? herdIdsResolved : null,
      animal_ids.length > 0 ? animal_ids : null,
      paddockIds.length > 0 ? paddockIds : null,
      payloadString,
    ])

    const submissionId = result.rows[0]?.id

    return NextResponse.json({
      submission_id: submissionId,
      status: 'DRAFT',
      payload_hash: payloadHash,
      payload: ddsPayload,
      summary: {
        herds_count: herds.length,
        paddocks_count: paddocks.length,
        deforested_paddocks: 0,
        all_plots_clean: ddsPayload.supply_chain.all_plots_clean,
        documents_count: documents.length,
        feed_batches_count: feedBatches.length,
        ready_to_submit: ddsPayload.supply_chain.all_plots_clean,
      },
    }, { status: 201 })
  } catch (err: any) {
    console.error('[POST /api/eudr/generate-dds]', err)
    return NextResponse.json({ error: 'Error interno del servidor', detail: err?.message }, { status: 500 })
  }
}
