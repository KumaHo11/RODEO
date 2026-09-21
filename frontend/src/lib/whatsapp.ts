/**
 * lib/whatsapp.ts
 * Cliente para la Meta WhatsApp Cloud API v20.
 * Todas las operaciones de DB usan Prisma (sin raw SQL).
 */

const BASE = `https://graph.facebook.com/v20.0`
const TOKEN = process.env.WHATSAPP_TOKEN!
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!

// ── Media ─────────────────────────────────────────────────────────────────────

/** Descarga el binario de un media_id de Meta y devuelve un Buffer */
export async function downloadWhatsAppMedia(
  mediaId: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  // 1. Obtener la URL temporal de descarga
  const metaRes = await fetch(`${BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  if (!metaRes.ok) throw new Error(`Meta media lookup failed: ${metaRes.status}`)
  const { url, mime_type } = await metaRes.json()

  // 2. Descargar el binario
  const fileRes = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  if (!fileRes.ok) throw new Error(`Media download failed: ${fileRes.status}`)

  const arrayBuffer = await fileRes.arrayBuffer()
  return { buffer: Buffer.from(arrayBuffer), mimeType: mime_type as string }
}

// ── Messaging ─────────────────────────────────────────────────────────────────

/** Envía un mensaje de texto al número especificado */
export async function sendWhatsAppText(to: string, text: string): Promise<void> {
  const metaTo = to.replace('+', '')
  const res = await fetch(`${BASE}/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: metaTo,
      type: 'text',
      text: { body: text },
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    console.error(`[WhatsApp] sendText failed (${res.status}):`, body)
  }
}
