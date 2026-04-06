/**
 * POST /api/auth/ensure-profile
 * Para el flujo de invitación: sólo crea el perfil base (sin org, sin OWNER).
 * La organización y el rol se asignan luego en /api/invitations/accept.
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

    const { email } = await req.json()

    // If profile already exists, nothing to do
    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM profiles WHERE firebase_uid = $1',
      [decoded.uid]
    )
    if (existing) return NextResponse.json({ ok: true, existing: true })

    // Create a minimal profile — NO organization, NO owner role.
    // The invitation accept flow will assign org + team_role + permissions.
    await mutate(
      `INSERT INTO profiles
         (firebase_uid, email, onboarding_step, created_at, updated_at)
       VALUES ($1, $2, -1, NOW(), NOW())
       ON CONFLICT (firebase_uid) DO NOTHING`,
      [decoded.uid, email || decoded.email || '']
    )

    return NextResponse.json({ ok: true, existing: false })
  } catch (err: any) {
    console.error('POST /api/auth/ensure-profile error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
