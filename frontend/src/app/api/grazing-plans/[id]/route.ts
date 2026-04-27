/**
 * PATCH  /api/grazing-plans/[id]  — Actualiza un plan de pastoreo
 * DELETE /api/grazing-plans/[id]  — Elimina un plan de pastoreo
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { mutate } from '@/lib/db'


export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()

    const sets: string[] = ['updated_at = NOW()']
    const vals: any[] = []
    let i = 1

    const jsonFields = new Set(['herd_ids', 'temporary_animals', 'ai_analysis'])

    const validFields = [
      'paddock_id', 'herd_id', 'herd_ids', 'entry_date', 'exit_date',
      'actual_entry_date', 'actual_exit_date',
      'planned_recovery_days', 'status', 'temporary_animals', 'notes',
      'exit_notes', 'exit_dry_matter_kg_ha', 'ai_analysis'
    ]

    for (const field of validFields) {
      if (body[field] !== undefined) {
        const val = jsonFields.has(field) ? JSON.stringify(body[field]) : body[field]
        sets.push(`${field} = $${i++}`)
        vals.push(val)
      }
    }

    // Validate via paddock's org_id
    vals.push((await params).id, auth.orgId)
    await mutate(
      `UPDATE grazing_plans SET ${sets.join(', ')}
       WHERE id = $${i++}
         AND paddock_id IN (SELECT id FROM paddocks WHERE org_id = $${i})`,
      vals
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('PATCH /api/grazing-plans/[id] error:', err)
    return NextResponse.json({ error: 'Error del servidor: ' + err.message }, { status: 500 })
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
      `DELETE FROM grazing_plans
       WHERE id = $1
         AND paddock_id IN (SELECT id FROM paddocks WHERE org_id = $2)`,
      [(await params).id, auth.orgId]
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('DELETE /api/grazing-plans/[id] error:', err)
    return NextResponse.json({ error: err.message || 'Error del servidor' }, { status: 500 })
  }
}
