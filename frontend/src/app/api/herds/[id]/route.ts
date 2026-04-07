/**
 * PATCH  /api/herds/[id]  — Actualiza un rebaño
 * DELETE /api/herds/[id]  — Elimina un rebaño
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getOrgId(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()

    const allowedFields: Record<string, string> = {
      name: 'name', species: 'species', breed: 'breed',
      head_count: 'head_count', avg_weight_kg: 'avg_weight_kg',
      age_years: 'age_years', total_ev: 'total_ev',
      bcs_score: 'bcs_score', bcs_label: 'bcs_label',
      bcs_data: 'bcs_data', photo_url: 'photo_url',
      categoria: 'categoria',
    }

    const sets: string[] = ['updated_at = NOW()']
    const vals: any[] = []
    let i = 1

    for (const [key, col] of Object.entries(allowedFields)) {
      if (body[key] !== undefined) {
        const val = key === 'bcs_data' ? JSON.stringify(body[key]) : body[key]
        sets.push(`${col} = $${i++}`)
        vals.push(val)
      }
    }

    // Validate ownership via org_id join
    vals.push((await params).id, auth.orgId)
    await mutate(
      `UPDATE herds SET ${sets.join(', ')} WHERE id = $${i++} AND org_id = $${i}`,
      vals
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('PATCH /api/herds/[id] error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
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
      'DELETE FROM herds WHERE id = $1 AND org_id = $2',
      [(await params).id, auth.orgId]
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('DELETE /api/herds/[id] error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
