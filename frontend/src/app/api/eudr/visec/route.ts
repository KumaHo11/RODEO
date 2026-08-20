/**
 * POST /api/eudr/visec
 *
 * Mock endpoint para integración con VISEC (plataforma sectorial Argentina).
 * Formatea el payload DDS al formato esperado por VISEC.
 * TODO: Reemplazar con llamada real a la API de VISEC cuando se cuente con la spec.
 *
 * Body: { submission_id: string } — referencia a una DDS existente en eudr_dds_submissions
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { serviceQueryOne, serviceMutate } from '@/lib/db'

export const dynamic = 'force-dynamic'

// TODO: Replace with actual VISEC API endpoint when spec is available
const VISEC_API_BASE = process.env.VISEC_API_URL ?? 'https://api.visec.gob.ar'  // placeholder
const VISEC_API_KEY = process.env.VISEC_API_KEY

/**
 * Maps a RODEO DDS payload to the VISEC submission format.
 * ⚠️ Format is assumed based on typical Argentine livestock traceability standards.
 * Must be validated against the actual VISEC API spec before going live.
 */
function mapToVisecFormat(ddsPayload: any): any {
  return {
    // VISEC Establishment fields (mapped from RODEO operator)
    establecimiento: {
      nombre: ddsPayload.operator?.name,
      pais_origen: 'AR',
      cuig: ddsPayload.operator?.org_id,  // TODO: map to actual CUIG (Código Único de Identificación Ganadera)
    },
    // Commodity / product
    producto: {
      codigo_hs: ddsPayload.commodity?.hs_code,
      descripcion: ddsPayload.commodity?.description,
      cantidad_cabezas: ddsPayload.commodity?.quantity_units,
    },
    // Geolocation — VISEC expects an array of parcelas
    parcelas: ddsPayload.geolocation?.features?.map((f: any) => ({
      id_parcela: f.properties?.plot_id,
      nombre: f.properties?.plot_name,
      area_ha: f.properties?.area_ha,
      tipo_geolocalizacion: f.properties?.geolocation_type,
      estado_deforestacion: f.properties?.deforestation_status,
      geometria: f.geometry,
    })) ?? [],
    // Compliance declaration
    declaracion_eudr: {
      cumple_deforestacion_cero: ddsPayload.supply_chain?.all_plots_clean,
      fecha_referencia: '2020-12-31',
      fecha_generacion: ddsPayload.generated_at,
    },
    // Traceability notes
    observaciones: ddsPayload.notes ?? '',
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const { submission_id } = body

    if (!submission_id) {
      return NextResponse.json({ error: 'submission_id requerido' }, { status: 400 })
    }

    // 1. Fetch the DDS submission
    const submission = await serviceQueryOne<any>(`
      SELECT id, payload, status FROM eudr_dds_submissions
      WHERE id = $1 AND org_id = $2
    `, [submission_id, auth.orgId])

    if (!submission) {
      return NextResponse.json({ error: 'DDS no encontrada' }, { status: 404 })
    }

    if (submission.status === 'ACCEPTED') {
      return NextResponse.json({ error: 'Esta DDS ya fue aceptada' }, { status: 409 })
    }

    // 2. Map to VISEC format
    const visecPayload = mapToVisecFormat(submission.payload)

    // 3. MOCK: Simulate VISEC API call
    // When VISEC API spec is available, replace this block with actual fetch():
    // const response = await fetch(`${VISEC_API_BASE}/dds/submit`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'X-API-Key': VISEC_API_KEY ?? '',
    //   },
    //   body: JSON.stringify(visecPayload),
    // })
    const isMockMode = !VISEC_API_KEY || VISEC_API_BASE.includes('placeholder')

    const mockExternalRef = `VISEC-MOCK-${Date.now().toString(36).toUpperCase()}`

    // 4. Update submission status
    await serviceMutate(`
      UPDATE eudr_dds_submissions
      SET
        status = 'SUBMITTED',
        submission_type = 'VISEC',
        external_ref = $1,
        submitted_at = NOW(),
        response_data = $2::jsonb,
        updated_at = NOW()
      WHERE id = $3 AND org_id = $4
    `, [
      mockExternalRef,
      JSON.stringify({
        mock: isMockMode,
        submitted_at: new Date().toISOString(),
        visec_payload_sent: visecPayload,
      }),
      submission_id,
      auth.orgId,
    ])

    return NextResponse.json({
      ok: true,
      mock_mode: isMockMode,
      external_ref: mockExternalRef,
      message: isMockMode
        ? 'MOCK: DDS enviada en modo simulación. Configurar VISEC_API_KEY y VISEC_API_URL para conectar con el servicio real.'
        : 'DDS enviada a VISEC correctamente.',
      visec_payload: visecPayload,
    })
  } catch (err: any) {
    console.error('[POST /api/eudr/visec]', err)
    return NextResponse.json({ error: 'Error del servidor: ' + err.message }, { status: 500 })
  }
}
