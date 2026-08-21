import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { query, mutate } from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = await params;

    const events = await query(
      `SELECT e.*, p.first_name, p.last_name 
       FROM animal_events e
       LEFT JOIN profiles p ON e.recorded_by = p.id
       WHERE e.animal_id = $1 AND e.org_id = $2
       ORDER BY e.event_date DESC`,
      [id, auth.orgId]
    )

    return NextResponse.json({ events })
  } catch (err: any) {
    console.error('GET /api/animals/[id]/events error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = await params;
    const body = await req.json()
    const {
      event_type, event_date, details, location, photo_urls, source, device_info
    } = body

    if (!event_type || !event_date) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    // Insert the event
    const result = await mutate(
      `INSERT INTO animal_events (
        org_id, animal_id, event_type, event_date, details, 
        location, photo_urls, recorded_by, source, device_info
      ) VALUES (
        $1, $2, $3, $4, $5, 
        ${location ? 'ST_SetSRID(ST_MakePoint($6, $7), 4326)' : 'NULL'}, 
        $8, $9, $10, $11
      ) RETURNING *`,
      [
        auth.orgId,
        id,
        event_type,
        event_date,
        details || {},
        ...(location ? [location.lng, location.lat] : []),
        photo_urls || null,
        auth.profileId,
        source || 'APP',
        device_info || null
      ]
    )

    return NextResponse.json({ event: result.rows ? result.rows[0] : null }, { status: 201 })
  } catch (err: any) {
    console.error('POST /api/animals/[id]/events error:', err)
    return NextResponse.json({ error: 'Error interno del servidor', detail: err?.message }, { status: 500 })
  }
}
