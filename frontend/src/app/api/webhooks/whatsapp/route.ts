/**
 * POST /api/webhooks/whatsapp  — Recibe eventos de Meta
 * GET  /api/webhooks/whatsapp  — Verificación del webhook (challenge)
 *
 * Flujo de activación (Zero-Friction Link):
 *  1. Operario recibe link de invitación del administrador
 *  2. Toca el link → WhatsApp abre con "Vincular al campo TOKEN_{hex}" pre-cargado
 *  3. El operario presiona Enviar — este webhook lo recibe
 *  4. Se valida el token, se auto-provisiona el Profile si no existe, y el canal queda activo
 *
 * Flujo de novedades (canal activo):
 *  1. Operario vinculado envía audio/foto/texto
 *  2. Se transcribe (audio) y se guarda en field_notes como PENDING_REVIEW
 */
import { NextRequest, NextResponse } from 'next/server'
import crypto, { createHmac } from 'crypto'
import { downloadWhatsAppMedia, sendWhatsAppText } from '@/lib/whatsapp'
import { transcribeAudio } from '@/lib/speechToText'
import { uploadBufferToStorage } from '@/lib/firebase/storage-admin'
import { serviceMutate, serviceQueryOne } from '@/lib/db'
import prisma from '@/lib/prisma'

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN!
const APP_SECRET   = process.env.WHATSAPP_APP_SECRET!

// ── GET: verificación del webhook ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// ── POST: mensajes entrantes ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const rawBody   = await req.text()
  const signature = req.headers.get('x-hub-signature-256') ?? ''

  // Guard: si APP_SECRET no está configurado, no podemos validar firmas.
  // Retornamos 200 para evitar que Meta desactive el webhook por reintentos fallidos,
  // pero NO procesamos el payload por razones de seguridad. Revisar GitHub Secrets.
  if (!APP_SECRET) {
    console.error('[WA Webhook] CRITICAL: WHATSAPP_APP_SECRET no configurado en el entorno de Cloud Run. ' +
      'Verificar GitHub Secrets del entorno de staging. Payload descartado por seguridad.')
    return NextResponse.json({ ok: true, warning: 'Signature validation disabled — payload discarded' })
  }

  const expected  = `sha256=${createHmac('sha256', APP_SECRET).update(rawBody).digest('hex')}`
  if (signature !== expected) {
    console.error(`[WA Webhook] Firma inválida — received="${signature.slice(0, 20)}..." expected="${expected.slice(0, 20)}..."`)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Responder 200 a Meta inmediato (SLA < 20s) — procesar de forma asíncrona
  processPayload(JSON.parse(rawBody)).catch(e =>
    console.error('[WhatsApp Webhook] processPayload error:', e)
  )

  return NextResponse.json({ ok: true })
}

// ── Procesamiento asíncrono ───────────────────────────────────────────────────
async function processPayload(body: any) {
  const entry   = body?.entry?.[0]
  const changes = entry?.changes?.[0]
  const value   = changes?.value
  if (!value?.messages?.length) return

  // Nombre del perfil de WA del primer contacto (puede ser null)
  const waDisplayName: string | null = value?.contacts?.[0]?.profile?.name ?? null

  for (const msg of value.messages) {
    await processMessage(msg, waDisplayName).catch(e =>
      console.error('[WhatsApp] processMessage error:', msg?.id, e?.message)
    )
  }
}

