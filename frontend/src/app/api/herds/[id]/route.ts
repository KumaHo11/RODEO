/**
 * PATCH  /api/herds/[id]  — Actualiza un rodeo
 * DELETE /api/herds/[id]  — Elimina un rodeo
 *
 * PATCH strategy: always update core fields first (guaranteed columns),
 * then attempt to update optional new columns in a separate query that
 * silently fails if those columns don't exist yet.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { serviceQueryOne, serviceMutate } from '@/lib/db'
import { checkHerdUpdateImpact } from '@/lib/syncService'

async function getOrgId(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim() || ''
  if (!token) return null
  const decoded = await verifyFirebaseToken(token)
  if (!decoded) return null
  const profile = await serviceQueryOne<{ organization_id: string }>(
    'SELECT organization_id FROM profiles WHERE firebase_uid = $1',
    [decoded.uid]
  )
  if (!profile?.organization_id) return null
  return { orgId: profile.organization_id, uid: decoded.uid }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getOrgId(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body  = await req.json()
    const herdId = (await params).id

    // ── Step 1: Update guaranteed core columns ───────────────────────────────
    const CORE: Record<string, string> = {
      name: 'name', species: 'species', breed: 'breed',
      head_count: 'head_count', avg_weight_kg: 'avg_weight_kg',
      total_ev: 'total_ev', categoria: 'categoria',
    }

    const sets: string[] = ['updated_at = NOW()']
    const vals: any[]   = []
    let idx = 1

    for (const [key, col] of Object.entries(CORE)) {
      if (body[key] !== undefined) {
        sets.push(`${col} = $${idx++}`)
        vals.push(body[key] ?? null)
      }
    }

    if (sets.length > 1) {
      // At least one core field is being updated
      vals.push(herdId, auth.orgId)
      await serviceMutate(
        `UPDATE herds SET ${sets.join(', ')} WHERE id = $${idx} AND org_id = $${idx + 1}`,
        vals
      )
    }

    // ── Step 2: Update optional new columns (silently skip if not migrated) ──
    const OPTIONAL: Record<string, string> = {
      age_years: 'age_years', age_months: 'age_months',
      admission_date: 'admission_date', exit_date: 'exit_date',
      bcs_score: 'bcs_score', bcs_label: 'bcs_label',
      bcs_data: 'bcs_data', photo_url: 'photo_url',
      parent_herd_id: 'parent_herd_id', herd_notes: 'herd_notes',
      // v8: Physiological fields
      physiological_category: 'physiological_category',
      last_weigh_date: 'last_weigh_date',
      daily_gain_kg: 'daily_gain_kg',
      // v9: EV Matrix fields
      lactancia_range: 'lactancia_range',
      estadio_gestacion: 'estadio_gestacion',
      custom_racion_kg: 'custom_racion_kg',
      // v10: Lote de Manejo fields
      grupo_manejo_id: 'grupo_manejo_id',
      grupo_manejo_nombre: 'grupo_manejo_nombre',
    }

    const optSets: string[] = []
    const optVals: any[]   = []
    let optIdx = 1

    for (const [key, col] of Object.entries(OPTIONAL)) {
      if (body[key] !== undefined) {
        const val = (key === 'bcs_data' || key === 'herd_notes') ? JSON.stringify(body[key]) : body[key]
        optSets.push(`${col} = $${optIdx++}`)
        optVals.push(val ?? null)
      }
    }

    if (optSets.length > 0) {
      optVals.push(herdId, auth.orgId)
      try {
        await serviceMutate(
          `UPDATE herds SET ${optSets.join(', ')}, updated_at = NOW()
           WHERE id = $${optIdx} AND org_id = $${optIdx + 1}`,
          optVals
        )
      } catch (optErr: any) {
        // Columns not yet migrated — non-critical
        console.warn('PATCH /api/herds optional columns skipped:', optErr.message)
      }
    }

    // Comprobar impacto en planes si se alteró el EV o la cantidad de cabezas
    let impactsPlans = false
    if (body.total_ev !== undefined || body.head_count !== undefined) {
      const newEv = body.total_ev || 0 // (En la realidad deberíamos buscar el nuevo EV en la base de datos)
      impactsPlans = await checkHerdUpdateImpact(auth.orgId, herdId, newEv)
    }

    return NextResponse.json({ success: true, impactsPlans })
  } catch (err: any) {
    console.error('PATCH /api/herds/[id] error:', err)
    return NextResponse.json({ error: 'Error interno del servidor', detail: err?.message }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getOrgId(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    await serviceMutate(
      'DELETE FROM herds WHERE id = $1 AND org_id = $2',
      [(await params).id, auth.orgId]
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('DELETE /api/herds/[id] error:', err)
    return NextResponse.json({ error: err.message || 'Error del servidor' }, { status: 500 })
  }
}
