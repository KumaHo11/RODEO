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
import { serviceMutate, serviceQueryOne, getServicePool } from '@/lib/db'

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
  const msgType    = msg.type as 'text' | 'audio' | 'image' | 'document' | 'video'
  const occurredAt = msg.timestamp
    ? new Date(Number(msg.timestamp) * 1000)
    : new Date()

  const textBody = msg.text?.body?.trim() ?? ''

  // Log de diagnóstico — útil para verificar que el webhook está recibiendo mensajes
  console.log(`[WA Webhook] from=${phone} type=${msgType} text=${textBody.slice(0, 80)}`)

  // ── 1. Detectar patrón de activación por token criptográfico (legacy / fallback) ──
  //
  // Backward compatible: links generados antes del cambio de UX siguen usando TOKEN_
  // Los nuevos links usan activación por teléfono (ver bloque 2 más abajo).
  let tokenMatch: RegExpMatchArray | null = null
  if (/TOKEN_/i.test(textBody)) {
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

  // ── 2. Buscar vínculo por teléfono ──────────────────────────────────────────
  // NOTA: Usa serviceQueryOne (BYPASSRLS) porque el webhook no tiene contexto RLS
  const linkByPhone = await serviceQueryOne<{ id: string; org_id: string; is_active: boolean; profile_id: string | null; activation_token: string | null }>(
    'SELECT id, org_id, is_active, profile_id, activation_token FROM whatsapp_links WHERE phone = $1 ORDER BY updated_at DESC LIMIT 1',
    [phone]
  )

  if (!linkByPhone) {
    await sendWhatsAppText(
      phone,
      'Tu número no está vinculado a ninguna cuenta RODEO. ' +
      'Pedile al administrador de tu campo que te comparta el link de invitación.'
    )
    return
  }

  // ── 2b. Invitación pendiente — activar por teléfono (nuevo flujo sin TOKEN) ─
  // Si el link existe pero no está activo, cualquier mensaje del número confirma
  // la intención y activa el vínculo (el token en DB garantiza que fue generado
  // legítimamente para ese número).
  if (!linkByPhone.is_active) {
    console.log(`[WA Webhook] Activando vínculo por teléfono: phone=${phone} link=${linkByPhone.id}`)
    await handleInvitationToken(phone, linkByPhone.activation_token ?? '', waDisplayName)
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
  let videoUrl:     string | null = null
  let content:      string | null = null
  let durationSecs: number | null = null
  const title = buildTitle(msgType)

  // Procesar media con try/catch individual: si falla el download/upload,
  // la nota igual se guarda (sin media) — es mejor tener el registro que nada.
  if (msgType === 'audio' || msgType === 'document') {
    const mediaId = msg.audio?.id ?? msg.document?.id
    if (mediaId) {
      try {
        const { buffer, mimeType } = await downloadWhatsAppMedia(mediaId)
        // Detectar extensión: ogg (WhatsApp nativo), mp4, webm
        let ext = 'ogg'
        if (mimeType.includes('mp4') || mimeType.includes('mpeg')) ext = 'mp4'
        else if (mimeType.includes('webm')) ext = 'webm'
        const path = `bitacora-audio/wa-${Date.now()}.${ext}`
        audioUrl     = await uploadBufferToStorage(buffer, path, mimeType)
        durationSecs = msg.audio?.duration ?? null
        try {
          content = await transcribeAudio(buffer, mimeType)
        } catch (txErr: any) {
          console.warn(`[WA Webhook] Transcripción falló (audio guardado OK) — ${txErr?.message}`)
        }
      } catch (mediaErr: any) {
        console.error(`[WA Webhook] Error al procesar audio wamid=${msgId}: ${mediaErr?.message}`)
        content = '[Audio — no se pudo procesar]'
      }
    }
  } else if (msgType === 'image') {
    const mediaId = msg.image?.id
    if (mediaId) {
      try {
        const { buffer, mimeType } = await downloadWhatsAppMedia(mediaId)
        // Normalizar extensión para storage (avif, heic → jpg)
        let ext = 'jpg'
        if (mimeType.includes('png')) ext = 'png'
        else if (mimeType.includes('webp')) ext = 'webp'
        const path = `bitacora-photos/wa-${Date.now()}.${ext}`
        photoUrl = await uploadBufferToStorage(buffer, path, mimeType)
        content  = msg.image?.caption ?? null
      } catch (mediaErr: any) {
        console.error(`[WA Webhook] Error al procesar imagen wamid=${msgId}: ${mediaErr?.message}`)
        content = msg.image?.caption ?? '[Imagen — no se pudo procesar]'
      }
    }
  } else if (msgType === 'video') {
    const mediaId = msg.video?.id
    if (mediaId) {
      try {
        const { buffer, mimeType } = await downloadWhatsAppMedia(mediaId)
        // Store as video (mp4) — NOT in photo_url
        const path = `bitacora-media/videos/wa-${Date.now()}.mp4`
        videoUrl = await uploadBufferToStorage(buffer, path, mimeType)
        content  = msg.video?.caption ?? null
      } catch (mediaErr: any) {
        console.error(`[WA Webhook] Error al procesar video wamid=${msgId}: ${mediaErr?.message}`)
        content = msg.video?.caption ?? '[Video — no se pudo procesar]'
      }
    }
  } else if (msgType === 'text') {
    content = textBody || null
  }

  // Status APPROVED para notas simples (sin IA de análisis)
  // Solo las notas que pasen por análisis semántico futuro usarán PENDING_REVIEW
  await serviceMutate(
    `INSERT INTO field_notes
       (org_id, created_by, paddock_id, tags, category, title, content,
        audio_url, photo_url, video_url, audio_duration_secs, occurred_at,
        source, status, whatsapp_phone, whatsapp_msg_id)
     VALUES ($1,$2,NULL,$3,$4,$5,$6,$7,$8,$9,$10,$11,'WHATSAPP','APPROVED',$12,$13)`,
    [
      linkByPhone.org_id,
      linkByPhone.profile_id,
      ['GENERAL'],
      'GENERAL',
      title,
      content,
      audioUrl,
      photoUrl,
      videoUrl,
      durationSecs,
      occurredAt.toISOString(),
      phone,
      msgId,
    ]
  )

  console.log(`[WA Webhook] Nota guardada — wamid=${msgId} type=${msgType} audio=${!!audioUrl} photo=${!!photoUrl}`)
  await sendWhatsAppText(phone, '✅ Registro recibido.')

}

// ── handleInvitationToken ─────────────────────────────────────────────────────
/**
 * Valida el token de invitación y activa el vínculo del operario.
 * Si el profileId del link es null, auto-provisiona un Profile mínimo (sin Firebase).
 *
 * IMPORTANTE: Usa getServicePool() (rodeo_service, BYPASSRLS) en lugar de prisma
 * (rodeo_app, sujeto a RLS). Las políticas RLS bloquean INSERT en profiles
 * desde el contexto del webhook ya que no hay sesión de usuario autenticada.
 */
async function handleInvitationToken(
  phone:         string,
  token:         string,
  waDisplayName: string | null
) {
  type PendingLink = {
    id: string; org_id: string; profile_id: string | null;
    operator_name: string | null; role: string | null;
    token_expires_at: Date | null;
  }

  // ── 1. Buscar el link pendiente: por token (legacy) o por teléfono (nuevo flujo) ──
  let pending: PendingLink | null = null

  if (token) {
    // Flujo legacy / backward-compat: token en el mensaje (TOKEN_xxxx)
    pending = await serviceQueryOne<PendingLink>(
      `SELECT id, org_id, profile_id, operator_name, role, token_expires_at
       FROM whatsapp_links
       WHERE activation_token = $1 AND is_active = false`,
      [token]
    ) ?? null
  } else {
    // Nuevo flujo: activación por teléfono — el mensaje amigable no lleva TOKEN_
    // El número ya está pre-registrado en la invitación; cualquier mensaje confirma la intención.
    pending = await serviceQueryOne<PendingLink>(
      `SELECT id, org_id, profile_id, operator_name, role, token_expires_at
       FROM whatsapp_links
       WHERE phone = $1 AND is_active = false
       ORDER BY updated_at DESC LIMIT 1`,
      [phone]
    ) ?? null
  }

  if (!pending) {
    await sendWhatsAppText(
      phone,
      '❌ Este link de invitación no es válido o ya fue utilizado. ' +
      'Pedile al administrador que genere uno nuevo.'
    )
    return
  }

  // ── 2. Verificar expiración ────────────────────────────────────────────────
  if (pending.token_expires_at && new Date(pending.token_expires_at) < new Date()) {
    await sendWhatsAppText(
      phone,
      '⏰ Tu invitación expiró. Pedile al administrador del campo que genere un nuevo link.'
    )
    return
  }

  // ── 3. Verificar que el teléfono no esté ya activo ─────────────────────────
  const alreadyActive = await serviceQueryOne<{ id: string }>(
    'SELECT id FROM whatsapp_links WHERE phone = $1 AND is_active = true',
    [phone]
  )
  if (alreadyActive) {
    await sendWhatsAppText(
      phone,
      '✅ Tu canal de WhatsApp ya está activo. Podés enviar audios, fotos o textos al campo.'
    )
    return
  }

  // ── 4. Datos para el mensaje de bienvenida ─────────────────────────────────
  const org = await serviceQueryOne<{ name: string; field_name: string | null }>(
    'SELECT name, field_name FROM organizations WHERE id = $1',
    [pending.org_id]
  )
  const fieldName = org?.field_name?.trim() || org?.name?.trim() || 'RODEO'

  const resolvedName = pending.operator_name || waDisplayName || null
  const firstName    = resolvedName ? resolvedName.split(' ')[0] : null
  const greeting     = firstName ? `, ${firstName}` : ''

  // ── 5. Transacción atómica con rodeo_service (BYPASSRLS) ───────────────────
  const pool = getServicePool()
  const client = await pool.connect()
  let profileId: string | null = pending.profile_id  // declarado fuera del try para acceso en console.log
  try {
    await client.query('BEGIN')

    if (!profileId) {
      // Auto-provisioning: crear Profile mínimo para operario WhatsApp-only
      const newId = crypto.randomUUID()
      await client.query(
        `INSERT INTO profiles (id, organization_id, first_name, phone, team_role, role, is_active)
         VALUES ($1, $2, $3, $4, $5, 'OPERATOR', true)`,
        [newId, pending.org_id, resolvedName, phone, pending.role]
      )
      profileId = newId
    } else {
      // Perfil existente: actualizar team_role y phone si no tenía
      await client.query(
        `UPDATE profiles SET team_role = $1, phone = COALESCE(NULLIF(phone, ''), $2)
         WHERE id = $3`,
        [pending.role, phone, profileId]
      )
    }

    // Liberar phone de otros links inactivos (evitar UNIQUE violation)
    await client.query(
      `UPDATE whatsapp_links SET phone = NULL
       WHERE phone = $1 AND id != $2 AND is_active = false`,
      [phone, pending.id]
    )

    // Activar el vínculo: asignar teléfono real, profile_id, borrar token
    await client.query(
      `UPDATE whatsapp_links
       SET phone = $1, profile_id = $2, is_active = true,
           activation_token = NULL, token_expires_at = NULL,
           operator_name = COALESCE(operator_name, $3),
           updated_at = NOW()
       WHERE id = $4`,
      [phone, profileId, waDisplayName, pending.id]
    )

    await client.query('COMMIT')
  } catch (txErr) {
    await client.query('ROLLBACK')
    console.error('[WA Webhook] Transaction FAILED:', txErr)
    throw txErr
  } finally {
    client.release()
  }

  console.log(`[WA Webhook] Vínculo activado — phone=${phone} org=${pending.org_id} link=${pending.id} profile=${profileId}`)

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
    video:    `Video WhatsApp - ${hora}`,
  }
  return map[type] ?? `WhatsApp - ${hora}`
}
