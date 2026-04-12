/**
 * DELETE /api/grazing-plans/bulk-delete
 * Elimina todas las planificaciones con status PLANNED de la organización.
 * Opcionalmente acepta ?status=PLANNED,ACTIVE para filtrar.
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

export async function DELETE(req: NextRequest) {
  try {
    const auth = await getOrgId(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const url = new URL(req.url)
    const statusParam = url.searchParams.get('status') || 'PLANNED'
    const statuses = statusParam.split(',').map(s => s.trim().toUpperCase())
    
    // Only allow deleting PLANNED and/or ACTIVE — never COMPLETED (historical records)
    const allowed = ['PLANNED', 'ACTIVE']
    const toDelete = statuses.filter(s => allowed.includes(s))
    if (toDelete.length === 0) {
      return NextResponse.json({ error: 'Estado no permitido para borrado masivo' }, { status: 400 })
    }

    // Build parameterized query
    const placeholders = toDelete.map((_, i) => `$${i + 2}`).join(', ')
    const result = await mutate(
      `DELETE FROM grazing_plans
       WHERE org_id = $1
         AND status IN (${placeholders})
       RETURNING id`,
      [auth.orgId, ...toDelete]
    )

    return NextResponse.json({ deleted: result.rowCount ?? 0 })
  } catch (err: any) {
    console.error('DELETE /api/grazing-plans/bulk-delete error:', err)
    return NextResponse.json({ error: 'Error del servidor: ' + err.message }, { status: 500 })
  }
}
