/**
 * GET   /api/notifications  — Notificaciones del usuario
 * PATCH /api/notifications  — Marcar como leídas
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { query, mutate, queryOne } from '@/lib/db'

async function getProfile(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim() || ''
  if (!token) return null
  const decoded = await verifyFirebaseToken(token)
  if (!decoded) return null
  return queryOne<{ id: string; organization_id: string }>(
    'SELECT id, organization_id FROM profiles WHERE firebase_uid = $1',
    [decoded.uid]
  )
}

export async function GET(req: NextRequest) {
  try {
    const profile = await getProfile(req)
    if (!profile) return NextResponse.json({ notifications: [], pendingTasks: 0 })

    const [notifications, tasks] = await Promise.all([
      query(
        `SELECT id, type, title, COALESCE(body, message) AS body, message, is_read, created_at
         FROM notifications
         WHERE profile_id = $1 OR user_id = $1
         ORDER BY created_at DESC LIMIT 20`,
        [profile.id]
      ),
      query(
        `SELECT count(*) as count FROM tasks
         WHERE assigned_to = $1 AND status != 'COMPLETADA'`,
        [profile.id]
      ),
    ])

    return NextResponse.json({
      notifications,
      pendingTasks: parseInt((tasks[0] as any)?.count || '0'),
    })
  } catch (err) {
    console.error('GET /api/notifications error:', err)
    return NextResponse.json({ notifications: [], pendingTasks: 0 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const profile = await getProfile(req)
    if (!profile) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { ids } = await req.json()
    if (ids && ids.length > 0) {
      await mutate(
        `UPDATE notifications SET is_read = true
         WHERE (profile_id = $1 OR user_id = $1) AND id = ANY($2::uuid[])`,
        [profile.id, ids]
      )
    } else {
      await mutate(
        `UPDATE notifications SET is_read = true
         WHERE profile_id = $1 OR user_id = $1`,
        [profile.id]
      )
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('PATCH /api/notifications error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
