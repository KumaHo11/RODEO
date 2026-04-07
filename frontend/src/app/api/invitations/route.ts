/**
 * GET  /api/invitations?token=xxx  — Busca una invitación por token
 * POST /api/invitations             — Crea una nueva invitación
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { queryOne, mutate } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import crypto from 'crypto'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 400 })

  try {
    const invitation = await queryOne<any>(
      `SELECT ti.*, o.name as org_name
       FROM team_invitations ti
       LEFT JOIN organizations o ON o.id = ti.org_id
       WHERE ti.token = $1 AND ti.status = 'PENDING'`,
      [token]
    )

    if (!invitation) {
      return NextResponse.json({ error: 'Invitación no válida o ya utilizada.' }, { status: 404 })
    }

    return NextResponse.json({ invitation })
  } catch (err) {
    console.error('GET /api/invitations error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const firebaseToken = authHeader.replace('Bearer ', '').trim()
    if (!firebaseToken) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const decoded = await verifyFirebaseToken(firebaseToken)
    if (!decoded) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const profile = await queryOne<{ organization_id: string; id: string }>(
      'SELECT organization_id, id FROM profiles WHERE firebase_uid = $1',
      [decoded.uid]
    )
    if (!profile?.organization_id) {
      return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 })
    }

    const body = await req.json()
    const { email, role = 'OPERATOR', team_role = 'CAPATAZ', permissions = {}, first_name, last_name } = body

    if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 })

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const result = await mutate(
      `INSERT INTO team_invitations
         (org_id, email, role, team_role, permissions, token, status, expires_at, invited_by, first_name, last_name)
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7, $8, $9, $10)
       ON CONFLICT (org_id, email) DO UPDATE SET
         token = EXCLUDED.token,
         role = EXCLUDED.role,
         team_role = EXCLUDED.team_role,
         permissions = EXCLUDED.permissions,
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         status = 'PENDING',
         expires_at = EXCLUDED.expires_at,
         updated_at = NOW()
       RETURNING id, token`,
      [profile.organization_id, email.toLowerCase(), role, team_role, JSON.stringify(permissions), token, expiresAt, profile.id, first_name || null, last_name || null]
    )

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const inviteLink = `${appUrl}/join?token=${token}`

    // Send invitation email via SendGrid
    try {
      const org = await queryOne<{ name: string }>(
        'SELECT name FROM organizations WHERE id = $1', [profile.organization_id]
      )
      const inviter = await queryOne<{ first_name: string; last_name: string; email: string }>(
        'SELECT first_name, last_name, email FROM profiles WHERE id = $1', [profile.id]
      )
      const inviterName = inviter
        ? [inviter.first_name, inviter.last_name].filter(Boolean).join(' ') || inviter.email
        : 'El equipo RODEO'
      const orgName = org?.name || 'Tu campo'

      const roleLabels: Record<string, string> = {
        ADMIN: 'Administrador', CAPATAZ: 'Capataz',
        VETERINARIO: 'Veterinario', AYUDANTE: 'Ayudante', OPERATOR: 'Operador',
      }

      await sendEmail('team_invitation', email.toLowerCase(), {
        inviterName,
        orgName,
        roleLabel: roleLabels[team_role] || team_role,
        inviteLink,
      })
    } catch (emailErr: any) {
      console.warn('[Invitation email failed]', emailErr.message)
      // Don't block invitation creation if email fails
    }

    return NextResponse.json({ id: result.rows[0]?.id, token, inviteLink }, { status: 201 })
  } catch (err: any) {
    console.error('POST /api/invitations error:', err)
    return NextResponse.json({ error: 'Error del servidor: ' + err.message }, { status: 500 })
  }
}
