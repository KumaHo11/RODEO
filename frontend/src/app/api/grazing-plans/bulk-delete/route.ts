/**
 * DELETE /api/grazing-plans/bulk-delete
 * Elimina planificaciones según status y opcionalmente plan_type.
 * Acepta ?status=PLANNED&plan_type=suggested para "nueva hoja" de planificación.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { serviceMutate } from '@/lib/db'

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

    // Optional plan_type filter (e.g. 'suggested') — si se pasa, solo borra esos bloques
    const planType = url.searchParams.get('plan_type') || null

    // Build parameterized query
    const placeholders = toDelete.map((_, i) => `$${i + 2}`).join(', ')
    const params: any[] = [auth.orgId, ...toDelete]

    let planTypeClause = ''
    if (planType) {
      params.push(planType)
      planTypeClause = `AND plan_type = $${params.length}`
    }

    const result = await serviceMutate(
      `DELETE FROM grazing_plans
       WHERE paddock_id IN (SELECT id FROM paddocks WHERE org_id = $1)
         AND status IN (${placeholders})
         ${planTypeClause}
       RETURNING id`,
      params
    )

    return NextResponse.json({ deleted: result.rowCount ?? 0 })
  } catch (err: any) {
    console.error('DELETE /api/grazing-plans/bulk-delete error:', err)
    return NextResponse.json({ error: 'Error del servidor: ' + err.message }, { status: 500 })
  }
}
