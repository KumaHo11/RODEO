import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { queryOne, mutate } from '@/lib/db'

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
  return { orgId: profile.organization_id, uid: decoded.uid, profileId: profile.id }
}

export async function DELETE(
  req: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const auth = await getAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const resolvedParams = await Promise.resolve(context.params)
    const id = resolvedParams.id
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    const res = await mutate(
      'DELETE FROM movements WHERE id = $1 AND org_id = $2 RETURNING id',
      [id, auth.orgId]
    )

    if (res.rowCount === 0) {
      return NextResponse.json({ error: 'Movimiento no encontrado o sin permisos' }, { status: 404 })
    }

    return NextResponse.json({ deleted: true })
  } catch (err: any) {
    console.error('DELETE /api/movements/[id] error:', err)
    return NextResponse.json({ error: 'Error del servidor: ' + err.message }, { status: 500 })
  }
}
