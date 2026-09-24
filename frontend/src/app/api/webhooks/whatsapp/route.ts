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
 *  2. Se transcribe (audio) y se guarda en field_notes como APPROVED
 *
 * Agrupación de fotos (Photo Album Debounce):
 *  - Meta Cloud API dispara un webhook por cada imagen del álbum (milisegundos de diferencia)
 *  - Al recibir la primera imagen de un sender, se inicia un buffer y un timer de 2.5s
 *  - Cada imagen adicional del mismo sender reinicia el timer y acumula la URL
 *  - Al expirar el timer se escribe UN SOLO registro con todas las fotos en photo_urls[]
 *  - Audio y texto NO entran en el buffer y se insertan de forma inmediata
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

// ── Photo Album Debounce Buffer ───────────────────────────────────────────────
// Keyed by whatsapp phone number (E.164). Accumulates images from the same
// sender within a DEBOUNCE_MS window and flushes them as a single DB row.
//
// NOTE: This is an in-process Map — works correctly for a single Cloud Run
// instance (which is the typical deployment). If you ever need multi-instance
// support, replace with a Redis-backed store using NX+PX atomic SET.
const DEBOUNCE_MS = 2500  // 2.5 s window to collect images from the same sender

interface PhotoBuffer {
  orgId:      string
  profileId:  string | null
  phone:      string
  waDisplayName: string | null
  photoUrls:  string[]
  caption:    string | null       // first non-null caption wins
  msgIds:     string[]            // all wamids in the batch (for dedup)
  occurredAt: Date                // timestamp of the first image
  timer:      ReturnType<typeof setTimeout>
}

// Global buffer — persists across requests within the same process.
// eslint-disable-next-line prefer-const
let photoBuffers: Map<string, PhotoBuffer> = new Map()

// ── GET: verificación del webhook + health-check ──────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  // ── Health-check rápido: GET /api/webhooks/whatsapp?health=1 ─────────────
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
  if (!APP_SECRET) {
    console.error('[WA Webhook] CRITICAL: WHATSAPP_APP_SECRET no configurado. Payload descartado.')
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

  if (!value?.messages?.length) {
    const statusType = value?.statuses?.[0]?.status
    if (statusType) {
      console.log(`[WA Webhook] Status update recibido: ${statusType} — ignorado`)
    } else if (value) {
      console.warn('[WA Webhook] Payload sin mensajes ni statuses:', JSON.stringify(value).slice(0, 300))
    }
    return
  }

  const waDisplayName: string | null = value?.contacts?.[0]?.profile?.name ?? null

  console.log(`[WA Webhook] Procesando ${value.messages.length} mensaje(s) en payload`)

  for (const msg of value.messages) {
    await processMessage(msg, waDisplayName).catch(e =>
      console.error('[WhatsApp] processMessage error:', msg?.id, e?.message, e?.stack?.slice(0, 500))
    )
  }
}

