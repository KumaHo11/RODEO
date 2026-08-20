/**
 * GET /api/eudr/dossier?submission_id=xxx
 *
 * Genera y retorna el Dossier PDF (Pasaporte Digital EUDR) para una DDS existente.
 * Combina datos del submission + compliance engine + herds/paddocks para renderizar el PDF.
 */
import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import { requireAuth } from '@/lib/auth'
import { serviceQueryOne, serviceQuery } from '@/lib/db'
import { renderToStream } from '@react-pdf/renderer'
import { EUDRPassport } from '@/lib/reports/EUDRPassport'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const submissionId = searchParams.get('submission_id')

    // 1. Fetch org details
    const org = await serviceQueryOne<any>(
      `SELECT id, name FROM organizations WHERE id = $1`,
      [auth.orgId]
    )

    // 2. Resolve submission (or build ad-hoc from current state)
    let payloadHash = ''
    let submissionData: any = null
    let herdIds: string[] = []
    let paddockIds: string[] = []

    if (submissionId) {
      submissionData = await serviceQueryOne<any>(
        `SELECT * FROM eudr_dds_submissions WHERE id = $1 AND org_id = $2`,
        [submissionId, auth.orgId]
      )
      if (!submissionData) return NextResponse.json({ error: 'DDS no encontrada' }, { status: 404 })
      payloadHash = crypto.createHash('sha256')
        .update(JSON.stringify(submissionData.payload))
        .digest('hex')
      herdIds = submissionData.herd_ids ?? []
      paddockIds = submissionData.paddock_ids ?? []
    }

    // 3. Fetch paddocks with deforestation status
    let paddocksQuery = `
      SELECT p.id, p.name, p.area_ha, p.eudr_area_ha, p.eudr_geom_type,
             dc.status AS deforestation_status,
             dc.confidence AS deforestation_confidence,
             dc.checked_at AS last_check
      FROM paddocks p
      LEFT JOIN (
        SELECT DISTINCT ON (paddock_id) paddock_id, status, confidence, checked_at
        FROM deforestation_checks WHERE org_id = $1
        ORDER BY paddock_id, checked_at DESC
      ) dc ON dc.paddock_id = p.id
      WHERE p.org_id = $1 AND p.is_active = true
    `
    const pParams: any[] = [auth.orgId]
    if (paddockIds.length > 0) {
      paddocksQuery += ` AND p.id = ANY($2::uuid[])`
      pParams.push(paddockIds)
    }
    paddocksQuery += ` ORDER BY p.name ASC`
    const paddocks = await serviceQuery<any>(paddocksQuery, pParams)

    // 4. Fetch herds
    let herdsQuery = `SELECT id, name, head_count, category, breed FROM herds WHERE org_id = $1`
    const hParams: any[] = [auth.orgId]
    if (herdIds.length > 0) {
      herdsQuery += ` AND id = ANY($2::uuid[])`
      hParams.push(herdIds)
    }
    const herds = await serviceQuery<any>(herdsQuery, hParams)

    // 5. Fetch compliance data
    let docsCount = 0
    let feedBatches: any[] = []
    try {
      const docsResult = await serviceQuery<any>(
        `SELECT COUNT(*) AS cnt FROM eudr_documents WHERE org_id = $1`, [auth.orgId]
      )
      docsCount = parseInt(docsResult[0]?.cnt ?? '0')
      feedBatches = await serviceQuery<any>(
        `SELECT eudr_compliant FROM feed_batches WHERE org_id = $1`, [auth.orgId]
      )
    } catch (e) {
      // Tables might not be migrated yet in all environments
    }

    const feedComplianceRate = feedBatches.length > 0
      ? Math.round((feedBatches.filter(f => f.eudr_compliant).length / feedBatches.length) * 100)
      : 0

    const allPlotsClean = paddocks.every((p: any) => p.deforestation_status === 'CLEAN')
    const cleanCount = paddocks.filter((p: any) => p.deforestation_status === 'CLEAN').length
    const eudrScore = Math.round(
      (allPlotsClean ? 30 : 0) +
      (cleanCount / Math.max(paddocks.length, 1)) * 25 +
      (docsCount > 0 ? 20 : 0) +
      (feedComplianceRate / 100) * 15 +
      10
    )

    const timestamp = new Date().toISOString()
    if (!payloadHash) {
      payloadHash = crypto.createHash('sha256')
        .update(`${auth.orgId}-${timestamp}-EUDR-DOSSIER`)
        .digest('hex')
    }

    // 6. Render PDF
    const pdfStream = await renderToStream(
      React.createElement(EUDRPassport, {
        orgName: org?.name ?? 'Establecimiento',
        orgId: auth.orgId,
        timestamp,
        payloadHash,
        paddocks: paddocks.map((p: any) => ({
          id: p.id,
          name: p.name,
          area_ha: parseFloat(p.eudr_area_ha ?? p.area_ha ?? 0),
          eudr_geom_type: p.eudr_geom_type ?? 'POLYGON',
          deforestation_status: p.deforestation_status ?? 'UNKNOWN',
          deforestation_confidence: p.deforestation_confidence ?? '—',
          last_check: p.last_check,
        })),
        herds: herds.map((h: any) => ({
          id: h.id,
          name: h.name,
          head_count: h.head_count ?? 0,
          category: h.category,
          breed: h.breed,
        })),
        docsCount,
        feedBatchesCount: feedBatches.length,
        feedComplianceRate,
        eudrScore,
        allPlotsClean,
        submissionId: submissionId ?? undefined,
      }) as any
    )

    const webStream = new ReadableStream({
      start(controller) {
        pdfStream.on('data', (chunk: Buffer) => controller.enqueue(chunk))
        pdfStream.on('end', () => controller.close())
        pdfStream.on('error', (err: Error) => controller.error(err))
      },
    })

    const dateStr = new Date().toISOString().slice(0, 10)
    return new Response(webStream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="eudr-pasaporte-${dateStr}.pdf"`,
      },
    })
  } catch (err: any) {
    console.error('[GET /api/eudr/dossier]', err)
    return NextResponse.json({ error: 'Error generando PDF: ' + err.message }, { status: 500 })
  }
}
