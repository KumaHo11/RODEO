/**
 * GET  /api/movements  — Historial de movimientos (rodeos + potreros)
 * POST /api/movements  — Registra un nuevo movimiento
 *
 * Crear tabla si no existe:
 *  CREATE TABLE IF NOT EXISTS movements (
 *    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *    org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 *    entity_type   TEXT NOT NULL,   -- 'herd' | 'paddock'
 *    entity_id     UUID NOT NULL,
 *    entity_name   TEXT,
 *    event_type    TEXT NOT NULL,   -- 'stock_inicial','compra','venta','paricion','destete','mortandad','bcs','nota','ndvi','biomasa'
 *    quantity      INTEGER,
 *    weight_kg     NUMERIC,
 *    bcs_score     NUMERIC,
 *    categoria     TEXT,
 *    breed         TEXT,
 *    admission_date DATE,
 *    notes         TEXT,
 *    metadata      JSONB DEFAULT '{}',
 *    created_by    UUID,
 *    occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *  );
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { serviceQueryOne, serviceQuery, serviceMutate } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function getAuth(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim() || ''
  if (!token) return null
  const decoded = await verifyFirebaseToken(token)
  if (!decoded) return null
  const profile = await serviceQueryOne<{ organization_id: string; id: string }>(
    'SELECT organization_id, id FROM profiles WHERE firebase_uid = $1',
    [decoded.uid]
  )
  if (!profile?.organization_id) return null
  return { orgId: profile.organization_id, uid: decoded.uid, profileId: profile.id }
}

// ── Ensure table exists ───────────────────────────────────────────────────────

async function ensureTable() {
  try {
    await serviceMutate(`
      CREATE TABLE IF NOT EXISTS movements (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id        UUID NOT NULL,
        entity_type   TEXT NOT NULL,
        entity_id     UUID NOT NULL,
        entity_name   TEXT,
        event_type    TEXT NOT NULL,
        quantity      INTEGER,
        weight_kg     NUMERIC,
        bcs_score     NUMERIC,
        categoria     TEXT,
        breed         TEXT,
        admission_date DATE,
        notes         TEXT,
        metadata      JSONB DEFAULT '{}',
        created_by    UUID,
        occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `, [])
  } catch (_e) {
    // Table might already exist — ignore
  }
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    await ensureTable()

    const { searchParams } = new URL(req.url)
    const entityId   = searchParams.get('entity_id')
    const entityType = searchParams.get('entity_type')
    const limit      = Math.min(Number(searchParams.get('limit') ?? '200'), 500)

    const conditions: string[] = ['org_id = $1']
    const vals: any[] = [auth.orgId]
    let idx = 2

    if (entityId)   { conditions.push(`entity_id = $${idx++}`);   vals.push(entityId) }
    if (entityType) { conditions.push(`entity_type = $${idx++}`); vals.push(entityType) }

    const rows = await serviceQuery(
      `SELECT * FROM movements WHERE ${conditions.join(' AND ')}
       ORDER BY occurred_at DESC LIMIT $${idx}`,
      [...vals, limit]
    )

    return NextResponse.json({ movements: rows })
  } catch (err: any) {
    console.error('GET /api/movements error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    await ensureTable()

    const body = await req.json()
    const {
      entity_type, entity_id, entity_name, event_type,
      quantity, weight_kg, bcs_score, categoria, breed,
      admission_date, notes, metadata, occurred_at,
    } = body

    if (!entity_type || !entity_id || !event_type) {
      return NextResponse.json({ error: 'entity_type, entity_id y event_type requeridos' }, { status: 400 })
    }

    const result = await serviceMutate(
      `INSERT INTO movements
         (org_id, entity_type, entity_id, entity_name, event_type,
          quantity, weight_kg, bcs_score, categoria, breed,
          admission_date, notes, metadata, created_by, occurred_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING id`,
      [
        auth.orgId,
        entity_type,
        entity_id,
        entity_name  || null,
        event_type,
        quantity     ?? null,
        weight_kg    ?? null,
        bcs_score    ?? null,
        categoria    || null,
        breed        || null,
        admission_date || null,
        notes        || null,
        JSON.stringify(metadata || {}),
        auth.profileId || null,
        occurred_at  || new Date().toISOString(),
      ]
    )

    return NextResponse.json({ id: result.rows[0]?.id }, { status: 201 })
  } catch (err: any) {
    console.error('POST /api/movements error:', err)
    return NextResponse.json({ error: 'Error del servidor: ' + err.message }, { status: 500 })
  }
}
