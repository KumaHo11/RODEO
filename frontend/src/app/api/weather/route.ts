/**
 * GET  /api/weather   — Lista eventos climáticos (lluvia y heladas) de la org
 * POST /api/weather   — Crea un evento climático guardándolo en historial_potrero
 *
 * Almacenamiento: usa la tabla `historial_potrero` existente:
 *   - precipitacion  → mm de lluvia
 *   - notas          → "FROST:-3.5" para heladas
 *   - estado_pastoreo → "RAIN" | "FROST" para identificar tipo de evento
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { serviceQueryOne, serviceQuery, getServicePool } from '@/lib/db'
import type { CreateWeatherEventPayload } from '@/lib/types/weather'

// ── Auth helper (same pattern as other routes) ────────────────────────────────
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
  return { orgId: profile.organization_id, profileId: profile.id }
}

// ── GET /api/weather ──────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1', 10))
    const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50', 10))
    const type  = searchParams.get('type') // 'RAIN' | 'FROST' | null
    const offset = (page - 1) * limit

    const conditions: string[] = ['hp.org_id = $1']
    const vals: unknown[] = [auth.orgId]
    let idx = 2

    // Filter: only rows that represent weather events
    conditions.push(`(hp.precipitacion IS NOT NULL AND hp.precipitacion > 0 OR hp.estado_pastoreo IN ('RAIN','FROST'))`)

    if (type === 'RAIN') {
      conditions.push(`(hp.precipitacion IS NOT NULL AND hp.precipitacion > 0)`)
    } else if (type === 'FROST') {
      conditions.push(`hp.estado_pastoreo = 'FROST'`)
    }

    const where = conditions.join(' AND ')

    const events = await serviceQuery<Record<string, unknown>>(`
      SELECT
        hp.id,
        hp.org_id,
        CASE
          WHEN hp.estado_pastoreo = 'FROST' THEN 'FROST'
          WHEN hp.precipitacion IS NOT NULL AND hp.precipitacion > 0 THEN 'RAIN'
          ELSE 'RAIN'
        END as type,
        CASE
          WHEN hp.estado_pastoreo = 'FROST' THEN
            COALESCE(
              NULLIF(REGEXP_REPLACE(hp.notas, '^FROST:', ''), hp.notas)::numeric,
              0
            )
          ELSE COALESCE(hp.precipitacion, 0)
        END as value,
        hp.fecha as date,
        hp.notas as notes,
        hp.created_at,
        hp.created_at as updated_at,
        json_build_object(
          'id', p.id,
          'name', p.name,
          'areaHa', p.area_ha
        ) as paddock_info
      FROM historial_potrero hp
      JOIN paddocks p ON p.id = hp.paddock_id
      WHERE ${where}
      ORDER BY hp.fecha DESC, hp.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...vals, limit, offset])

    // Group by date+type to create weather event objects with paddock arrays
    const eventMap = new Map<string, any>()
    for (const row of events) {
      const key = `${row.date}_${row.type}`
      if (!eventMap.has(key)) {
        eventMap.set(key, {
          id: row.id,
          org_id: row.org_id,
          type: row.type,
          value: Number(row.value),
          date: row.date,
          notes: row.notes && String(row.notes).startsWith('FROST:') ? null : row.notes,
          created_at: row.created_at,
          updated_at: row.updated_at,
          paddocks: [],
        })
      }
      const evt = eventMap.get(key)!
      evt.paddocks.push({
        weatherEventId: row.id,
        paddockId: (row.paddock_info as any)?.id,
        paddock: row.paddock_info,
      })
    }

    const totalRows = await serviceQueryOne<{ count: string }>(`
      SELECT COUNT(DISTINCT (hp.fecha, hp.estado_pastoreo)) AS count
      FROM historial_potrero hp
      WHERE ${where}
    `, vals)

    return NextResponse.json({
      events: Array.from(eventMap.values()),
      total: parseInt(totalRows?.count ?? '0', 10),
    })
  } catch (err: unknown) {
    console.error('[GET /api/weather] ERROR:', err instanceof Error ? err.stack : err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

// ── POST /api/weather ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

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
    const paddocks = await serviceQuery<{ id: string; name: string; area_ha: number | null }>(
      `SELECT id, name, area_ha FROM paddocks WHERE id IN (${placeholders}) AND org_id = $1`,
      [auth.orgId, ...body.paddockIds]
    )
    if (paddocks.length !== body.paddockIds.length) {
      return NextResponse.json({ error: 'Uno o más potreros no encontrados.' }, { status: 400 })
    }

    // Insert into historial_potrero for each paddock
    const client = await getServicePool().connect()
    const insertedRows: any[] = []
    try {
      await client.query('BEGIN')
      console.log(`[POST /api/weather] Starting transaction: type=${body.type} value=${body.value} date=${body.date} paddocks=${body.paddockIds.length}`)

      for (const paddock of paddocks) {
        if (body.type === 'RAIN') {
          const result = await client.query(`
            INSERT INTO historial_potrero (org_id, paddock_id, fecha, precipitacion, estado_pastoreo, notas)
            VALUES ($1, $2, $3, $4, 'RAIN', $5)
            ON CONFLICT (paddock_id, fecha) DO UPDATE SET
              precipitacion = EXCLUDED.precipitacion,
              estado_pastoreo = 'RAIN',
              notas = COALESCE(EXCLUDED.notas, historial_potrero.notas)
            RETURNING *
          `, [auth.orgId, paddock.id, body.date, body.value, body.notes ?? null])
          insertedRows.push(result.rows[0])
        } else {
          // FROST: store temp in notas as "FROST:<value>"
          const frostNote = `FROST:${body.value}`
          const result = await client.query(`
            INSERT INTO historial_potrero (org_id, paddock_id, fecha, estado_pastoreo, notas)
            VALUES ($1, $2, $3, 'FROST', $4)
            ON CONFLICT (paddock_id, fecha) DO UPDATE SET
              estado_pastoreo = 'FROST',
              notas = $4
            RETURNING *
          `, [auth.orgId, paddock.id, body.date, frostNote])
          insertedRows.push(result.rows[0])
        }
      }

      await client.query('COMMIT')
      console.log(`[POST /api/weather] ✓ transaction committed: ${insertedRows.length} rows`)

      // Build response in the expected weather event format
      const event = {
        id: insertedRows[0]?.id ?? crypto.randomUUID(),
        org_id: auth.orgId,
        recorder_id: auth.profileId,
        type: body.type,
        value: body.value,
        date: body.date,
        notes: body.notes ?? null,
        created_at: insertedRows[0]?.created_at ?? new Date().toISOString(),
        updated_at: insertedRows[0]?.created_at ?? new Date().toISOString(),
        paddocks: paddocks.map(p => ({
          weatherEventId: insertedRows.find(r => r.paddock_id === p.id)?.id ?? '',
          paddockId: p.id,
          paddock: { id: p.id, name: p.name, areaHa: p.area_ha },
        })),
      }

      return NextResponse.json({ event }, { status: 201 })
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      throw err
    } finally {
      client.release()
    }
  } catch (err: unknown) {
    console.error('[POST /api/weather] ERROR:', err instanceof Error ? err.stack : err)
    return NextResponse.json({ error: 'Error del servidor', detail: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
