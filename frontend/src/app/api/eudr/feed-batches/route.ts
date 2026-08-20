/**
 * GET  /api/eudr/feed-batches   — Lista lotes de insumos de la organización
 * POST /api/eudr/feed-batches   — Registra un nuevo lote de insumos
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { serviceQuery, serviceMutate } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const feed_type = searchParams.get('feed_type')
    const eudr_compliant = searchParams.get('eudr_compliant')

    let sql = `
      SELECT
        f.id, f.feed_type, f.supplier_name, f.supplier_cuit,
        f.supplier_country, f.eudr_compliant, f.compliance_cert_url,
        f.invoice_url, f.lot_number, f.quantity_kg,
        f.received_date, f.expiry_date, f.herd_ids, f.paddock_ids,
        f.notes, f.created_at,
        pr.first_name || ' ' || pr.last_name AS created_by_name
      FROM feed_batches f
      LEFT JOIN profiles pr ON pr.id = f.created_by
      WHERE f.org_id = $1
    `
    const params: any[] = [auth.orgId]
    let idx = 2

    if (feed_type) {
      sql += ` AND f.feed_type = $${idx++}`
      params.push(feed_type)
    }
    if (eudr_compliant !== null && eudr_compliant !== undefined) {
      sql += ` AND f.eudr_compliant = $${idx++}`
      params.push(eudr_compliant === 'true')
    }

    sql += ` ORDER BY f.received_date DESC`

    const batches = await serviceQuery<any>(sql, params)

    // Summary stats
    const stats = {
      total: batches.length,
      compliant: batches.filter((b: any) => b.eudr_compliant).length,
      non_compliant: batches.filter((b: any) => !b.eudr_compliant).length,
      compliance_rate: batches.length > 0
        ? Math.round((batches.filter((b: any) => b.eudr_compliant).length / batches.length) * 100)
        : 0,
    }

    return NextResponse.json({ batches, stats })
  } catch (err: any) {
    console.error('[GET /api/eudr/feed-batches]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const {
      feed_type,
      supplier_name,
      supplier_cuit,
      supplier_country = 'ARG',
      eudr_compliant = false,
      compliance_cert_url,
      invoice_url,
      lot_number,
      quantity_kg,
      received_date,
      expiry_date,
      herd_ids,
      paddock_ids,
      notes,
    } = body

    if (!feed_type || !received_date) {
      return NextResponse.json({ error: 'feed_type y received_date son requeridos' }, { status: 400 })
    }

    const result = await serviceMutate(`
      INSERT INTO feed_batches
        (org_id, feed_type, supplier_name, supplier_cuit, supplier_country,
         eudr_compliant, compliance_cert_url, invoice_url, lot_number,
         quantity_kg, received_date, expiry_date, herd_ids, paddock_ids, notes, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::uuid[],$14::uuid[],$15,NOW())
      RETURNING id
    `, [
      auth.orgId, feed_type, supplier_name ?? null, supplier_cuit ?? null,
      supplier_country, eudr_compliant, compliance_cert_url ?? null,
      invoice_url ?? null, lot_number ?? null, quantity_kg ?? null,
      received_date, expiry_date ?? null,
      herd_ids?.length > 0 ? herd_ids : null,
      paddock_ids?.length > 0 ? paddock_ids : null,
      notes ?? null,
    ])

    return NextResponse.json({ id: result.rows[0]?.id }, { status: 201 })
  } catch (err: any) {
    console.error('[POST /api/eudr/feed-batches]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
