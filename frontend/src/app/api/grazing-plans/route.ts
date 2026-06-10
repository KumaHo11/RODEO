/**
 * GET  /api/grazing-plans  — Lista de planes de pastoreo de la organización
 * POST /api/grazing-plans  — Crea un nuevo plan de pastoreo
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { query, mutate } from '@/lib/db'
import { syncGrazingPlanToAgenda } from '@/lib/syncService'

export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const plans = await query(
      `SELECT
         gp.id, gp.org_id, gp.paddock_id, gp.herd_id, gp.herd_ids,
         TO_CHAR(gp.entry_date, 'YYYY-MM-DD') AS entry_date,
         TO_CHAR(gp.exit_date,  'YYYY-MM-DD') AS exit_date,
         TO_CHAR(gp.actual_entry_date, 'YYYY-MM-DD') AS actual_entry_date,
         TO_CHAR(gp.actual_exit_date,  'YYYY-MM-DD') AS actual_exit_date,
         TO_CHAR(gp.adjusted_entry_date, 'YYYY-MM-DD') AS adjusted_entry_date,
         TO_CHAR(gp.adjusted_exit_date,  'YYYY-MM-DD') AS adjusted_exit_date,
         gp.is_locked, gp.closing_stock,
         gp.planned_recovery_days, gp.status, gp.temporary_animals,
         gp.notes, gp.exit_notes, gp.exit_dry_matter_kg_ha,
         gp.ai_analysis, gp.created_at, gp.updated_at,
         -- Track paralelo: clasifica el bloque según su pista de origen
         COALESCE(gp.plan_type, 'manual') AS plan_type,
         COALESCE(gp.source_origin, 'human') AS source_origin,
         gp.cycle_id,
         json_build_object('id', p.id, 'name', p.name, 'area_ha', p.area_ha) AS paddocks,
         CASE WHEN h.id IS NOT NULL
           THEN json_build_object('id', h.id, 'name', h.name, 'head_count', h.head_count, 'total_ev', h.total_ev)
           ELSE NULL
         END AS herds
       FROM grazing_plans gp
       JOIN paddocks p ON p.id = gp.paddock_id
       LEFT JOIN herds h ON h.id = gp.herd_id
       WHERE p.org_id = $1
       ORDER BY gp.entry_date ASC`,

      [auth.orgId]
    )

    return NextResponse.json({ plans })
  } catch (err: any) {
    console.error('GET /api/grazing-plans error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const {
      paddock_id, herd_id, herd_ids, entry_date, exit_date,
      actual_entry_date, actual_exit_date,
      adjusted_entry_date, adjusted_exit_date, is_locked, closing_stock,
      planned_recovery_days, status, temporary_animals, notes,
      exit_notes, exit_dry_matter_kg_ha, org_id, ai_analysis,
      // Campos de track paralelo
      plan_type, source_origin, cycle_id
    } = body

    if (!paddock_id || !herd_id || !entry_date) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const result = await mutate(
      `INSERT INTO grazing_plans
         (paddock_id, herd_id, herd_ids, org_id, entry_date, exit_date,
          actual_entry_date, actual_exit_date,
          adjusted_entry_date, adjusted_exit_date, is_locked, closing_stock,
          planned_recovery_days, status, temporary_animals, notes,
          exit_notes, exit_dry_matter_kg_ha, ai_analysis,
          plan_type, source_origin, cycle_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       RETURNING id`,
      [
        paddock_id, herd_id,
        herd_ids ? JSON.stringify(herd_ids) : null,
        auth.orgId,
        entry_date, exit_date || null,
        actual_entry_date || null, actual_exit_date || null,
        adjusted_entry_date || null, adjusted_exit_date || null,
        is_locked || false, closing_stock ? JSON.stringify(closing_stock) : null,
        planned_recovery_days || 60,
        status || 'PLANNED',
        temporary_animals ? JSON.stringify(temporary_animals) : null,
        notes || null,
        exit_notes || null,
        exit_dry_matter_kg_ha || null,
        ai_analysis ? JSON.stringify(ai_analysis) : null,
        // Track paralelo — default 'manual'/'human' para creaciones manuales
        (plan_type === 'suggested' ? 'suggested' : 'manual'),
        (source_origin === 'algorithm' ? 'algorithm' : 'human'),
        cycle_id || null,
      ]
    )

    const newPlanId = result.rows[0]?.id

    if (newPlanId) {
      await syncGrazingPlanToAgenda(
        auth.orgId, 
        String(newPlanId), 
        paddock_id, 
        herd_id, 
        entry_date, 
        exit_date
      )
    }

    return NextResponse.json({ id: newPlanId }, { status: 201 })
  } catch (err: any) {
    console.error('POST /api/grazing-plans error:', err)
    return NextResponse.json({ error: 'Error del servidor: ' + err.message }, { status: 500 })
  }
}
