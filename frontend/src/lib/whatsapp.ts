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

/** Envía un mensaje de texto al número especificado.
 *  LANZA error si Meta rechaza el mensaje — el caller debe manejar en try/catch.
 *  Esto garantiza que los fallos de mensajería sean visibles y no silenciosos.
 */
export async function sendWhatsAppText(to: string, text: string): Promise<void> {
  if (!TOKEN) {
    const err = '[WhatsApp] WHATSAPP_TOKEN no configurado — no se puede enviar mensaje saliente.'
    console.error(err)
    throw new Error(err)
  }
  if (!PHONE_NUMBER_ID) {
    const err = '[WhatsApp] WHATSAPP_PHONE_NUMBER_ID no configurado — no se puede enviar mensaje saliente.'
    console.error(err)
    throw new Error(err)
  }

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
    const errMsg = `[WhatsApp] sendText failed (${res.status}) to=${metaTo}: ${body.slice(0, 300)}`
    console.error(errMsg)
    throw new Error(errMsg)
  }
}
