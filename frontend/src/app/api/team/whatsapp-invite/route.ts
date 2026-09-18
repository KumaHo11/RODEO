/**
 * POST /api/team/whatsapp-invite
 *  Genera un token criptográfico de invitación y un link wa.me para vincular
 *  un operario al campo vía WhatsApp.
 *
 *  Flujo Zero-Friction (todos los campos son opcionales):
 *  - Sin teléfono → el admin comparte el link; el número se registra cuando
 *    el operario lo activa (auto-provisioning de Profile).
 *  - Con teléfono → pre-registro con número conocido; el admin puede abrir
 *    WhatsApp directamente con el texto preformateado.
 *
 *  El operario toca el link → wa.me abre el chat con RODEO BOT → envía el
 *  mensaje preformateado → webhook detecta TOKEN_{hex} → activa el vínculo.
 *
 * GET  /api/team/whatsapp-invite?profileId=xxx  — Estado del vínculo.
 * GET  /api/team/whatsapp-invite?orgId=xxx      — Lista invitaciones pendientes.
 * DELETE /api/team/whatsapp-invite?id=xxx       — Revoca un vínculo.
 *
 * Solo OWNER / SUPER_ADMIN.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { serviceQueryOne, serviceQuery, serviceMutate } from '@/lib/db'
import crypto from 'crypto'

const WA_BOT_NUMBER = process.env.NEXT_PUBLIC_WA_BOT_NUMBER!

// ── Auth ──────────────────────────────────────────────────────────────────────
async function getAuth(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim() ?? ''
  if (!token) return null
  const decoded = await verifyFirebaseToken(token)
  if (!decoded) return null
  const profile = await serviceQueryOne<{
    id: string
    organization_id: string | null
    role: string | null
    system_role: string | null
  }>(
    'SELECT id, organization_id, role, system_role FROM profiles WHERE firebase_uid = $1',
    [decoded.uid]
  )
  if (!profile?.organization_id) return null
  return {
    id:             profile.id,
    organizationId: profile.organization_id,
    role:           profile.role,
    systemRole:     profile.system_role,
  }
}

function isAdmin(auth: { role: string | null; systemRole: string | null }) {
  return auth.role === 'OWNER' || auth.systemRole === 'SUPER_ADMIN'
}

// ── Normalizar teléfono → E.164 ───────────────────────────────────────────────
function normalizePhone(raw: string): string | null {
  let p = raw.replace(/[\s\-().]/g, '')
  if (p.startsWith('0')) p = p.slice(1)
  if      (/^\d{10}$/.test(p))    p = `+549${p}`
  else if (/^\d{11}$/.test(p))    p = `+54${p}`
  else if (/^549\d{10}$/.test(p)) p = `+${p}`
  else if (!p.startsWith('+'))    p = `+${p}`
  if (!/^\+\d{10,15}$/.test(p)) return null
  return p
}

// ── GET: estado del vínculo / lista de pendientes ────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await getAuth(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profileId = req.nextUrl.searchParams.get('profileId')

  if (profileId) {
    // Estado de un miembro específico
    const link = await serviceQueryOne<{
      id: string; phone: string | null; is_active: boolean
      operator_name: string | null; role: string
      token_expires_at: string | null
    }>(
      `SELECT id, phone, is_active, operator_name, role, token_expires_at
       FROM whatsapp_links
       WHERE profile_id = $1 AND org_id = $2
       LIMIT 1`,
      [profileId, auth.organizationId]
    )
    return NextResponse.json({
      link: link
        ? {
            id:           link.id,
            phone:        link.phone,
            isActive:     link.is_active,
            operatorName: link.operator_name,
            role:         link.role,
            expiresAt:    link.token_expires_at,
          }
        : null,
    })
  }

  // Lista de todos los vínculos de la org (pendientes + activos)
  const links = await serviceQuery<{
    id: string; phone: string | null; is_active: boolean
    operator_name: string | null; role: string
    profile_id: string | null; token_expires_at: string | null
    created_at: string
  }>(
    `SELECT id, phone, is_active, operator_name, role, profile_id, token_expires_at, created_at
     FROM whatsapp_links
     WHERE org_id = $1
     ORDER BY created_at DESC`,
    [auth.organizationId]
  )

  return NextResponse.json({
    links: links.map(l => ({
      id:           l.id,
      phone:        l.phone,
      isActive:     l.is_active,
      operatorName: l.operator_name,
      role:         l.role,
      profileId:    l.profile_id,
      expiresAt:    l.token_expires_at,
      createdAt:    l.created_at,
    })),
  })
}

// ── POST: crear / renovar vínculo ────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuth(req)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { phone, profileId, operatorName, role = 'CAPATAZ', fieldName } = body

    // Normalizar teléfono (opcional)
    let normalized: string | null = null
    if (phone?.trim()) {
      normalized = normalizePhone(phone.trim())
      if (!normalized) {
        return NextResponse.json(
          { error: 'Teléfono inválido. Ejemplos: 1158802480 o +5491158802480' },
          { status: 400 }
        )
      }
    }

    // Si se pasó profileId, verificar que pertenezca a la org
    if (profileId) {
      const member = await serviceQueryOne<{ id: string }>(
        'SELECT id FROM profiles WHERE id = $1 AND organization_id = $2',
        [profileId, auth.organizationId]
      )
      if (!member) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    }

    const token     = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    const nameVal   = operatorName?.trim() || null
    const roleVal   = ['OWNER', 'ADMIN', 'CAPATAZ', 'VETERINARIO', 'AYUDANTE', 'OPERATOR'].includes(role)
      ? role
      : 'CAPATAZ'

    // Resolver nombre del campo: param del cliente > DB > fallback
    let resolvedFieldName: string = fieldName?.trim() || ''
    if (!resolvedFieldName) {
      const org = await serviceQueryOne<{ name: string; field_name: string | null }>(
        'SELECT name, field_name FROM organizations WHERE id = $1',
        [auth.organizationId]
      )
      resolvedFieldName = org?.field_name?.trim() || org?.name?.trim() || 'RODEO'
    }

    type LinkRow = { id: string; phone: string | null; is_active: boolean; operator_name: string | null; role: string }
    let link: LinkRow | null = null

    if (normalized) {
      // Flujo con teléfono — UPSERT por número
      link = await serviceQueryOne<LinkRow>(
        `INSERT INTO whatsapp_links
           (id, phone, profile_id, org_id, operator_name, role, activation_token, token_expires_at, is_active)
         VALUES
           (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false)
         ON CONFLICT (phone) DO UPDATE SET
           profile_id       = EXCLUDED.profile_id,
           org_id           = EXCLUDED.org_id,
           operator_name    = EXCLUDED.operator_name,
           role             = EXCLUDED.role,
           activation_token = EXCLUDED.activation_token,
           token_expires_at = EXCLUDED.token_expires_at,
           is_active        = false
         RETURNING id, phone, is_active, operator_name, role`,
        [normalized, profileId || null, auth.organizationId, nameVal, roleVal, token, expiresAt]
      ) ?? null
    } else {
      // Flujo sin teléfono — crear siempre nuevo registro
      link = await serviceQueryOne<LinkRow>(
        `INSERT INTO whatsapp_links
           (id, phone, profile_id, org_id, operator_name, role, activation_token, token_expires_at, is_active)
         VALUES
           (gen_random_uuid(), NULL, $1, $2, $3, $4, $5, $6, false)
         RETURNING id, phone, is_active, operator_name, role`,
        [profileId || null, auth.organizationId, nameVal, roleVal, token, expiresAt]
      ) ?? null
    }

    const baseUrl       = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const activationMsg = `Vincular al campo TOKEN_${token}`

    // ── URLs ─────────────────────────────────────────────────────────────────
    // 1. wa.me al bot (Opción Directa - Zero Click Web) — URL que se COMPARTE
    const waBotLink    = `https://wa.me/${WA_BOT_NUMBER}?text=${encodeURIComponent(activationMsg)}`
    // 2. wa.me al operario directo (con teléfono) o al bot (sin teléfono)
    const waDirectLink = normalized
      ? `https://wa.me/${normalized.replace('+', '')}?text=${encodeURIComponent(activationMsg)}`
      : waBotLink
    // 3. Landing page visual de RODEO (alternativa, puede ser localhost en dev)
    const waLink       = `${baseUrl}/join-wa/${token}`

    // ── Textos de invitación ─────────────────────────────────────────────────────────────────
    // El nombre del campo va en negrita (*) para que WhatsApp lo resalte
    const inviterName = nameVal ? `a ${nameVal}` : ''
    const fieldTag    = `*${resolvedFieldName}*`
    const waShareText = inviterName
      ? `¡Hola ${nameVal}! Te invitaron a sumarte a ${fieldTag} en RODEO para reportar novedades del campo. Tocá este link para activar tu cuenta:`
      : `¡Hola! Te invitaron a sumarte a ${fieldTag} en RODEO para reportar novedades del campo. Tocá este link para activar tu cuenta:`
    const waCopyText  = `${waShareText}\n${waBotLink}`

    return NextResponse.json({
      link: {
        id:           link?.id,
        phone:        link?.phone,
        isActive:     link?.is_active,
        operatorName: link?.operator_name,
        role:         link?.role,
      },
      token,
      waBotLink,      // wa.me URL al bot — ESTE es el link principal a compartir
      waDirectLink,   // wa.me URL al operario directo (si se ingresó teléfono)
      waLink,         // /join-wa landing page (alternativa visual, puede ser localhost en dev)
      waShareText,    // texto del mensaje sin URL
      waCopyText,     // texto completo con waBotLink (para portapapeles)
      expiresAt,
    }, { status: 201 })

  } catch (err: any) {
    console.error('POST /api/team/whatsapp-invite error:', err)
    return NextResponse.json({ error: err.message ?? 'Error del servidor' }, { status: 500 })
  }
}

// ── DELETE: revocar vínculo ───────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const auth = await getAuth(req)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    await serviceMutate(
      'DELETE FROM whatsapp_links WHERE id = $1 AND org_id = $2',
      [id, auth.organizationId]
    )

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('DELETE /api/team/whatsapp-invite error:', err)
    return NextResponse.json({ error: err.message ?? 'Error del servidor' }, { status: 500 })
  }
}
