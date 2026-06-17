/**
 * GET  /api/admin/whatsapp-links          — Lista todos los vinculos del org
 * POST /api/admin/whatsapp-links          — Crea un vínculo teléfono → perfil
 * DELETE /api/admin/whatsapp-links?id=xx  — Elimina un vínculo
 *
 * Solo accesible para OWNER / SUPER_ADMIN.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { serviceQueryOne, serviceQuery, serviceMutate } from '@/lib/db'

async function getAuth(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim() || ''
  if (!token) return null
  const decoded = await verifyFirebaseToken(token)
  if (!decoded) return null
  return serviceQueryOne<{ organization_id: string; id: string; role: string; system_role: string }>(
    `SELECT organization_id, id, role, system_role
       FROM profiles WHERE firebase_uid = $1`,
    [decoded.uid]
  )
}

export async function GET(req: NextRequest) {
  const auth = await getAuth(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await serviceQuery(
    `SELECT wl.id, wl.phone, wl.created_at,
            p.first_name, p.last_name, p.email, p.role AS profile_role
       FROM whatsapp_links wl
       JOIN profiles p ON p.id = wl.profile_id
      WHERE wl.org_id = $1
      ORDER BY wl.created_at DESC`,
    [auth.organization_id]
  )
  return NextResponse.json({ links: rows })
}

export async function POST(req: NextRequest) {
  const auth = await getAuth(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'OWNER' && auth.system_role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { phone, profile_id } = await req.json()
  if (!phone || !profile_id) return NextResponse.json({ error: 'phone y profile_id son requeridos' }, { status: 400 })

  // Normalizar teléfono → E.164
  const normalized = phone.replace(/\s|-/g, '').replace(/^0/, '+54')

  const { rows } = await serviceMutate(
    `INSERT INTO whatsapp_links (phone, profile_id, org_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (phone) DO UPDATE SET profile_id = EXCLUDED.profile_id
     RETURNING *`,
    [normalized, profile_id, auth.organization_id]
  )
  return NextResponse.json({ link: rows[0] }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const auth = await getAuth(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'OWNER' && auth.system_role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  await serviceMutate(
    `DELETE FROM whatsapp_links WHERE id = $1 AND org_id = $2`,
    [id, auth.organization_id]
  )
  return NextResponse.json({ ok: true })
}