// ── Lógica principal por mensaje ──────────────────────────────────────────────
async function processMessage(msg: any, waDisplayName: string | null) {
  const rawPhone   = msg.from as string
  const phone      = rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`
  const msgId      = msg.id  as string
  const msgType    = msg.type as 'text' | 'audio' | 'image' | 'document' | 'video'
  const occurredAt = msg.timestamp
    ? new Date(Number(msg.timestamp) * 1000)
    : new Date()

  const textBody = msg.text?.body?.trim() ?? ''

  console.log(`[WA Webhook] from=${phone} type=${msgType} text=${textBody.slice(0, 80)}`)

  // ── 1. Detectar patrón de activación por token criptográfico (legacy) ──────
  let tokenMatch: RegExpMatchArray | null = null
  if (/TOKEN_/i.test(textBody)) {
    const afterToken = textBody.replace(/[\s\S]*?TOKEN_/i, '').replace(/[^a-f0-9]/gi, '')
    if (afterToken.length >= 64) {
      const cleanToken = afterToken.slice(0, 64)
      tokenMatch = [textBody, cleanToken]
      console.log(`[WA Webhook] Token de activación detectado: ${cleanToken.slice(0, 16)}...`)
    } else {
      console.warn(`[WA Webhook] TOKEN_ detectado pero inválido: "${afterToken.slice(0, 40)}"`)
    }
  }
  if (tokenMatch) {
    await handleInvitationToken(phone, tokenMatch[1], waDisplayName)
    return
  }

  // ── 2. Buscar vínculo por teléfono ──────────────────────────────────────────
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

  // ── 2b. Invitación pendiente — activar por teléfono ─────────────────────────
  if (!linkByPhone.is_active) {
    console.log(`[WA Webhook] Activando vínculo por teléfono: phone=${phone} link=${linkByPhone.id}`)
    await handleInvitationToken(phone, linkByPhone.activation_token ?? '', waDisplayName)
    return
  }

  // ── 3. Validar permisos ───────────────────────────────────────────────────
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
      'Contactá al administrador o accedé desde un plan superior.'
    )
    return
  }

  if (linkByPhone.profile_id) {
    const profilePerms = await serviceQueryOne<{ whatsapp_bitacora_enabled: boolean }>(
      'SELECT whatsapp_bitacora_enabled FROM profiles WHERE id = $1',
      [linkByPhone.profile_id]
    )
    if (profilePerms?.whatsapp_bitacora_enabled === false) {
      await sendWhatsAppText(
        phone,
        '⛔ Tu rol no tiene habilitado el canal de WhatsApp. ' +
        'Contactá al administrador del establecimiento.'
      )
      return
    }
  }

  // ── 4. Deduplicación por wamid ────────────────────────────────────────────
  const existing = await serviceQueryOne<{ id: string }>(
    'SELECT id FROM field_notes WHERE whatsapp_msg_id = $1',
    [msgId]
  )
  if (existing) return

  // Normalizar tipo de documento
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

  // ── 5. Enrutar según tipo ─────────────────────────────────────────────────
  if (actualMsgType === 'image') {
    // ── 5a. Fotos — pasan por el buffer de debounce ───────────────────────
    await handleImageWithDebounce(
      msg, phone, msgId, occurredAt,
      linkByPhone.org_id, linkByPhone.profile_id,
      waDisplayName
    )
  } else {
    // ── 5b. Audio / Video / Texto — inserción inmediata ───────────────────
    // Si hay un buffer de fotos activo para este sender, hay que flushearlo
    // primero para no mezclar el álbum con el mensaje posterior.
    const existingBuffer = photoBuffers.get(phone)
    if (existingBuffer) {
      clearTimeout(existingBuffer.timer)
      photoBuffers.delete(phone)
      await flushPhotoBuffer(existingBuffer).catch(e =>
        console.error('[WA Webhook] Error flushing photo buffer before non-image:', e)
      )
    }

    await handleNonImageMessage(
      msg, actualMsgType, phone, msgId, msgType, occurredAt,
      linkByPhone.org_id, linkByPhone.profile_id,
      waDisplayName
    )
  }
}

// ── Image debounce handler ────────────────────────────────────────────────────
async function handleImageWithDebounce(
  msg:           any,
  phone:         string,
  msgId:         string,
  occurredAt:    Date,
  orgId:         string,
  profileId:     string | null,
  waDisplayName: string | null,
) {
  const mediaId = msg.image?.id
  if (!mediaId) return

  // Download + upload the image eagerly (do NOT wait for the debounce timer —
  // we need the storage URL now before the buffer flushes).
  let photoUrl: string | null = null
  try {
    const { buffer, mimeType } = await downloadWhatsAppMedia(mediaId)
    let ext = 'jpg'
    if (mimeType.includes('png'))  ext = 'png'
    else if (mimeType.includes('webp')) ext = 'webp'
    const path = `bitacora-photos/wa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`
    photoUrl = await uploadBufferToStorage(buffer, path, mimeType)
  } catch (mediaErr: any) {
    console.error(`[WA Webhook] Error al procesar imagen wamid=${msgId}: ${mediaErr?.message}`)
    // Even if the download failed, keep the entry in the buffer for ACK purposes
  }

  const caption = msg.image?.caption?.trim() || null

  const existing = photoBuffers.get(phone)

  if (existing) {
    // Extend existing buffer
    clearTimeout(existing.timer)
    if (photoUrl) existing.photoUrls.push(photoUrl)
    if (caption && !existing.caption) existing.caption = caption
    existing.msgIds.push(msgId)

    existing.timer = setTimeout(async () => {
      photoBuffers.delete(phone)
      await flushPhotoBuffer(existing).catch(e =>
        console.error('[WA Webhook] flushPhotoBuffer error:', e)
      )
    }, DEBOUNCE_MS)

    console.log(`[WA Webhook] Imagen acumulada en buffer — phone=${phone} total=${existing.photoUrls.length} wamid=${msgId}`)
  } else {
    // Start a new buffer
    const batchId = `wa-batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    const buf: PhotoBuffer = {
      orgId,
      profileId,
      phone,
      waDisplayName,
      photoUrls: photoUrl ? [photoUrl] : [],
      caption,
      msgIds: [msgId],
      occurredAt,
      timer: setTimeout(async () => {
        photoBuffers.delete(phone)
        await flushPhotoBuffer(buf).catch(e =>
          console.error('[WA Webhook] flushPhotoBuffer error:', e)
        )
      }, DEBOUNCE_MS),
    }
    // Attach batchId so we can reference it in the flush
    ;(buf as any).batchId = batchId

    photoBuffers.set(phone, buf)
    console.log(`[WA Webhook] Nuevo buffer iniciado — phone=${phone} batchId=${batchId} wamid=${msgId}`)
  }
}

