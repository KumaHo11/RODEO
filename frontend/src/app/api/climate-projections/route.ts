/**
 * /api/climate-projections
 * POST — Guarda una serie de proyección calculada en frontend
 * GET  — Lista proyecciones históricas para reportes
 *
 * Tabla (se crea automáticamente si no existe vía CREATE TABLE IF NOT EXISTS):
 *   climate_projections(id, organization_id, projected_at, series jsonb, meta jsonb)
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { queryOne, query } from '@/lib/db'

async function getOrgId(req: NextRequest): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim() || ''
  if (!token) return null
  const decoded = await verifyFirebaseToken(token)
  if (!decoded) return null
  const profile = await queryOne<{ organization_id: string }>(
    'SELECT organization_id FROM profiles WHERE firebase_uid = $1',
    [decoded.uid]
  )
  return profile?.organization_id ?? null
}

// ── POST — Save a projected series ───────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const { series, meta } = body
    // series: [{ date, kg_estimated, rain_mm, temp_max, humidity_pct, wind_kmh }]
    if (!Array.isArray(series) || series.length === 0) {
      return NextResponse.json({ error: 'series requerido' }, { status: 400 })
    }

    // Create table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS climate_projections (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL,
        projected_at    timestamptz NOT NULL DEFAULT now(),
        series          jsonb NOT NULL,
        meta            jsonb,
        created_at      timestamptz NOT NULL DEFAULT now()
      )
    `, [])

    const row = await queryOne<{ id: string }>(
      `INSERT INTO climate_projections (organization_id, series, meta)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [orgId, JSON.stringify(series), JSON.stringify(meta ?? {})]
    )

    return NextResponse.json({ ok: true, id: row?.id })
  } catch (err) {
    console.error('[POST /api/climate-projections]', err)
    return NextResponse.json({ error: 'Error al guardar proyección' }, { status: 500 })
  }
}

// ── GET — List historical projections ────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '30'), 90)

    // Ensure table exists before querying
    await query(`
      CREATE TABLE IF NOT EXISTS climate_projections (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL,
        projected_at    timestamptz NOT NULL DEFAULT now(),
        series          jsonb NOT NULL,
        meta            jsonb,
        created_at      timestamptz NOT NULL DEFAULT now()
      )
    `, [])

    const rows = await query<{
      id: string; projected_at: string; series: any; meta: any
    }>(
      `SELECT id, projected_at, series, meta
       FROM climate_projections
       WHERE organization_id = $1
       ORDER BY projected_at DESC
       LIMIT $2`,
      [orgId, limit]
    )

    return NextResponse.json({ projections: rows })
  } catch (err) {
    console.error('[GET /api/climate-projections]', err)
    return NextResponse.json({ error: 'Error al obtener proyecciones' }, { status: 500 })
  }
}
