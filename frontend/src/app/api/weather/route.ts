/**
 * GET  /api/weather   — Lista eventos climáticos (lluvia y heladas) de la org
 * POST /api/weather   — Crea un evento climático + vínculos M2M a potreros
 *
 * Tablas necesarias (ejecutar migración manual si no existen):
 *
 * CREATE TABLE IF NOT EXISTS weather_events (
 *   id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
 *   org_id       UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 *   recorder_id  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
 *   type         VARCHAR(10) NOT NULL CHECK (type IN ('RAIN','FROST')),
 *   value        NUMERIC(10,2) NOT NULL,
 *   date         DATE        NOT NULL,
 *   notes        TEXT,
 *   created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *   updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
 * );
 *
 * CREATE TABLE IF NOT EXISTS weather_event_paddocks (
 *   weather_event_id UUID NOT NULL REFERENCES weather_events(id) ON DELETE CASCADE,
 *   paddock_id       UUID NOT NULL REFERENCES paddocks(id) ON DELETE CASCADE,
 *   created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *   PRIMARY KEY (weather_event_id, paddock_id)
 * );
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { queryOne, query, mutate, getDbPool } from '@/lib/db'
import type { CreateWeatherEventPayload } from '@/lib/types/weather'

// ── Auth helper (same pattern as other routes) ────────────────────────────────
async function getAuth(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim() || ''
  if (!token) return null
  const decoded = await verifyFirebaseToken(token)
  if (!decoded) return null
  const profile = await queryOne<{ organization_id: string; id: string }>(
    'SELECT organization_id, id FROM profiles WHERE firebase_uid = $1',
    [decoded.uid]
  )
  if (!profile?.organization_id) return null
  return { orgId: profile.organization_id, profileId: profile.id }
}

// ── Ensure tables exist ───────────────────────────────────────────────────────
async function ensureTables() {
  try {
    await mutate(`
      CREATE TABLE IF NOT EXISTS weather_events (
        id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id       UUID        NOT NULL,
        recorder_id  UUID,
        type         VARCHAR(10) NOT NULL CHECK (type IN ('RAIN','FROST')),
        value        NUMERIC(10,2) NOT NULL,
        date         DATE        NOT NULL,
        notes        TEXT,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `, [])
    await mutate(`
      CREATE TABLE IF NOT EXISTS weather_event_paddocks (
        weather_event_id UUID NOT NULL,
        paddock_id       UUID NOT NULL,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (weather_event_id, paddock_id)
      )
    `, [])
  } catch (_e) {
    // Tables may already exist — ignore
  }
}

// ── GET /api/weather ──────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    await ensureTables()

    const { searchParams } = new URL(req.url)
    const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1', 10))
    const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50', 10))
    const type  = searchParams.get('type') // 'RAIN' | 'FROST' | null
    const offset = (page - 1) * limit

    const conditions: string[] = ['we.org_id = $1']
    const vals: unknown[] = [auth.orgId]
    let idx = 2

    if (type && ['RAIN', 'FROST'].includes(type)) {
      conditions.push(`we.type = $${idx++}`)
      vals.push(type)
    }

    const where = conditions.join(' AND ')

    // Events with their paddock links in a single query using JSON aggregation
    const events = await query<Record<string, unknown>>(`
      SELECT
        we.*,
        COALESCE(
          json_agg(
            json_build_object(
              'weatherEventId', wep.weather_event_id,
              'paddockId',      wep.paddock_id,
              'createdAt',      wep.created_at,
              'paddock',        json_build_object(
                'id',     p.id,
                'name',   p.name,
                'areaHa', p.area_ha
              )
            ) ORDER BY p.name
          ) FILTER (WHERE wep.paddock_id IS NOT NULL),
          '[]'
        ) AS paddocks
      FROM weather_events we
      LEFT JOIN weather_event_paddocks wep ON wep.weather_event_id = we.id
      LEFT JOIN paddocks p ON p.id = wep.paddock_id
      WHERE ${where}
      GROUP BY we.id
      ORDER BY we.date DESC, we.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...vals, limit, offset])

    const totalRows = await queryOne<{ count: string }>(`
      SELECT COUNT(*) AS count FROM weather_events we WHERE ${where}
    `, vals)

    return NextResponse.json({
      events,
      total: parseInt(totalRows?.count ?? '0', 10),
    })
  } catch (err: unknown) {
    console.error('[GET /api/weather]', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

// ── POST /api/weather ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    await ensureTables()

    const body: CreateWeatherEventPayload = await req.json()

    if (!body.type || !['RAIN', 'FROST'].includes(body.type)) {
      return NextResponse.json({ error: 'Tipo inválido. Debe ser RAIN o FROST.' }, { status: 400 })
    }
    if (typeof body.value !== 'number' || isNaN(body.value)) {
      return NextResponse.json({ error: 'Valor inválido.' }, { status: 400 })
    }
    if (!body.date) {
      return NextResponse.json({ error: 'La fecha es requerida.' }, { status: 400 })
    }
    if (!Array.isArray(body.paddockIds) || body.paddockIds.length === 0) {
      return NextResponse.json({ error: 'Seleccioná al menos un potrero.' }, { status: 400 })
    }

    // Verify paddocks belong to this org
    const placeholders = body.paddockIds.map((_, i) => `$${i + 2}`).join(', ')
    const paddocks = await query<{ id: string }>(
      `SELECT id FROM paddocks WHERE id IN (${placeholders}) AND org_id = $1`,
      [auth.orgId, ...body.paddockIds]
    )
    if (paddocks.length !== body.paddockIds.length) {
      return NextResponse.json({ error: 'Uno o más potreros no encontrados.' }, { status: 400 })
    }

    // Transaction: insert event + M2M links
    const client = await getDbPool().connect()
    try {
      await client.query('BEGIN')

      const eventResult = await client.query(
        `INSERT INTO weather_events (org_id, recorder_id, type, value, date, notes)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [auth.orgId, auth.profileId, body.type, body.value, body.date, body.notes ?? null]
      )
      const event = eventResult.rows[0]

      // Insert M2M links
      for (const paddockId of paddocks.map(p => p.id)) {
        await client.query(
          'INSERT INTO weather_event_paddocks (weather_event_id, paddock_id) VALUES ($1, $2)',
          [event.id, paddockId]
        )
      }

      await client.query('COMMIT')

      // Fetch the full event with paddock details for the response
      const fullEvents = await query<Record<string, unknown>>(`
        SELECT
          we.*,
          COALESCE(
            json_agg(
              json_build_object(
                'weatherEventId', wep.weather_event_id,
                'paddockId',      wep.paddock_id,
                'paddock',        json_build_object('id', p.id, 'name', p.name, 'areaHa', p.area_ha)
              ) ORDER BY p.name
            ) FILTER (WHERE wep.paddock_id IS NOT NULL),
            '[]'
          ) AS paddocks
        FROM weather_events we
        LEFT JOIN weather_event_paddocks wep ON wep.weather_event_id = we.id
        LEFT JOIN paddocks p ON p.id = wep.paddock_id
        WHERE we.id = $1
        GROUP BY we.id
      `, [event.id])

      return NextResponse.json({ event: fullEvents[0] }, { status: 201 })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err: unknown) {
    console.error('[POST /api/weather]', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
