import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { serviceQueryOne, serviceQuery } from '@/lib/db'

async function getOrgId(firebaseUid: string): Promise<string | null> {
  const profile = await serviceQueryOne(
    'SELECT organization_id FROM profiles WHERE firebase_uid = $1',
    [firebaseUid]
  )
  return typeof profile?.organization_id === 'string' ? profile.organization_id : null
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 })

    const decoded = await verifyFirebaseToken(token)
    if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const orgId = await getOrgId(decoded.uid)
    if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 })

    const body = await req.json()
    const { title, event_type, event_date, end_date, description, status, herd_id, assigned_to, bulls_count, bulls_weight } = body

    const STATUS_UI_TO_DB: Record<string, string> = {
      pendiente: 'SCHEDULED', completado: 'COMPLETED', cancelado: 'CANCELLED',
      SCHEDULED: 'SCHEDULED', COMPLETED: 'COMPLETED', CANCELLED: 'CANCELLED',
    }
    const dbStatus = status ? (STATUS_UI_TO_DB[status] ?? status) : null

    await serviceQuery(
      `UPDATE farm_events SET
         title       = COALESCE($1, title),
         event_type  = COALESCE($2, event_type),
         event_date  = COALESCE($3::date, event_date),
         end_date    = $4::date,
         description = $5,
         status      = COALESCE($6, status),
         herd_id     = $7,
         updated_at  = NOW()
       WHERE id = $8 AND org_id = $9`,
      [
        title || null,
        event_type || null,
        event_date || null,
        end_date || null,
        description || null,
        dbStatus,
        herd_id || null,
        (await params).id,
        orgId,
      ]
    )

    // Optional: update assigned_to if column exists
    if (assigned_to !== undefined) {
      try {
        await serviceQuery(
          `UPDATE farm_events SET assigned_to = $1 WHERE id = $2 AND org_id = $3`,
          [assigned_to || null, (await params).id, orgId]
        )
      } catch { /* column not yet migrated */ }
    }

    // Optional: update bulls fields if columns exist
    if (bulls_count !== undefined || bulls_weight !== undefined) {
      try {
        await serviceQuery(
          `UPDATE farm_events SET bulls_count = $1, bulls_weight = $2 WHERE id = $3 AND org_id = $4`,
          [bulls_count ?? null, bulls_weight ?? null, (await params).id, orgId]
        )
      } catch { /* column not yet migrated */ }
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('PATCH /api/farm-events/[id]:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 })

    const decoded = await verifyFirebaseToken(token)
    if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const orgId = await getOrgId(decoded.uid)
    if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 })

    await serviceQuery('DELETE FROM farm_events WHERE id = $1 AND org_id = $2', [(await params).id, orgId])
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('DELETE /api/farm-events/[id]:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
