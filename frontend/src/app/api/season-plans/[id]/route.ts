/**
 * PATCH /api/season-plans/[id]  — Actualiza un plan (cerrar, calcular métricas, etc.)
 * DELETE /api/season-plans/[id] — Elimina un plan (solo borradores)
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { queryOne, mutate } from '@/lib/db'

async function getAuth(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim() || ''
  if (!token) return null
  const decoded = await verifyFirebaseToken(token)
  if (!decoded) return null
  const profile = await queryOne<{ organization_id: string }>(
    'SELECT organization_id FROM profiles WHERE firebase_uid = $1',
    [decoded.uid]
  )
  if (!profile?.organization_id) return null
  return { orgId: profile.organization_id }
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
    } = body

    await mutate(
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
        updated_at           = now()
      WHERE id = $17 AND org_id = $18`,
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
        id, auth.orgId,
      ]
    )

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('PATCH /api/season-plans/[id] error:', err)
    require('fs').appendFileSync('/tmp/rodeo_api_error.log', new Date().toISOString() + ' PATCH ' + err.message + '\n' + err.stack + '\n')
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

    // Only allow deletion of drafts or excel_import files to preserve historical integrity for manual active plans
    const result = await mutate(
      `DELETE FROM season_plans
       WHERE id = $1 AND org_id = $2 AND (status = 'draft' OR source = 'excel_import')`,
      [id, auth.orgId]
    )

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Solo se pueden eliminar archivos de Excel importados o planes en borrador. Los planes manuales cerrados no se pueden borrar.' },
        { status: 400 }
      )
    }
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('DELETE /api/season-plans/[id] error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
