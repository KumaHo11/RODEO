/**
 * PATCH  /api/team/[id]  — Actualiza is_active, permissions o team_role
 * DELETE /api/team/[id]  — Elimina un miembro del equipo
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { serviceQueryOne, serviceMutate } from '@/lib/db'

async function getOwnerOrgId(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim() || ''
  if (!token) return null
  const decoded = await verifyFirebaseToken(token)
  if (!decoded) return null
  const profile = await serviceQueryOne<{ organization_id: string; role: string }>(
    'SELECT organization_id, role FROM profiles WHERE firebase_uid = $1',
    [decoded.uid]
  )
  if (!profile?.organization_id) return null
  // Only OWNER can manage team
  if (profile.role !== 'OWNER') return null
  return { orgId: profile.organization_id, uid: decoded.uid }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const auth = await getOwnerOrgId(req)
    if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    // Verify member belongs to this org
    const member = await serviceQueryOne<{ id: string; organization_id: string; role: string }>(
      'SELECT id, organization_id, role FROM profiles WHERE id = $1',
      [id]
    )
    if (!member || member.organization_id !== auth.orgId) {
      return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    }
    // Cannot modify the Owner themselves
    if (member.role === 'OWNER') {
      return NextResponse.json({ error: 'No se puede modificar al propietario' }, { status: 403 })
    }

    const body = await req.json()
    const { is_active, permissions, team_role } = body

    // Build dynamic SET clause
    const setClauses: string[] = ['updated_at = NOW()']
    const vals: any[] = []
    let i = 1

    if (is_active !== undefined) {
      setClauses.push(`is_active = $${i++}`)
      vals.push(is_active)
    }
    if (permissions !== undefined) {
      setClauses.push(`permissions = $${i++}::jsonb`)
      vals.push(JSON.stringify(permissions))
    }
    if (team_role !== undefined) {
      setClauses.push(`team_role = $${i++}`)
      vals.push(team_role)
    }

    if (vals.length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
    }

    vals.push(id)
    await serviceMutate(
      `UPDATE profiles SET ${setClauses.join(', ')} WHERE id = $${i}`,
      vals
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('PATCH /api/team/[id] error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const auth = await getOwnerOrgId(req)
    if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const member = await serviceQueryOne<{ id: string; organization_id: string; role: string }>(
      'SELECT id, organization_id, role FROM profiles WHERE id = $1',
      [id]
    )
    if (!member || member.organization_id !== auth.orgId) {
      return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    }
    if (member.role === 'OWNER') {
      return NextResponse.json({ error: 'No se puede eliminar al propietario' }, { status: 403 })
    }

    await serviceMutate(
      `UPDATE profiles
       SET organization_id = NULL, team_role = NULL, permissions = NULL,
           onboarding_step = 0, updated_at = NOW()
       WHERE id = $1`,
      [id]
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('DELETE /api/team/[id] error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
