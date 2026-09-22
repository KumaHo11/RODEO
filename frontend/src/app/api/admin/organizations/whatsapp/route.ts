/**
 * GET  /api/admin/organizations/whatsapp  — Lista todos los tenants con su estado WA
 * PATCH /api/admin/organizations/whatsapp  — Override del módulo WA para un tenant
 *
 * Solo accesible por SuperAdmin (role = SUPERADMIN).
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { serviceQueryOne, serviceQuery, serviceMutate } from '@/lib/db'

async function requireSuperAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim() || ''
  if (!token) return null
  const decoded = await verifyFirebaseToken(token)
  if (!decoded) return null
  const profile = await serviceQueryOne<{ role: string }>(
    'SELECT role FROM profiles WHERE firebase_uid = $1',
    [decoded.uid]
  )
  if (profile?.role !== 'SUPERADMIN') return null
  return decoded
}

// ── GET: lista de orgs con su override de WA ────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin(req)
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const orgs = await serviceQuery<{
    id: string
    name: string
    plan_slug: string | null
    whatsapp_enabled: boolean | null
  }>(
    `SELECT o.id, o.name, p.slug AS plan_slug, o.whatsapp_enabled
     FROM organizations o
     LEFT JOIN plans p ON p.id = o.plan_id
     ORDER BY o.name ASC`,
    []
  )

  return NextResponse.json({ orgs })
}

// ── PATCH: actualizar override de WA para un tenant ─────────────────────────
export async function PATCH(req: NextRequest) {
  const auth = await requireSuperAdmin(req)
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json()
  const { org_id, whatsapp_enabled } = body

  if (!org_id) {
    return NextResponse.json({ error: 'org_id requerido' }, { status: 400 })
  }

  // whatsapp_enabled puede ser true, false, o null (hereda del plan)
  if (whatsapp_enabled !== null && typeof whatsapp_enabled !== 'boolean') {
    return NextResponse.json({ error: 'whatsapp_enabled debe ser true, false o null' }, { status: 400 })
  }

  await serviceMutate(
    'UPDATE organizations SET whatsapp_enabled = $1, updated_at = NOW() WHERE id = $2',
    [whatsapp_enabled, org_id]
  )

  return NextResponse.json({ success: true })
}
