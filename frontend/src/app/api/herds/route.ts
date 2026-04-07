/**
 * GET  /api/herds  — Lista de rebaños de la organización
 * POST /api/herds  — Crea un nuevo rebaño
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { queryOne, query, mutate } from '@/lib/db'

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

export async function GET(req: NextRequest) {
  try {
    const auth = await getOrgId(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const herds = await query(
      `SELECT id, org_id, name, species, breed, categoria, head_count,
              avg_weight_kg, total_ev, age_years, bcs_score, bcs_label,
              bcs_data, photo_url, created_at, updated_at
       FROM herds
       WHERE org_id = $1
       ORDER BY created_at DESC`,
      [auth.orgId]
    )

    return NextResponse.json({ herds })
  } catch (err: any) {
    console.error('GET /api/herds error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getOrgId(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const {
      name, species, breed, head_count, avg_weight_kg,
      age_years, total_ev, bcs_score, bcs_label, bcs_data, photo_url, categoria
    } = body

    if (!name || !head_count) {
      return NextResponse.json({ error: 'Nombre y cantidad requeridos' }, { status: 400 })
    }

    const result = await mutate(
      `INSERT INTO herds
         (org_id, name, species, breed, head_count, avg_weight_kg, age_years, total_ev,
          bcs_score, bcs_label, bcs_data, photo_url, categoria)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id`,
      [
        auth.orgId, name, species || 'vacas', breed || null,
        head_count, avg_weight_kg || null, age_years || null,
        total_ev || null, bcs_score || null, bcs_label || null,
        bcs_data ? JSON.stringify(bcs_data) : null, photo_url || null,
        categoria || null
      ]
    )

    const id = result.rows[0]?.id
    return NextResponse.json({ id }, { status: 201 })
  } catch (err: any) {
    console.error('POST /api/herds error:', err)
    return NextResponse.json({ error: 'Error del servidor: ' + err.message }, { status: 500 })
  }
}
