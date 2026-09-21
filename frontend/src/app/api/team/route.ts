/**
 * GET    /api/team  — Miembros e invitaciones de la organización
 * DELETE /api/team  — Elimina a un miembro del equipo
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { serviceQueryOne, serviceQuery, serviceMutate } from '@/lib/db'

async function getOrgId(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim() || ''
  if (!token) return null
  const decoded = await verifyFirebaseToken(token)
  if (!decoded) return null
  const profile = await serviceQueryOne<{ organization_id: string; id: string }>(
    'SELECT organization_id, id FROM profiles WHERE firebase_uid = $1',
    [decoded.uid]
  )
  if (!profile?.organization_id) return null
  return { orgId: profile.organization_id, uid: decoded.uid, profileId: profile.id }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getOrgId(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const members = await serviceQuery(
      `SELECT id, firebase_uid, email, first_name, last_name,
              role, team_role, permissions, avatar_url, is_active, created_at
       FROM profiles
       WHERE organization_id = $1
       ORDER BY created_at ASC`,
      [auth.orgId]
    )

    // Invitaciones por email (team_invitations)
    let emailInvitations: any[] = []
    try {
      emailInvitations = await serviceQuery(
        `SELECT ti.id, ti.email, ti.role, ti.team_role, ti.permissions,
                ti.status, ti.token, ti.expires_at, ti.created_at, ti.invited_by,
                p.first_name AS inviter_first_name, p.last_name AS inviter_last_name,
                'email' AS channel
         FROM team_invitations ti
         LEFT JOIN profiles p ON p.id = ti.invited_by
         WHERE ti.org_id = $1
         ORDER BY ti.created_at DESC`,
        [auth.orgId]
      )
    } catch (invErr: any) {
      console.warn('[GET /api/team] team_invitations query failed:', invErr.message)
    }

    // Invitaciones por WhatsApp pendientes (whatsapp_links con is_active=false)
    // CORRECCIÓN: el campo era `linked_at` (no existe) → corregido a `created_at`
    let waInvitations: any[] = []
    try {
      waInvitations = await serviceQuery(
        `SELECT id,
                phone,
                operator_name  AS email,
                operator_name,
                role           AS team_role,
                'PENDING'      AS status,
                token_expires_at AS expires_at,
                created_at,
                activation_token AS token,
                'whatsapp'     AS channel
         FROM whatsapp_links
         WHERE org_id = $1
           AND is_active = false
           AND activation_token IS NOT NULL
         ORDER BY created_at DESC`,
        [auth.orgId]
      )
    } catch (waErr: any) {
      // Log completo del error SQL para diagnóstico — ya no es silencioso
      console.error('[GET /api/team] whatsapp_links query FAILED:', waErr.message, waErr.code)
    }

    // Unir ambas listas: primero email, luego WA
    const invitations = [...emailInvitations, ...waInvitations]

    return NextResponse.json({ members, invitations })

  } catch (err: any) {
    console.error('GET /api/team error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await getOrgId(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { memberId } = await req.json()
    if (!memberId) return NextResponse.json({ error: 'memberId requerido' }, { status: 400 })

    await serviceMutate(
      `UPDATE profiles SET organization_id = NULL, role = NULL, team_role = NULL
       WHERE id = $1 AND organization_id = $2`,
      [memberId, auth.orgId]
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('DELETE /api/team error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
