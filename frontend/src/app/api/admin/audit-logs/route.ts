/**
 * GET /api/admin/audit-logs
 * Audit log viewer for Super Admin.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { serviceQuery } from '@/lib/db'

async function requireSuperAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (!token) return null
  const decoded = await verifyFirebaseToken(token)
  if (!decoded || decoded.system_role !== 'SUPER_ADMIN') return null
  return decoded
}

export async function GET(req: NextRequest) {
  const admin = await requireSuperAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = req.nextUrl
  const action      = searchParams.get('action')
  const entityType  = searchParams.get('entity_type')
  const actorEmail  = searchParams.get('actor')
  const dateFrom    = searchParams.get('date_from')
  const dateTo      = searchParams.get('date_to')
  const page        = parseInt(searchParams.get('page') || '1')
  const limit       = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
  const offset      = (page - 1) * limit

  const conditions: string[] = []
  const params: unknown[] = []
  let idx = 1

  if (action)     { conditions.push(`al.action = $${idx++}`);           params.push(action) }
  if (entityType) { conditions.push(`al.entity_type = $${idx++}`);      params.push(entityType) }
  if (actorEmail) { conditions.push(`al.actor_email ILIKE $${idx++}`);  params.push(`%${actorEmail}%`) }
  if (dateFrom)   { conditions.push(`al.created_at >= $${idx++}`);      params.push(dateFrom) }
  if (dateTo)     { conditions.push(`al.created_at <= $${idx++}`);      params.push(dateTo) }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  try {
    const logs = await serviceQuery(
      `SELECT al.*, p.first_name || ' ' || p.last_name AS actor_name
       FROM audit_logs al
       LEFT JOIN profiles p ON p.id = al.actor_id
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    )

    const [{ total }] = await serviceQuery<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM audit_logs al ${whereClause}`,
      params
    )

    return NextResponse.json({ logs, total: parseInt(total), page, limit })
  } catch (err) {
    console.error('GET /api/admin/audit-logs error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
