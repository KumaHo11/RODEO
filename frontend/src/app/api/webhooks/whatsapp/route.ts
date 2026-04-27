/**
 * POST /api/webhooks/whatsapp  — Recibe eventos de Meta
 * GET  /api/webhooks/whatsapp  — Verificación del webhook (challenge)
 *
 * Flujo:
 *  1. Validar firma HMAC-SHA256
 *  2. Lookup teléfono → profile + org
 *  3. Descargar multimedia de Meta → subir a Firebase Storage
 *  4. Transcribir si es audio
 *  5. INSERT field_notes con status='PENDING_REVIEW'
 *  6. Responder 200 a Meta inmediatamente
 */
import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { downloadWhatsAppMedia, sendWhatsAppText } from '@/lib/whatsapp'
import { transcribeAudio } from '@/lib/speechToText'
import { uploadBufferToStorage } from '@/lib/firebase/storage-admin'
import { mutate, queryOne } from '@/lib/db'

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN!
const APP_SECRET   = process.env.WHATSAPP_APP_SECRET!   // usado para validar firma

// ── GET: handshake de verificación del webhook ──────────────────────────────
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

// ── POST: mensajes entrantes ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // 1. Validar firma HMAC-SHA256 de Meta
  const rawBody = await req.text()
  const signature = req.headers.get('x-hub-signature-256') ?? ''
  const expected  = `sha256=${createHmac('sha256', APP_SECRET).update(rawBody).digest('hex')}`
  if (signature !== expected) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Responder 200 a Meta lo antes posible (SLA < 20 s)
  // El procesamiento pesado ocurre de forma asíncrona
  processPayload(JSON.parse(rawBody)).catch(e =>
    console.error('[WhatsApp Webhook] processPayload error:', e)
  )

  return NextResponse.json({ ok: true })
}

// ── Procesamiento asíncrono ─────────────────────────────────────────────────
async function processPayload(body: any) {
  const entry   = body?.entry?.[0]
  const changes = entry?.changes?.[0]
  const value   = changes?.value
  if (!value?.messages?.length) return  // puede ser status update, ignorar

  for (const msg of value.messages) {
    await processMessage(msg, value)
  }
}

async function processMessage(msg: any, value: any) {
  const phone   = msg.from                           // +5491112345678
  const msgId   = msg.id                             // wamid.xxx
  const msgType = msg.type as 'text' | 'audio' | 'image' | 'document'

  // 2. Lookup teléfono → profile + org
  const link = await queryOne<{ profile_id: string; org_id: string }>(
    `SELECT profile_id, org_id FROM whatsapp_links WHERE phone = $1`,
    [phone]
  )
  if (!link) {
    // Número no registrado → mensaje de bienvenida / instrucciones
    await sendWhatsAppText(
      phone,
      '👋 Tu número no está vinculado a ninguna cuenta Rodeo. Pedile al administrador de tu campo que te agregue en el panel.'
    )
    return
  }

  // 3. Deduplicación
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM field_notes WHERE whatsapp_msg_id = $1`,
    [msgId]
  )
  if (existing) return  // ya procesado

  let audioUrl: string | null = null
  let photoUrl: string | null = null
  let content:  string | null = null
  let durationSecs: number | null = null
  const title = buildTitle(msgType)

  // 4. Procesar según tipo
  if (msgType === 'audio' || msgType === 'document') {
    const mediaId = msg.audio?.id ?? msg.document?.id
    if (mediaId) {
      const { buffer, mimeType } = await downloadWhatsAppMedia(mediaId)
      const ext = mimeType.includes('ogg') ? 'ogg' : 'webm'
      const path = `bitacora-audio/wa-${Date.now()}.${ext}`
      audioUrl = await uploadBufferToStorage(buffer, path, mimeType)
      content  = await transcribeAudio(buffer, mimeType)
      durationSecs = msg.audio?.duration ?? null
    }
  } else if (msgType === 'image') {
    const mediaId = msg.image?.id
    if (mediaId) {
      const { buffer, mimeType } = await downloadWhatsAppMedia(mediaId)
      const path = `bitacora-photos/wa-${Date.now()}.jpg`
      photoUrl = await uploadBufferToStorage(buffer, path, mimeType)
      content  = msg.image?.caption ?? null
    }
  } else if (msgType === 'text') {
    content = msg.text?.body ?? null
  }

  // 5. Insertar en field_notes con PENDING_REVIEW
  await mutate(
    `INSERT INTO field_notes
       (org_id, created_by, paddock_id, tags, category, title, content,
        audio_url, photo_url, audio_duration_secs,
        source, status, whatsapp_phone, whatsapp_msg_id)
     VALUES ($1,$2,NULL,$3,$4,$5,$6,$7,$8,$9,'WHATSAPP','PENDING_REVIEW',$10,$11)`,
    [
      link.org_id,
      link.profile_id,
      JSON.stringify(['GENERAL']),
      'GENERAL',
      title,
      content,
      audioUrl,
      photoUrl,
      durationSecs,
      phone,
      msgId,
    ]
  )

  // 6. ACK al peón
  await sendWhatsAppText(phone, '✅ Registro recibido. El administrador lo revisará pronto.')
}

function buildTitle(type: string) {
  const hora = new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
  const map: Record<string, string> = {
    audio:    `Audio WhatsApp · ${hora}`,
    image:    `Foto WhatsApp · ${hora}`,
    text:     `Mensaje WhatsApp · ${hora}`,
    document: `Documento WhatsApp · ${hora}`,
  }
  return map[type] ?? `WhatsApp · ${hora}`
}
