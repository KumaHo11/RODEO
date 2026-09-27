/**
 * DELETE /api/grazing-plans/bulk-delete
 * Elimina planificaciones en masa con soporte para tres modos:
 *
 *  1. Por season_plan_id  → borra TODOS los bloques de esa temporada
 *     (excepto COMPLETED, que son registros históricos inamovibles)
 *     Uso: ?season_plan_id=<uuid>
 *
 *  2. Por status + plan_type  → borrado masivo por tipo/estado
 *     Uso: ?status=PLANNED&plan_type=suggested
 *
 * Nunca borra bloques con status COMPLETED.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { serviceMutate } from '@/lib/db'

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const url = new URL(req.url)
    const seasonPlanId = url.searchParams.get('season_plan_id')

    // ── Modo 1: Borrar todos los bloques de un season_plan ────────────────────
    if (seasonPlanId) {
      const result = await serviceMutate(
        `DELETE FROM grazing_plans
         WHERE season_plan_id = $1
           AND paddock_id IN (SELECT id FROM paddocks WHERE org_id = $2)
           AND status != 'COMPLETED'
         RETURNING id`,
        [seasonPlanId, auth.orgId]
      )
      return NextResponse.json({ deleted: result.rowCount ?? 0 })
    }

    // ── Modo 2: Borrar por status ─────────────────────────────────────────────
    const statusParam = url.searchParams.get('status') || 'PLANNED'
    const statuses = statusParam.split(',').map(s => s.trim().toUpperCase())

    const allowed = ['PLANNED', 'ACTIVE']
    const toDelete = statuses.filter(s => allowed.includes(s))
    if (toDelete.length === 0) {
      return NextResponse.json({ error: 'Estado no permitido para borrado masivo' }, { status: 400 })
    }

    const planType = url.searchParams.get('plan_type') || null
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
