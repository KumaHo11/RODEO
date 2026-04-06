/**
 * PATCH  /api/tasks/[id]  — Actualiza una tarea (estado, etc.)
 * DELETE /api/tasks/[id]  — Elimina una tarea
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { queryOne, mutate } from '@/lib/db'

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getOrgId(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()

    const sets: string[] = ['updated_at = NOW()']
    const vals: any[] = []
    let i = 1

    const validFields = [
      'title', 'description', 'task_type', 'paddock_id',
      'assigned_to', 'due_date', 'priority', 'status'
    ]

    for (const field of validFields) {
      if (body[field] !== undefined) {
        sets.push(`${field} = $${i++}`)
        vals.push(body[field])
      }
    }

    vals.push((await params).id, auth.orgId)
    await mutate(
      `UPDATE tasks SET ${sets.join(', ')} WHERE id = $${i++} AND org_id = $${i}`,
      vals
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('PATCH /api/tasks/[id] error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getOrgId(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    await mutate(
      'DELETE FROM tasks WHERE id = $1 AND org_id = $2',
      [(await params).id, auth.orgId]
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('DELETE /api/tasks/[id] error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