// ── Flush: escribir UN registro con todas las fotos acumuladas ────────────────
async function flushPhotoBuffer(buf: PhotoBuffer) {
  if (buf.photoUrls.length === 0 && buf.msgIds.length === 0) {
    console.warn('[WA Webhook] flushPhotoBuffer: buffer vacío, nada que guardar')
    return
  }

  const batchId   = (buf as any).batchId as string
  const n         = buf.photoUrls.length
  const photoUrl  = buf.photoUrls[0] ?? null
  // photo_urls: store all URLs as a JSONB array
  const photoUrls = buf.photoUrls
  const title     = buildTitle('image')
  // Use the first wamid as the dedup key for this compound record
  const primaryMsgId = buf.msgIds[0]

  console.log(`[WA Webhook] Flushing buffer — phone=${buf.phone} photos=${n} batchId=${batchId}`)

  await serviceMutate(
    `INSERT INTO field_notes
       (org_id, created_by, paddock_id, tags, category, title, content,
        audio_url, photo_url, photo_urls, video_url, audio_duration_secs, occurred_at,
        source, status, whatsapp_phone, whatsapp_msg_id, wa_batch_id)
     VALUES ($1,$2,NULL,$3,$4,$5,$6,NULL,$7,$8,NULL,NULL,$9,'WHATSAPP','APPROVED',$10,$11,$12)`,
    [
      buf.orgId,
      buf.profileId,
      ['GENERAL'],
      'GENERAL',
      title,
      buf.caption,           // description from WA caption
      photoUrl,              // photo_url = first image (legacy field)
      photoUrls,             // photo_urls = all images (JSONB array, pg serializes automatically)
      buf.occurredAt.toISOString(),
      buf.phone,
      primaryMsgId,
      batchId,
    ]
  )

  console.log(`[WA Webhook] Álbum guardado — phone=${buf.phone} fotos=${n} batchId=${batchId}`)

  // Send a single ACK for the whole album
  try {
    const msg = n === 1
      ? '✅ Registro recibido (1 foto).'
      : `✅ Registro recibido (${n} fotos).`
    await sendWhatsAppText(buf.phone, msg)
    console.log(`[WA Webhook] ACK álbum enviado — phone=${buf.phone} fotos=${n}`)
  } catch (ackErr: any) {
    const is401 = ackErr?.message?.includes('401') || ackErr?.message?.includes('190')
    console.error(
      `[WA Webhook] FALLO al enviar ACK de álbum — phone=${buf.phone}\n` +
      (is401
        ? '  → CAUSA: WHATSAPP_TOKEN inválido o expirado.'
        : `  → ${ackErr?.message}`)
    )
  }
}

