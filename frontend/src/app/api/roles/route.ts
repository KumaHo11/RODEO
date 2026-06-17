/**
 * GET    /api/roles  — Lista roles custom de la organización
 * POST   /api/roles  — Crea un rol custom
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { serviceQueryOne, serviceQuery, serviceMutate } from '@/lib/db'

async function getAuth(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim() || ''
  if (!token) return null
  const decoded = await verifyFirebaseToken(token)
  if (!decoded) return null
  return serviceQueryOne<{ id: string; organization_id: string; role: string }>(
    'SELECT id, organization_id, role FROM profiles WHERE firebase_uid = $1',
    [decoded.uid]
  )
}

export async function GET(req: NextRequest) {
  try {
    const profile = await getAuth(req)
    if (!profile?.organization_id) return NextResponse.json({ roles: [] })

    const roles = await serviceQuery(
      `SELECT id, name, label, description, permissions, created_at
       FROM custom_roles
       WHERE org_id = $1
       ORDER BY label ASC`,
      [profile.organization_id]
    )

    return NextResponse.json({ roles })
  } catch (err: any) {
    console.error('GET /api/roles error:', err)
    return NextResponse.json({ roles: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    const profile = await getAuth(req)
    if (!profile?.organization_id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    if (profile.role !== 'OWNER') return NextResponse.json({ error: 'Solo el propietario puede crear roles' }, { status: 403 })

    const { label, description, permissions } = await req.json()
    if (!label?.trim()) return NextResponse.json({ error: 'El nombre del rol es requerido' }, { status: 400 })

    // Generate a safe name from label
    const name = label.trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '')

    const result = await serviceMutate(
      `INSERT INTO custom_roles (org_id, name, label, description, permissions, created_by)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       ON CONFLICT (org_id, name) DO UPDATE SET
         label = EXCLUDED.label,
         description = EXCLUDED.description,
         permissions = EXCLUDED.permissions,
         updated_at = NOW()
       RETURNING id, name, label, description, permissions`,
      [
        profile.organization_id,
        name,
        label.trim(),
        description || null,
        JSON.stringify(permissions || {}),
        profile.id,
      ]
    )

    return NextResponse.json({ role: result.rows[0] }, { status: 201 })
  } catch (err: any) {
    console.error('POST /api/roles error:', err)
    return NextResponse.json({ error: 'Error del servidor: ' + err.message }, { status: 500 })
  }
}
