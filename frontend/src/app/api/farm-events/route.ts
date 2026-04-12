/**
 * GET  /api/farm-events  — Eventos de la organización
 * POST /api/farm-events  — Crea un nuevo evento
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { queryOne, query, mutate } from '@/lib/db'

async function getOrgId(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim() || ''
  if (!token) return null
  const decoded = await verifyFirebaseToken(token)
  if (!decoded) return null
  const profile = await queryOne<{ organization_id: string }>(
    'SELECT organization_id FROM profiles WHERE firebase_uid = $1',
    [decoded.uid]
  )
  if (!profile?.organization_id) return null
  return { orgId: profile.organization_id, uid: decoded.uid }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getOrgId(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const events = await query(
      `SELECT id, org_id, title, event_type,
              TO_CHAR(event_date, 'YYYY-MM-DD') AS event_date,
              TO_CHAR(end_date,   'YYYY-MM-DD') AS end_date,
              herd_id, herd_ids, paddock_id, description, status, created_at
       FROM farm_events
       WHERE org_id = $1
       ORDER BY event_date ASC`,
      [auth.orgId]
    )

    // Normalize DB status to UI values
    const STATUS_DB_TO_UI: Record<string, string> = {
      SCHEDULED: 'pendiente', COMPLETED: 'completado', CANCELLED: 'cancelado',
      pendiente: 'pendiente', completado: 'completado', cancelado: 'cancelado',
    }
    const normalized = (events as any[]).map(e => ({
      ...e,
      status: STATUS_DB_TO_UI[e.status] ?? 'pendiente',
    }))

    return NextResponse.json({ events: normalized })
  } catch (err: any) {
    console.error('GET /api/farm-events error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getOrgId(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const { title, event_type, event_date, end_date, herd_id, herd_ids, paddock_id, description, status } = body

    if (!title || !event_type || !event_date) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    // Normalize UI status to DB values
    const STATUS_UI_TO_DB: Record<string, string> = {
      pendiente: 'SCHEDULED', completado: 'COMPLETED', cancelado: 'CANCELLED',
      SCHEDULED: 'SCHEDULED', COMPLETED: 'COMPLETED', CANCELLED: 'CANCELLED',
    }
    const dbStatus = STATUS_UI_TO_DB[status] ?? 'SCHEDULED'
    const finalHerdIds = Array.isArray(herd_ids) ? JSON.stringify(herd_ids) : null

    const result = await mutate(
      `INSERT INTO farm_events
         (org_id, title, event_type, event_date, end_date, herd_id, herd_ids, paddock_id, description, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id`,
      [
        auth.orgId, title, event_type, event_date,
        end_date || null, herd_id || null, finalHerdIds, paddock_id || null,
        description || null, dbStatus,
      ]
    )

    return NextResponse.json({ id: result.rows[0]?.id }, { status: 201 })
  } catch (err: any) {
    console.error('POST /api/farm-events error:', err)
    return NextResponse.json({ error: 'Error del servidor: ' + err.message }, { status: 500 })
  }
}