// ── Non-image messages (audio, video, text, document) ────────────────────────
async function handleNonImageMessage(
  msg:           any,
  actualMsgType: string,
  phone:         string,
  msgId:         string,
  originalType:  string,
  occurredAt:    Date,
  orgId:         string,
  profileId:     string | null,
  waDisplayName: string | null,
) {
  const textBody = msg.text?.body?.trim() ?? ''
  let audioUrl:     string | null = null
  let videoUrl:     string | null = null
  let content:      string | null = null
  let durationSecs: number | null = null
  const title = buildTitle(actualMsgType)

  if (actualMsgType === 'audio') {
    const mediaId = msg.audio?.id ?? msg.document?.id
    if (mediaId) {
      try {
        const { buffer, mimeType } = await downloadWhatsAppMedia(mediaId)
        let ext = 'ogg'
        if (mimeType.includes('mp4') || mimeType.includes('mpeg')) ext = 'mp4'
        else if (mimeType.includes('webm')) ext = 'webm'
        const path = `bitacora-audio/wa-${Date.now()}.${ext}`
        audioUrl     = await uploadBufferToStorage(buffer, path, mimeType)
        durationSecs = msg.audio?.duration ?? null
        try {
          content = await transcribeAudio(buffer, mimeType)
        } catch (txErr: any) {
          console.warn(`[WA Webhook] Transcripción falló — ${txErr?.message}`)
        }
      } catch (mediaErr: any) {
        console.error(`[WA Webhook] Error al procesar audio wamid=${msgId}: ${mediaErr?.message}`)
        content = '[Audio — no se pudo procesar]'
      }
    }
  } else if (actualMsgType === 'video') {
    const mediaId = msg.video?.id
    if (mediaId) {
      try {
        const { buffer, mimeType } = await downloadWhatsAppMedia(mediaId)
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

  await serviceMutate(
    `INSERT INTO field_notes
       (org_id, created_by, paddock_id, tags, category, title, content,
        audio_url, photo_url, photo_urls, video_url, audio_duration_secs, occurred_at,
        source, status, whatsapp_phone, whatsapp_msg_id, wa_batch_id)
     VALUES ($1,$2,NULL,$3,$4,$5,$6,$7,NULL,'[]',$8,$9,$10,'WHATSAPP','APPROVED',$11,$12,NULL)`,
    [
      orgId,
      profileId,
      ['GENERAL'],
      'GENERAL',
      title,
      content,
      audioUrl,
      videoUrl,
      durationSecs,
      occurredAt.toISOString(),
      phone,
      msgId,
    ]
  )

  console.log(`[WA Webhook] Nota guardada — wamid=${msgId} type=${actualMsgType} audio=${!!audioUrl} video=${!!videoUrl}`)

  try {
    await sendWhatsAppText(phone, '✅ Registro recibido.')
    console.log(`[WA Webhook] ACK enviado — phone=${phone} wamid=${msgId}`)
  } catch (ackErr: any) {
    const is401 = ackErr?.message?.includes('401') || ackErr?.message?.includes('190')
    console.error(
      `[WA Webhook] FALLO al enviar ACK — phone=${phone} wamid=${msgId}\n` +
      (is401
        ? '  → CAUSA: WHATSAPP_TOKEN inválido o expirado.'
        : `  → ${ackErr?.message}`)
    )
  }
}


// ── handleInvitationToken ─────────────────────────────────────────────────────
/**
 * Valida el token de invitación y activa el vínculo del operario.
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

  let pending: PendingLink | null = null

  if (token) {
    pending = await serviceQueryOne<PendingLink>(
      `SELECT id, org_id, profile_id, operator_name, role, token_expires_at
       FROM whatsapp_links
       WHERE activation_token = $1 AND is_active = false`,
      [token]
    ) ?? null
  } else {
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

  if (pending.token_expires_at && new Date(pending.token_expires_at) < new Date()) {
    await sendWhatsAppText(
      phone,
      '⏰ Tu invitación expiró. Pedile al administrador del campo que genere un nuevo link.'
    )
    return
  }

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

  const org = await serviceQueryOne<{ name: string; field_name: string | null }>(
    'SELECT name, field_name FROM organizations WHERE id = $1',
    [pending.org_id]
  )
  const fieldName = org?.field_name?.trim() || org?.name?.trim() || 'RODEO'

  const resolvedName = pending.operator_name || waDisplayName || null
  const firstName    = resolvedName ? resolvedName.split(' ')[0] : null
  const greeting     = firstName ? `, ${firstName}` : ''

  const pool = getServicePool()
  const client = await pool.connect()
  let profileId: string | null = pending.profile_id
  try {
    await client.query('BEGIN')

    if (!profileId) {
      const newId = crypto.randomUUID()
      await client.query(
        `INSERT INTO profiles (id, organization_id, first_name, phone, team_role, role, is_active)
         VALUES ($1, $2, $3, $4, $5, 'OPERATOR', true)`,
        [newId, pending.org_id, resolvedName, phone, pending.role]
      )
      profileId = newId
    } else {
      await client.query(
        `UPDATE profiles SET team_role = $1, phone = COALESCE(NULLIF(phone, ''), $2)
         WHERE id = $3`,
        [pending.role, phone, profileId]
      )
    }

    await client.query(
      `UPDATE whatsapp_links SET phone = NULL
       WHERE phone = $1 AND id != $2 AND is_active = false`,
      [phone, pending.id]
    )

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
