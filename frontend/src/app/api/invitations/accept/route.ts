/**
 * POST /api/invitations/accept
 * Acepta una invitación de equipo y actualiza el perfil del usuario.
 * También notifica al Owner que el invitado aceptó.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { queryOne, mutate } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const decoded = await verifyFirebaseToken(token)
    if (!decoded) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    const firebaseUid = decoded.uid

    const { token: invToken } = await req.json()
    if (!invToken) return NextResponse.json({ error: 'Token requerido' }, { status: 400 })

    // Verificar invitación
    const invitation = await queryOne<any>(
      `SELECT ti.*, o.name AS org_name
       FROM team_invitations ti
       LEFT JOIN organizations o ON o.id = ti.org_id
       WHERE ti.token = $1 AND ti.status = 'PENDING'`,
      [invToken]
    )
    if (!invitation) return NextResponse.json({ error: 'Invitación no válida.' }, { status: 404 })
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: 'La invitación expiró.' }, { status: 410 })
    }

    // Normalize permissions
    const rawPerms = invitation.permissions
    const permsObj = typeof rawPerms === 'string' ? JSON.parse(rawPerms) : (rawPerms ?? {})

    // Actualizar perfil del usuario invitado
    await mutate(
      `UPDATE profiles SET
         organization_id = $1,
         team_role       = $2,
         permissions     = $3::jsonb,
         onboarding_step = -1,
         is_first_login  = true,
         first_name      = COALESCE(NULLIF(first_name, ''), $5),
         last_name       = COALESCE(NULLIF(last_name, ''), $6),
         updated_at      = NOW()
       WHERE firebase_uid = $4`,
      [invitation.org_id, invitation.team_role, JSON.stringify(permsObj), firebaseUid,
       invitation.first_name || null, invitation.last_name || null]
    )

    // Marcar invitación como aceptada
    await mutate(
      `UPDATE team_invitations SET status = 'ACCEPTED', updated_at = NOW() WHERE id = $1`,
      [invitation.id]
    )

    // Perfil del nuevo miembro (para el nombre en la notificación)
    const newMemberProfile = await queryOne<any>(
      `SELECT id, email, first_name, last_name FROM profiles WHERE firebase_uid = $1`,
      [firebaseUid]
    )

    if (newMemberProfile) {
      const memberName = [newMemberProfile.first_name, newMemberProfile.last_name]
        .filter(Boolean).join(' ') || newMemberProfile.email || 'Un nuevo miembro'

      // ── 1. Notificación de bienvenida para el nuevo miembro ────────────────
      await mutate(
        `INSERT INTO notifications (org_id, profile_id, user_id, type, title, message, body, entity_type)
         VALUES ($1, $2, $2, 'INVITACION', $3, $4, $4, 'invitation')`,
        [
          invitation.org_id,
          newMemberProfile.id,
          '¡Bienvenido al equipo de RODEO!',
          `Tu rol es ${invitation.team_role}. Ya podés empezar a gestionar ${invitation.org_name || 'el campo'}.`,
        ]
      )

      // ── 2. Notificación al Owner ───────────────────────────────────────────
      const owner = await queryOne<any>(
        `SELECT id FROM profiles WHERE organization_id = $1 AND role = 'OWNER' LIMIT 1`,
        [invitation.org_id]
      )
      if (owner) {
        await mutate(
          `INSERT INTO notifications (org_id, profile_id, user_id, type, title, message, body, entity_type)
           VALUES ($1, $2, $2, 'INVITACION', $3, $4, $4, 'invitation')`,
          [
            invitation.org_id,
            owner.id,
            `Se sumó a tu equipo ${memberName}`,
            `Se sumó a tu equipo ${memberName}, como ${invitation.team_role} al campo ${invitation.org_name || 'tu campo'}.`,
          ]
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('POST /api/invitations/accept error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
