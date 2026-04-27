/**
 * lib/whatsapp.ts
 * Cliente mínimo para la Meta WhatsApp Cloud API v19.
 */

const BASE = `https://graph.facebook.com/v19.0`
const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!

/** Descarga el binario de un media_id de Meta y devuelve un Buffer */
export async function downloadWhatsAppMedia(mediaId: string): Promise<{ buffer: Buffer; mimeType: string }> {
  // 1. Obtener la URL de descarga
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

/** Envía un mensaje de texto al remitente (acuse de recibo) */
export async function sendWhatsAppText(to: string, text: string) {
  await fetch(`${BASE}/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  })
}
