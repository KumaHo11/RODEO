/**
 * GET    /api/season-plans/[id]  — Obtiene un plan por ID
 * PATCH  /api/season-plans/[id]  — Actualiza un plan (cerrar, calcular métricas, etc.)
 * DELETE /api/season-plans/[id]  — Elimina un plan con cascade explícito
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { serviceQueryOne, serviceMutate } from '@/lib/db'

async function getAuth(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim() || ''
  if (!token) return null
  const decoded = await verifyFirebaseToken(token)
  if (!decoded) return null
  const profile = await serviceQueryOne<{ organization_id: string }>(
    'SELECT organization_id FROM profiles WHERE firebase_uid = $1',
    [decoded.uid]
  )
  if (!profile?.organization_id) return null
  return { orgId: profile.organization_id }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await getAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const plan = await serviceQueryOne<Record<string, unknown>>(
      `SELECT * FROM season_plans WHERE id = $1 AND org_id = $2`,
      [id, auth.orgId]
    )

    if (!plan) {
      return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ season_plan: plan })
  } catch (err: any) {
    console.error('GET /api/season-plans/[id] error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await getAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const {
      name, season_type, year, start_date, end_date,
      no_growth_from, no_growth_to,
      drought_reserve_days, daily_allocation_kg,
      cell_name, total_ha, status,
      demand_snapshot, supply_snapshot, metrics, notes,
      herd_ids, cell_paddock_ids, target_remnant_kg_ha, recovery_days,
    } = body

    await serviceMutate(
      `UPDATE season_plans SET
        name                 = COALESCE($1, name),
        season_type          = COALESCE($2, season_type),
        year                 = COALESCE($3, year),
        start_date           = COALESCE($4, start_date),
        end_date             = COALESCE($5, end_date),
        no_growth_from       = COALESCE($6, no_growth_from),
        no_growth_to         = COALESCE($7, no_growth_to),
        drought_reserve_days = COALESCE($8, drought_reserve_days),
        daily_allocation_kg  = COALESCE($9, daily_allocation_kg),
        cell_name            = COALESCE($10, cell_name),
        total_ha             = COALESCE($11, total_ha),
        status               = COALESCE($12, status),
        demand_snapshot      = COALESCE($13, demand_snapshot),
        supply_snapshot      = COALESCE($14, supply_snapshot),
        metrics              = COALESCE($15, metrics),
        notes                = COALESCE($16, notes),
        herd_ids             = COALESCE($17, herd_ids),
        cell_paddock_ids     = COALESCE($18, cell_paddock_ids),
        target_remnant_kg_ha = COALESCE($19, target_remnant_kg_ha),
        recovery_days        = COALESCE($20, recovery_days),
        updated_at           = now()
      WHERE id = $21 AND org_id = $22`,
      [
        name || null, season_type || null, year || null,
        start_date || null, end_date || null,
        no_growth_from || null, no_growth_to || null,
        drought_reserve_days ?? null, daily_allocation_kg ?? null,
        cell_name || null, total_ha || null, status || null,
        demand_snapshot ? JSON.stringify(demand_snapshot) : null,
        supply_snapshot ? JSON.stringify(supply_snapshot) : null,
        metrics ? JSON.stringify(metrics) : null,
        notes || null,
        herd_ids ? JSON.stringify(herd_ids) : null,
        cell_paddock_ids ? JSON.stringify(cell_paddock_ids) : null,
        target_remnant_kg_ha ?? null,
        recovery_days ? JSON.stringify(recovery_days) : null,
        id, auth.orgId,
      ]
    )

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('PATCH /api/season-plans/[id] error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}


export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await getAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    // 1. Verificar que el plan existe y pertenece al org antes de borrar
    const existing = await serviceQueryOne<{ id: string }>(
      `SELECT id FROM season_plans WHERE id = $1 AND org_id = $2`,
      [id, auth.orgId]
    )
    if (!existing) {
      return NextResponse.json(
        { error: 'Plan no encontrado o no tenés permiso para eliminarlo.' },
        { status: 404 }
      )
    }

    // 2. Cascade explícito: borrar grazing_plans asociados.
    //    Necesario si el FK grazing_plans.season_plan_id no tiene ON DELETE CASCADE configurado.
    //    Si ya existe el CASCADE en el schema, esta operación es un no-op seguro.
    await serviceMutate(
      `DELETE FROM grazing_plans WHERE season_plan_id = $1`,
      [id]
    )

    // 3. Borrar el season_plan padre
    await serviceMutate(
      `DELETE FROM season_plans WHERE id = $1 AND org_id = $2`,
      [id, auth.orgId]
    )

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('DELETE /api/season-plans/[id] error:', err)
    // Clasificar errores de FK como 409 Conflict, no 500
    if (err.code === '23503') {
      return NextResponse.json(
        { error: 'No se puede eliminar: el plan tiene registros vinculados en otras tablas.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
