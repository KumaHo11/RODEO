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
 *
 * ── Batching de fotos (álbum WhatsApp) ───────────────────────────────────────
 * Meta Cloud API emite un webhook payload separado por cada imagen de un álbum.
 * Para consolidarlas en una sola entrada de Bitácora usamos un buffer en memoria:
 *   - Cada foto que llega de un remitente se acumula en photoBatchBuffer[phone]
 *   - Si hay un timer activo para ese phone, se resetea (debounce de 5s)
 *   - Cuando el timer dispara, se escribe UNA sola row con photo_urls[] completo
 *   - Soporta hasta MAX_ALBUM_PHOTOS fotos (15 por defecto, configurable)
 *   - La caption de cualquiera de las imágenes se usa como description del lote
 */
import { NextRequest, NextResponse } from 'next/server'
import crypto, { createHmac } from 'crypto'
import { downloadWhatsAppMedia, sendWhatsAppText } from '@/lib/whatsapp'
import { transcribeAudio } from '@/lib/speechToText'
import { uploadBufferToStorage } from '@/lib/firebase/storage-admin'
import { serviceMutate, serviceQueryOne, getServicePool } from '@/lib/db'

// Env vars declaradas al tope para usarlas en el health-check y en el handler
const VERIFY_TOKEN    = process.env.WHATSAPP_VERIFY_TOKEN  ?? ''
const APP_SECRET      = process.env.WHATSAPP_APP_SECRET    ?? ''
const TOKEN           = process.env.WHATSAPP_TOKEN         ?? ''
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID ?? ''

// ── In-memory photo album buffer ─────────────────────────────────────────────
// Accumulates photos from rapid-fire WhatsApp album sends (same sender).
// Each entry is debounced for DEBOUNCE_MS; when the timer fires, ONE row is
// written to field_notes with the full photo_urls[] array.
//
// NOTE: Works correctly in single-instance deployments (Cloud Run with
// min-instances=1 or the Next.js dev server). If running multiple instances,
// consider replacing with Redis or Postgres LISTEN/NOTIFY.
const MAX_ALBUM_PHOTOS = 15
const DEBOUNCE_MS      = 5_000 // 5 seconds — covers typical WA album delivery lag

interface PhotoBatch {
  orgId:       string
  profileId:   string | null
  phone:       string
  senderName:  string | null
  occurredAt:  Date
  caption:     string | null   // first non-null caption wins
  photos:      string[]        // accumulated URLs (in arrival order)
  wamids:      string[]        // for dedup logging
  timerId:     ReturnType<typeof setTimeout>
}

// phone → active batch
const photoBatchBuffer = new Map<string, PhotoBatch>()

/**
 * Adds a photo URL to the in-memory batch for `phone`, resetting the debounce
 * timer.  When the timer fires, `flushPhotoBatch` is called automatically.
 *
 * Returns `true` if this is the FIRST photo of a new batch (so the caller can
 * send a single ACK confirmation to the user).
 */
function bufferPhoto(opts: {
  orgId:      string
  profileId:  string | null
  phone:      string
  senderName: string | null
  occurredAt: Date
  caption:    string | null
  photoUrl:   string
  wamid:      string
}): boolean {
  const existing = photoBatchBuffer.get(opts.phone)

  if (existing && existing.photos.length < MAX_ALBUM_PHOTOS) {
    // Join existing batch: reset timer, append photo, keep first caption
    clearTimeout(existing.timerId)
    existing.photos.push(opts.photoUrl)
    existing.wamids.push(opts.wamid)
    if (!existing.caption && opts.caption) existing.caption = opts.caption
    existing.timerId = setTimeout(() => flushPhotoBatch(opts.phone), DEBOUNCE_MS)
    return false // not the first
  }

  // Flush any full batch immediately before starting a new one
  if (existing) {
    clearTimeout(existing.timerId)
    flushPhotoBatch(opts.phone)
  }

  // Start a new batch
  const timerId = setTimeout(() => flushPhotoBatch(opts.phone), DEBOUNCE_MS)
  photoBatchBuffer.set(opts.phone, {
    orgId:      opts.orgId,
    profileId:  opts.profileId,
    phone:      opts.phone,
    senderName: opts.senderName,
    occurredAt: opts.occurredAt,
    caption:    opts.caption,
    photos:     [opts.photoUrl],
    wamids:     [opts.wamid],
    timerId,
  })
  return true // first in a new batch
}

