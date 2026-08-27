/**
 * GET  /api/eudr/documents      — Lista documentos EUDR de la organización
 * POST /api/eudr/documents      — Registra un documento (URL ya subida via /api/upload)
 * PATCH /api/eudr/documents     — Marca documento como verificado
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { serviceQuery, serviceMutate } from '@/lib/db'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const doc_type = searchParams.get('doc_type')
    const paddock_id = searchParams.get('paddock_id')

    let sql = `
      SELECT
        d.id, d.doc_type, d.paddock_id, d.file_url, d.file_name,
        d.file_hash, d.issued_date, d.expiry_date,
        d.issuer, d.reference_number, d.verified,
        d.verified_at, d.notes, d.created_at,
        p.name AS paddock_name,
        pr.first_name || ' ' || pr.last_name AS verified_by_name,
        -- Alert: expires within 60 days
        CASE
          WHEN d.expiry_date < NOW() THEN 'EXPIRED'
          WHEN d.expiry_date < NOW() + INTERVAL '60 days' THEN 'EXPIRING_SOON'
          ELSE 'VALID'
        END AS expiry_status
      FROM eudr_documents d
      LEFT JOIN paddocks p ON p.id = d.paddock_id
      LEFT JOIN profiles pr ON pr.id = d.verified_by
      WHERE d.org_id = $1
    `
    const params: any[] = [auth.orgId]
    let idx = 2

    if (doc_type) {
      sql += ` AND d.doc_type = $${idx++}`
      params.push(doc_type)
    }
    if (paddock_id) {
      sql += ` AND d.paddock_id = $${idx++}`
      params.push(paddock_id)
    }

    sql += ` ORDER BY d.doc_type, d.created_at DESC`

    const documents = await serviceQuery<any>(sql, params)

    return NextResponse.json({ documents })
  } catch (err: any) {
    console.error('[GET /api/eudr/documents]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const {
      doc_type,
      file_url,
      file_name,
      file_size_bytes,
      paddock_id,
      issued_date,
      expiry_date,
      issuer,
      reference_number,
      notes,
    } = body

    if (!doc_type || !file_url) {
      return NextResponse.json({ error: 'doc_type y file_url son requeridos' }, { status: 400 })
    }

    // Compute hash from URL as a lightweight integrity token
    // (Real SHA-256 should be computed client-side from the file bytes before upload)
    const file_hash = crypto.createHash('sha256').update(file_url + (file_name ?? '')).digest('hex')

    // Normalize optional date/text fields: empty strings must be null for PostgreSQL DATE columns
    const nullIfEmpty = (v: any) => (v === '' || v === undefined || v === null) ? null : v

    const result = await serviceMutate(`
      INSERT INTO eudr_documents
        (org_id, doc_type, file_url, file_name, file_hash, file_size_bytes,
         paddock_id, issued_date, expiry_date, issuer, reference_number,
         notes, verified, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,false,NOW(),NOW())
      RETURNING id
    `, [
      auth.orgId, doc_type, file_url, nullIfEmpty(file_name), file_hash,
      nullIfEmpty(file_size_bytes), nullIfEmpty(paddock_id),
      nullIfEmpty(issued_date), nullIfEmpty(expiry_date),
      nullIfEmpty(issuer), nullIfEmpty(reference_number), nullIfEmpty(notes),
    ])

    return NextResponse.json({ id: result.rows[0]?.id }, { status: 201 })
  } catch (err: any) {
    console.error('[POST /api/eudr/documents]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const { id, verified } = body

    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    await serviceMutate(`
      UPDATE eudr_documents
      SET verified = $1, verified_at = $2, updated_at = NOW()
      WHERE id = $3 AND org_id = $4
    `, [verified ?? true, verified ? new Date().toISOString() : null, id, auth.orgId])

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[PATCH /api/eudr/documents]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
