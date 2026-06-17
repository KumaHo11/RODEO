/**
 * POST /api/grazing-plans/close-cycle
 * Cierra un ciclo de pastoreo: asigna un cycle_id compartido a todos
 * los bloques del período seleccionado (manuales y sugeridos),
 * cambia su status a 'HISTORY' y retorna el cycle_id para benchmarking.
 *
 * Body:
 *   - plan_ids: string[]     — IDs de los planes a cerrar
 *   - cycle_id?: string      — UUID opcional; se genera uno nuevo si no se provee
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { serviceMutate, serviceQuery } from '@/lib/db'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const { plan_ids, cycle_id: providedCycleId } = body

    if (!Array.isArray(plan_ids) || plan_ids.length === 0) {
      return NextResponse.json(
        { error: 'Debés proveer al menos un ID de plan para cerrar el ciclo.' },
        { status: 400 }
      )
    }

    const cycleId = providedCycleId || randomUUID()

    // Verificar que todos los planes pertenecen a la organización del usuario
    const owned = await serviceQuery(
      `SELECT gp.id
       FROM grazing_plans gp
       JOIN paddocks p ON p.id = gp.paddock_id
       WHERE gp.id = ANY($1::uuid[])
         AND p.org_id = $2`,
      [plan_ids, auth.orgId]
    )

    if (owned.length !== plan_ids.length) {
      return NextResponse.json(
        { error: 'Uno o más planes no pertenecen a tu organización.' },
        { status: 403 }
      )
    }

    // Asignar cycle_id y marcar como HISTORY
    await serviceMutate(
      `UPDATE grazing_plans
       SET
         cycle_id   = $1::uuid,
         status     = 'HISTORY',
         updated_at = NOW()
       WHERE id = ANY($2::uuid[])`,
      [cycleId, plan_ids]
    )

    return NextResponse.json({
      cycle_id: cycleId,
      closed: plan_ids.length,
      message: `Ciclo cerrado: ${plan_ids.length} planificaciones archivadas para benchmarking.`,
    })
  } catch (err: any) {
    console.error('POST /api/grazing-plans/close-cycle error:', err)
    return NextResponse.json({ error: 'Error del servidor: ' + err.message }, { status: 500 })
  }
}

/**
 * GET /api/grazing-plans/close-cycle
 * Retorna el resumen de benchmarking de ciclos cerrados:
 * compara el track 'manual' vs 'suggested' por cycle_id.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const benchmarks = await serviceQuery(
      `SELECT
         gp.cycle_id,
         gp.plan_type,
         gp.source_origin,
         TO_CHAR(gp.entry_date, 'YYYY-MM-DD')       AS entry_date,
         TO_CHAR(gp.exit_date,  'YYYY-MM-DD')        AS exit_date,
         TO_CHAR(gp.actual_entry_date, 'YYYY-MM-DD') AS actual_entry_date,
         TO_CHAR(gp.actual_exit_date,  'YYYY-MM-DD') AS actual_exit_date,
         gp.exit_dry_matter_kg_ha,
         gp.closing_stock,
         gp.planned_recovery_days,
         p.name  AS paddock_name,
         p.area_ha,
         h.name  AS herd_name,
         h.head_count
       FROM grazing_plans gp
       JOIN paddocks p ON p.id = gp.paddock_id
       LEFT JOIN herds h ON h.id = gp.herd_id
       WHERE p.org_id = $1
         AND gp.status   = 'HISTORY'
         AND gp.cycle_id IS NOT NULL
       ORDER BY gp.cycle_id, gp.plan_type, gp.entry_date`,
      [auth.orgId]
    )

    // Agrupar por cycle_id para facilitar el benchmarking en el frontend
    const grouped: Record<string, { manual: any[]; suggested: any[] }> = {}
    for (const row of benchmarks as any[]) {
      const cid = String(row.cycle_id)
      if (!grouped[cid]) grouped[cid] = { manual: [], suggested: [] }
      if (String(row.plan_type) === 'suggested') {
        grouped[cid].suggested.push(row)
      } else {
        grouped[cid].manual.push(row)
      }
    }

    return NextResponse.json({ cycles: grouped })
  } catch (err: any) {
    console.error('GET /api/grazing-plans/close-cycle error:', err)
    return NextResponse.json({ error: 'Error del servidor: ' + err.message }, { status: 500 })
  }
}