// ── Lógica principal por mensaje ──────────────────────────────────────────────
async function processMessage(msg: any, waDisplayName: string | null) {
  const rawPhone   = msg.from as string   // +5491112345678 (E.164 sin +, Meta lo envía sin +)
  const phone      = rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`
  const msgId      = msg.id  as string
  const msgType    = msg.type as 'text' | 'audio' | 'image' | 'document'
  const occurredAt = msg.timestamp
    ? new Date(Number(msg.timestamp) * 1000)
    : new Date()

  const textBody = msg.text?.body?.trim() ?? ''

  // Log de diagnóstico — útil para verificar que el webhook está recibiendo mensajes
  console.log(`[WA Webhook] from=${phone} type=${msgType} text=${textBody.slice(0, 80)}`)

  // ── 1. Detectar patrón de activación por token criptográfico ───────────────────
  //
  // IMPORTANTE: WhatsApp puede insertar guiones de separación visual (soft hyphens)
  // en strings largos al mostrarlos, pero el texto RAW enviado al webhook puede
  // contenerlos o no (depende del cliente). Limpiamos el token antes de validar.
  //
  // Formatos aceptados:
  //   "Vincular al campo TOKEN_d32b18903a..."  (64 hex sin guiones, ideal)
  //   "Vincular al campo TOKEN_d32-b189-03a..." (con guiones visuales, tolerado)
  let tokenMatch: RegExpMatchArray | null = null
  if (/TOKEN_/i.test(textBody)) {
    // Extraer todo lo que viene después de TOKEN_ y limpiar cualquier caracter que no sea hex (ej. paréntesis, espacios, guiones)
    const afterToken = textBody.replace(/[\s\S]*?TOKEN_/i, '').replace(/[^a-f0-9]/gi, '')
    if (afterToken.length >= 64) {
      const cleanToken = afterToken.slice(0, 64)
      tokenMatch = [textBody, cleanToken]
      console.log(`[WA Webhook] Token de activación detectado: ${cleanToken.slice(0, 16)}...`)
    } else {
      console.warn(`[WA Webhook] Se detectó TOKEN_ pero el valor no tiene 64 caracteres hex: "${afterToken.slice(0, 40)}"`)
    }
  }
  if (tokenMatch) {
    await handleInvitationToken(phone, tokenMatch[1], waDisplayName)
    return
  }

  // ── 2. Flujo de novedades — canal debe estar activo ─────────────────────────
  const linkByPhone = await prisma.whatsAppLink.findUnique({
    where:  { phone },
    select: { id: true, orgId: true, isActive: true, profileId: true },
  })

  if (!linkByPhone) {
    await sendWhatsAppText(
      phone,
      'Tu número no está vinculado a ninguna cuenta RODEO. ' +
      'Pedile al administrador de tu campo que te comparta el link de invitación.'
    )
    return
  }

  if (!linkByPhone.isActive) {
    await sendWhatsAppText(
      phone,
      'Tu canal está pendiente de activación. Usá el link de invitación que te envió el administrador.'
    )
    return
  }

  // ── 3. Canal activo — procesar novedad de campo ────────────────────────────
  // Deduplicación por wamid
  const existing = await serviceQueryOne<{ id: string }>(
    'SELECT id FROM field_notes WHERE whatsapp_msg_id = $1',
    [msgId]
  )
  if (existing) return

  let audioUrl:     string | null = null
  let photoUrl:     string | null = null
  let content:      string | null = null
  let durationSecs: number | null = null
  const title = buildTitle(msgType)

  if (msgType === 'audio' || msgType === 'document') {
    const mediaId = msg.audio?.id ?? msg.document?.id
    if (mediaId) {
      const { buffer, mimeType } = await downloadWhatsAppMedia(mediaId)
      const ext    = mimeType.includes('ogg') ? 'ogg' : 'webm'
      const path   = `bitacora-audio/wa-${Date.now()}.${ext}`
      audioUrl     = await uploadBufferToStorage(buffer, path, mimeType)
      content      = await transcribeAudio(buffer, mimeType)
      durationSecs = msg.audio?.duration ?? null
    }
  } else if (msgType === 'image') {
    const mediaId = msg.image?.id
    if (mediaId) {
      const { buffer, mimeType } = await downloadWhatsAppMedia(mediaId)
      const path = `bitacora-photos/wa-${Date.now()}.jpg`
      photoUrl   = await uploadBufferToStorage(buffer, path, mimeType)
      content    = msg.image?.caption ?? null
    }
  } else if (msgType === 'text') {
    content = textBody || null
  }

  await serviceMutate(
    `INSERT INTO field_notes
       (org_id, created_by, paddock_id, tags, category, title, content,
        audio_url, photo_url, audio_duration_secs, occurred_at,
        source, status, whatsapp_phone, whatsapp_msg_id)
     VALUES ($1,$2,NULL,$3,$4,$5,$6,$7,$8,$9,$10,'WHATSAPP','PENDING_REVIEW',$11,$12)`,
    [
      linkByPhone.orgId,
      linkByPhone.profileId,
      ['GENERAL'],
      'GENERAL',
      title,
      content,
      audioUrl,
      photoUrl,
      durationSecs,
      occurredAt.toISOString(),
      phone,
      msgId,
    ]
  )

  await sendWhatsAppText(phone, '✅ Registro recibido. El administrador lo revisará pronto.')
}

// ── handleInvitationToken ─────────────────────────────────────────────────────
/**
 * Valida el token de invitación y activa el vínculo del operario.
 * Si el profileId del link es null, auto-provisiona un Profile mínimo (sin Firebase).
 * Todo se ejecuta dentro de una transacción atómica.
 */
async function handleInvitationToken(
  phone:         string,
  token:         string,
  waDisplayName: string | null
) {
  // Buscar el link pendiente por token
  const pending = await prisma.whatsAppLink.findFirst({
    where: {
      activationToken: token,
      isActive:        false,
    },
    select: {
      id:             true,
      orgId:          true,
      profileId:      true,
      operatorName:   true,
      role:           true,
      tokenExpiresAt: true,
    },
  })

  if (!pending) {
    await sendWhatsAppText(
      phone,
      '❌ Este link de invitación no es válido o ya fue utilizado. ' +
      'Pedile al administrador que genere uno nuevo.'
    )
    return
  }

  // Verificar expiración
  if (pending.tokenExpiresAt && pending.tokenExpiresAt < new Date()) {
    await sendWhatsAppText(
      phone,
      '⏰ Tu invitación expiró. Pedile al administrador del campo que genere un nuevo link.'
    )
    return
  }

  // Verificar que el teléfono no esté ya activo en otro vínculo de esta org
  const alreadyActive = await prisma.whatsAppLink.findFirst({
    where: { phone, isActive: true },
    select: { id: true, orgId: true },
  })
  if (alreadyActive) {
    await sendWhatsAppText(
      phone,
      '✅ Tu canal de WhatsApp ya está activo. Podés enviar audios, fotos o textos al campo.'
    )
    return
  }

  // Obtener datos de la organización para el mensaje de bienvenida
  const org = await prisma.organization.findUnique({
    where:  { id: pending.orgId },
    select: { name: true, fieldName: true },
  })
  // Prioridad: field_name > name > 'RODEO'
  const fieldName = org?.fieldName?.trim() || org?.name?.trim() || 'RODEO'

  // Determinar nombre del operario: alias del admin > nombre de WA > genérico
  const resolvedName = pending.operatorName || waDisplayName || null
  const firstName    = resolvedName ? resolvedName.split(' ')[0] : null
  const greeting     = firstName ? `, ${firstName}` : ''

  // Transacción atómica: auto-provisioning de Profile + activación del link
  await prisma.$transaction(async (tx) => {
    let profileId = pending.profileId

    if (!profileId) {
      // Auto-provisioning: crear Profile mínimo para operario WhatsApp-only
      const newProfile = await tx.profile.create({
        data: {
          id:             crypto.randomUUID(),
          organizationId: pending.orgId,
          firstName:      resolvedName,
          phone:          phone,
          teamRole:       pending.role,
          role:           'OPERATOR',  // CHECK constraint: solo acepta OWNER, MANAGER, OPERATOR
          isActive:       true,
        },
        select: { id: true },
      })
      profileId = newProfile.id
    } else {
      // Perfil existente: actualizar team_role y phone si no tenía
      const existing = await tx.profile.findUnique({
        where: { id: profileId },
        select: { phone: true }
      })
      await tx.profile.update({
        where: { id: profileId },
        data: {
          teamRole: pending.role,
          phone:    existing?.phone || phone,
        },
      })
    }

    // Activar el vínculo: asignar teléfono real, profile_id, borrar token
    await tx.whatsAppLink.update({
      where: { id: pending.id },
      data: {
        phone:           phone,
        profileId:       profileId,
        isActive:        true,
        activationToken: null,
        tokenExpiresAt:  null,
        ...(waDisplayName && !pending.operatorName ? { operatorName: waDisplayName } : {}),
      },
    })
  })

  // Fix 4: log granular para detectar si la falla ocurre en la DB (transacción) o en Meta API
  console.log(`[WA Webhook] Vínculo activado — phone=${phone} org=${pending.orgId} link=${pending.id}`)

  // Enviar mensaje de bienvenida en try/catch independiente:
  // si Meta rechaza el mensaje (ej. fuera de ventana de 24hs o error de template),
  // la activación en DB ya está confirmada y no debe revertirse.
  try {
    await sendWhatsAppText(
      phone,
      `✅ ¡Hola${greeting}! Ya quedaste vinculado al campo *${fieldName}*.\n\n` +
      `A partir de ahora podés enviar audios, fotos o texto y se registrarán en la bitácora del campo.\n\n` +
      `Guardá este número como "${fieldName}" para reconocerlo fácil. 🐄`
    )
    console.log(`[WA Webhook] Mensaje de bienvenida enviado — phone=${phone}`)
  } catch (sendErr: any) {
    // Log del error pero NO relanzar — la vinculación ya fue exitosa
    console.error(`[WA Webhook] Error al enviar bienvenida (activación OK en DB) — phone=${phone}:`, sendErr?.message)
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildTitle(type: string) {
  const hora = new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
  const map: Record<string, string> = {
    audio:    `Audio WhatsApp - ${hora}`,
    image:    `Foto WhatsApp - ${hora}`,
    text:     `Mensaje WhatsApp - ${hora}`,
    document: `Documento WhatsApp - ${hora}`,
  }
  return map[type] ?? `WhatsApp - ${hora}`
}
