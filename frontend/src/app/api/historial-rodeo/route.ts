/**
 * GET  /api/historial-rodeo?rodeo_id=<id>&days=90
 *   Devuelve el historial de condición corporal (BCS) de un rodeo ordenado por fecha DESC.
 *
 * POST /api/historial-rodeo
 *   Inserta un nuevo registro histórico de BCS.
 *   Body: {
 *     rodeo_id, bcs_score, bcs_label?, estimated_weight_kg?,
 *     animal_count_visible?, alert_level?, confidence?,
 *     analysis_data?, source?, entry_id?, recorded_at?
 *   }
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { serviceQuery, serviceQueryOne, serviceMutate } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function getAuth(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim() || ''
  if (!token) return null
  const decoded = await verifyFirebaseToken(token).catch(() => null)
  if (!decoded) return null
  const profile = await serviceQueryOne<{ id: string; organization_id: string }>(
    'SELECT id, organization_id FROM profiles WHERE firebase_uid = $1',
    [decoded.uid]
  ).catch(() => null)
  if (!profile?.organization_id) return null
  return { uid: decoded.uid, profileId: profile.id, orgId: profile.organization_id }
}

// Ensure table exists (defensive — v27 migration should already create it)
async function ensureTable() {
  try {
    await serviceMutate(`
      CREATE TABLE IF NOT EXISTS historial_rodeo (
        id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id                UUID        NOT NULL,
        rodeo_id              UUID        NOT NULL,
        bcs_score             NUMERIC(3,1),
        bcs_label             TEXT,
        estimated_weight_kg   NUMERIC(8,2),
        animal_count_visible  INT,
        alert_level           TEXT,
        confidence            NUMERIC(4,3),
        analysis_data         JSONB,
        source                TEXT        NOT NULL DEFAULT 'BITACORA_AI',
        entry_id              UUID,
        recorded_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `, [])
    await serviceMutate(
      `CREATE INDEX IF NOT EXISTS idx_historial_rodeo_rodeo_recorded
       ON historial_rodeo(rodeo_id, recorded_at DESC)`, []
    )
  } catch (_e) {
    // Table might already exist from migration — ignore
  }
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await getAuth(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const rodeoId = searchParams.get('rodeo_id')
  const days    = Math.min(365, parseInt(searchParams.get('days') ?? '90', 10))

  if (!rodeoId) {
    return NextResponse.json({ error: 'rodeo_id requerido' }, { status: 400 })
  }

  // Verify ownership
  const ownership = await serviceQueryOne<{ id: string }>(
    'SELECT id FROM herds WHERE id = $1 AND org_id = $2',
    [rodeoId, auth.orgId]
  )
  if (!ownership) {
    return NextResponse.json({ error: 'Rodeo no encontrado' }, { status: 404 })
  }

  await ensureTable()

  const rows = await serviceQuery<{
    id: string
    bcs_score: number | null
    bcs_label: string | null
    estimated_weight_kg: number | null
    animal_count_visible: number | null
    alert_level: string | null
    confidence: number | null
    source: string
    entry_id: string | null
    recorded_at: string
    created_at: string
  }>(`
    SELECT
      id, bcs_score, bcs_label, estimated_weight_kg,
      animal_count_visible, alert_level, confidence,
      source, entry_id,
      recorded_at::text, created_at::text
    FROM historial_rodeo
    WHERE rodeo_id = $1
      AND org_id   = $2
      AND recorded_at >= NOW() - ($3 || ' days')::interval
    ORDER BY recorded_at DESC
    LIMIT 200
  `, [rodeoId, auth.orgId, days])

  return NextResponse.json({ historial: rows, rodeo_id: rodeoId })
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await getAuth(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.rodeo_id) {
    return NextResponse.json({ error: 'rodeo_id requerido' }, { status: 400 })
  }

  // Verify ownership
  const ownership = await serviceQueryOne<{ id: string }>(
    'SELECT id FROM herds WHERE id = $1 AND org_id = $2',
    [body.rodeo_id, auth.orgId]
  )
  if (!ownership) {
    return NextResponse.json({ error: 'Rodeo no encontrado' }, { status: 404 })
  }

  await ensureTable()

  const {
    rodeo_id, bcs_score, bcs_label, estimated_weight_kg,
    animal_count_visible, alert_level, confidence,
    analysis_data, source, entry_id, recorded_at,
  } = body

  const result = await serviceMutate(`
    INSERT INTO historial_rodeo (
      org_id, rodeo_id, bcs_score, bcs_label, estimated_weight_kg,
      animal_count_visible, alert_level, confidence,
      analysis_data, source, entry_id, recorded_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    RETURNING id, recorded_at::text
  `, [
    auth.orgId,
    rodeo_id,
    bcs_score   ?? null,
    bcs_label   ?? null,
    estimated_weight_kg ?? null,
    animal_count_visible ?? null,
    alert_level ?? null,
    confidence  ?? null,
    analysis_data ? JSON.stringify(analysis_data) : null,
    source      || 'BITACORA_AI',
    entry_id    ?? null,
    recorded_at ?? new Date().toISOString(),
  ])

  return NextResponse.json({ id: result.rows[0]?.id, recorded_at: result.rows[0]?.recorded_at }, { status: 201 })
}