/**
 * Writes the accumulated batch to field_notes as a SINGLE row and removes it
 * from the buffer.  Called when the debounce timer fires OR when MAX_ALBUM_PHOTOS
 * is reached.
 */
async function flushPhotoBatch(phone: string) {
  const batch = photoBatchBuffer.get(phone)
  if (!batch) return
  photoBatchBuffer.delete(phone)

  const hora  = batch.occurredAt.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
  const title = `Fotos WhatsApp - ${hora}`
  const batchId = `wa-batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  try {
    await serviceMutate(
      `INSERT INTO field_notes
         (org_id, created_by, paddock_id, tags, category, title, content,
          photo_url, photo_urls, audio_url, video_url, audio_duration_secs,
          occurred_at, source, status, whatsapp_phone, whatsapp_msg_id,
          wa_batch_id, sender_name)
       VALUES ($1,$2,NULL,$3,$4,$5,$6,$7,$8,NULL,NULL,NULL,$9,
               'WHATSAPP','APPROVED',$10,$11,$12,$13)`,
      [
        batch.orgId,
        batch.profileId,
        ['GENERAL'],
        'GENERAL',
        title,
        batch.caption,
        batch.photos[0],                         // photo_url = first image (legacy compat)
        batch.photos,                             // photo_urls TEXT[] — pass as native JS array
        batch.occurredAt.toISOString(),
        batch.phone,
        batch.wamids[0],                         // whatsapp_msg_id = first wamid
        batchId,
        batch.senderName,
      ]
    )
    console.log(
      `[WA Webhook] Batch flushed — phone=${phone} photos=${batch.photos.length} ` +
      `caption=${batch.caption?.slice(0, 40) ?? 'none'} batchId=${batchId}`
    )
  } catch (err: any) {
    console.error(`[WA Webhook] ERROR flushing photo batch for ${phone}:`, err?.message)
  }
}


// ── GET: verificación del webhook + health-check ──────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams, pathname } = new URL(req.url)

  // ── Health-check rápido: GET /api/webhooks/whatsapp?health=1 ─────────────
  // Permite verificar en segundos si las env vars críticas están presentes
  // sin necesitar enviar un mensaje de WhatsApp real.
  if (searchParams.get('health') === '1') {
    const status = {
      ok: true,
      env: {
        WHATSAPP_TOKEN:          TOKEN          ? `✅ configurado (${TOKEN.slice(0, 6)}…)`          : '❌ AUSENTE',
        WHATSAPP_APP_SECRET:     APP_SECRET     ? `✅ configurado (${APP_SECRET.slice(0, 4)}…)`     : '❌ AUSENTE',
        WHATSAPP_PHONE_NUMBER_ID: PHONE_NUMBER_ID ? `✅ configurado (${PHONE_NUMBER_ID.slice(0, 6)}…)` : '❌ AUSENTE',
        WHATSAPP_VERIFY_TOKEN:   VERIFY_TOKEN   ? '✅ configurado' : '❌ AUSENTE',
      },
      ts: new Date().toISOString(),
    }
    const allOk = TOKEN && APP_SECRET && PHONE_NUMBER_ID && VERIFY_TOKEN
    return NextResponse.json(status, { status: allOk ? 200 : 503 })
  }

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

  // Log completo del value para diagnóstico (status updates, reads receipts, etc.)
  if (!value?.messages?.length) {
    // Puede ser un status update (delivered, read) — no es un error, pero lo logueamos
    // si viene algo inesperado para facilitar debugging.
    const statusType = value?.statuses?.[0]?.status
    if (statusType) {
      console.log(`[WA Webhook] Status update recibido: ${statusType} — ignorado (no es un mensaje)`)
    } else if (value) {
      console.warn('[WA Webhook] Payload sin mensajes ni statuses conocidos:', JSON.stringify(value).slice(0, 300))
    }
    return
  }

  // Nombre del perfil de WA del primer contacto (puede ser null)
  const waDisplayName: string | null = value?.contacts?.[0]?.profile?.name ?? null

  console.log(`[WA Webhook] Procesando ${value.messages.length} mensaje(s) en payload`)

  // Process messages sequentially to allow batch detection within the same payload
  for (const msg of value.messages) {
    await processMessage(msg, waDisplayName).catch(e =>
      console.error('[WhatsApp] processMessage error:', msg?.id, e?.message, e?.stack?.slice(0, 500))
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

  // ── 3. Validar permisos (Nivel 1: tenant, Nivel 2: miembro) ───────────────

  // Nivel 1 — ¿el tenant tiene el módulo WhatsApp activo?
  const orgRow = await serviceQueryOne<{
    whatsapp_enabled: boolean | null
    plan_slug: string | null
  }>(
    `SELECT o.whatsapp_enabled,
            p.slug AS plan_slug
     FROM organizations o
     LEFT JOIN subscriptions_plans p ON p.id = o.subscription_plan_id
     WHERE o.id = $1`,
    [linkByPhone.org_id]
  )
  const WA_PLANS = ['planificador', 'pro_ganadero', 'holistico', 'pro_ganadero+', 'latifundio', 'enterprise']
  const planDefaultEnabled = WA_PLANS.includes((orgRow?.plan_slug ?? '').toLowerCase())
  const tenantEnabled = orgRow?.whatsapp_enabled ?? planDefaultEnabled

  if (!tenantEnabled) {
    await sendWhatsAppText(
      phone,
      '⚠️ El módulo de WhatsApp no está activo para este establecimiento. ' +
      'Contactá al administrador o accedé desde un plan superior (Planificador, Holístico o Latifundio).'
    )
    return
  }

  // Nivel 2 — ¿el miembro tiene permiso individual de WA?
  if (linkByPhone.profile_id) {
    const profilePerms = await serviceQueryOne<{ whatsapp_bitacora_enabled: boolean }>(
      'SELECT whatsapp_bitacora_enabled FROM profiles WHERE id = $1',
      [linkByPhone.profile_id]
    )
    if (profilePerms?.whatsapp_bitacora_enabled === false) {
      await sendWhatsAppText(
        phone,
        '⛔ Tu rol no tiene habilitado el canal de WhatsApp para este campo. ' +
        'Contactá al administrador del establecimiento para que lo active.'
      )
      return
    }
  }

  // ── 4. Canal activo — procesar novedad de campo ────────────────────
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
  let waBatchId:    string | null = null
  let isBatchFirst  = false   // true if this image is the first in a new batch
  const title = buildTitle(msgType)

  let actualMsgType = msgType
  if (msgType === 'document') {
    const mime = msg.document?.mime_type || ''
    if (mime.startsWith('image/')) {
      actualMsgType = 'image'
      msg.image = msg.document
    } else if (mime.startsWith('video/')) {
      actualMsgType = 'video'
      msg.video = msg.document
    } else if (mime.startsWith('audio/')) {
      actualMsgType = 'audio'
      msg.audio = msg.document
    }
  }

  // Procesar media con try/catch individual: si falla el download/upload,
  // la nota igual se guarda (sin media) — es mejor tener el registro que nada.
  if (actualMsgType === 'audio') {
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
  } else if (actualMsgType === 'image') {
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
        const caption = msg.image?.caption ?? null
        content = caption  // for single-image fallback path (non-batch)

        // ── Image Batching (in-memory debounce) ────────────────────────────
        // Buffer the photo and let flushPhotoBatch() write one consolidated row.
        // We do NOT write a row here — bufferPhoto() returns control immediately.
        isBatchFirst = bufferPhoto({
          orgId:      linkByPhone.org_id,
          profileId:  linkByPhone.profile_id,
          phone,
          senderName: waDisplayName,
          occurredAt,
          caption,
          photoUrl:   photoUrl!,
          wamid:      msgId,
        })

        // Signal to the caller that no DB INSERT should happen for this image
        // (flushPhotoBatch handles it asynchronously).
        photoUrl = null   // suppress the generic INSERT below

      } catch (mediaErr: any) {
        console.error(`[WA Webhook] Error al procesar imagen wamid=${msgId}: ${mediaErr?.message}`)
        content = msg.image?.caption ?? '[Imagen — no se pudo procesar]'
      }
    }
  } else if (actualMsgType === 'video') {
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
  } else if (actualMsgType === 'document') {
    content = msg.document?.caption || msg.document?.filename || '[Documento adjunto no soportado]'
  } else if (actualMsgType === 'text') {
    content = textBody || null
  }

  // ── Images are handled exclusively by flushPhotoBatch() ──────────────────
  // photoUrl is set to null after bufferPhoto() is called; skip the INSERT.
  if (photoUrl === null && actualMsgType === 'image') {
    // Only ACK on first photo of a new batch — avoid spamming the user.
    if (isBatchFirst) {
      try {
        await sendWhatsAppText(phone, '\u2705 Fotos recibidas.')
        console.log(`[WA Webhook] ACK (primer foto de álbum) — phone=${phone} wamid=${msgId}`)
      } catch (ackErr: any) {
        console.error(`[WA Webhook] Error al enviar ACK de foto — phone=${phone}: ${(ackErr as any)?.message}`)
      }
    }
    return
  }

  // Status APPROVED para notas simples (sin IA de análisis)
  // Solo las notas que pasen por análisis semántico futuro usarán PENDING_REVIEW
  await serviceMutate(
    `INSERT INTO field_notes
       (org_id, created_by, paddock_id, tags, category, title, content,
        audio_url, photo_url, photo_urls, video_url, audio_duration_secs,
        occurred_at, source, status, whatsapp_phone, whatsapp_msg_id,
        wa_batch_id, sender_name)
     VALUES ($1,$2,NULL,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'WHATSAPP','APPROVED',$13,$14,$15,$16)`,
    [
      linkByPhone.org_id,
      linkByPhone.profile_id,
      ['GENERAL'],
      'GENERAL',
      title,
      content,
      audioUrl,
      photoUrl,
      [],                // photo_urls TEXT[]: empty array for non-photo entries
      videoUrl,
      durationSecs,
      occurredAt.toISOString(),
      phone,
      msgId,
      waBatchId,
      waDisplayName,
    ]
  )

  console.log(`[WA Webhook] Nota guardada — wamid=${msgId} type=${msgType} audio=${!!audioUrl} video=${!!videoUrl}`)

  // Enviar ACK para todos los tipos excepto imágenes (que ya tienen su propio ACK arriba).
  // Envuelto en try/catch propio: si el envío falla (token 401, límite de tasa, ventana 24h),
  // el registro YA está guardado en DB — no revertir por error de confirmación.
  if (actualMsgType !== 'image') {
    try {
      await sendWhatsAppText(phone, '\u2705 Registro recibido.')
      console.log(`[WA Webhook] ACK enviado — phone=${phone} wamid=${msgId}`)
    } catch (ackErr: any) {
      // 401 = token expirado o inválido → pista explícita para el operador
      const is401 = ackErr?.message?.includes('401') || ackErr?.message?.includes('190')
      console.error(
        `[WA Webhook] FALLO al enviar ACK (nota guardada OK) — phone=${phone} wamid=${msgId}\n` +
        (is401
          ? '  → CAUSA PROBABLE: WHATSAPP_TOKEN inválido o expirado. Verificar en Meta Business > System Users.'
          : `  → ${ackErr?.message}`
        )
      )
    }
  }

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
