/**
 * DELETE /api/grazing-plans/bulk-delete
 * Elimina todas las planificaciones con status PLANNED de la organización.
 * Opcionalmente acepta ?status=PLANNED,ACTIVE para filtrar.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { mutate } from '@/lib/db'

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
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
       WHERE paddock_id IN (SELECT id FROM paddocks WHERE org_id = $1)
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
