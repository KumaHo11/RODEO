/**
 * lib/speechToText.ts
 * Transcripción de audio usando Gemini 2.5 Flash (multimodal).
 *
 * Gemini procesa OGG/Opus, WebM, MP4 directamente sin necesidad de
 * especificar sample rate — ideal para audios de WhatsApp que pueden
 * variar entre 8000, 16000 y 48000 Hz.
 *
 * Fallback: si GEMINI_API_KEY no está disponible, devuelve placeholder.
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

let _genAI: GoogleGenerativeAI | null = null

function getGenAI(): GoogleGenerativeAI {
  if (_genAI) return _genAI
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('[speechToText] GEMINI_API_KEY no configurada')
  _genAI = new GoogleGenerativeAI(key)
  return _genAI
}

/**
 * Transcribe un buffer de audio usando Gemini 2.5 Flash.
 * Acepta OGG/Opus (WhatsApp nativo), WebM, MP4, MPEG.
 *
 * @param audioBuffer  Buffer del archivo de audio
 * @param mimeType     MIME type ('audio/ogg; codecs=opus' | 'audio/webm' | etc.)
 * @returns            Texto transcripto, o '[Sin voz detectable]' si no hay voz
 */
export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const genAI = getGenAI()

  // Normalizar mimeType a algo que Gemini entienda
  // WhatsApp envía 'audio/ogg; codecs=opus' → Gemini acepta 'audio/ogg'
  const normalizedMime = normalizeMime(mimeType)

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      // Sin thinking para transcripción rápida y literal
      // @ts-expect-error -- thinkingConfig not yet typed in @google/generative-ai
      thinkingConfig: { thinkingBudget: 0 },
    },
  })

  const base64Audio = audioBuffer.toString('base64')

  const result = await model.generateContent([
    {
      inlineData: {
        data: base64Audio,
        mimeType: normalizedMime as any,
      },
    },
    `Transcribí este audio palabra por palabra en español rioplatense.
Respondé SOLO con el texto transcripto, sin puntos extra, sin explicaciones, sin comillas.
Si no hay voz o el audio es inaudible, respondé exactamente: [Sin voz detectable]`,
  ])

  const raw = result.response.text().trim()

  // Sanity check: rechazar si Gemini devolvió nuestro propio prompt
  const PROMPT_LEAK_INDICATORS = [
    'Transcribí este audio',
    'palabra por palabra',
    'rioplatense',
    'Sin puntos extra',
  ]
  if (PROMPT_LEAK_INDICATORS.some(s => raw.includes(s))) {
    console.warn('[speechToText] Gemini devolvió el prompt — retornando placeholder')
    return '[Sin voz detectable]'
  }

  return raw || '[Sin voz detectable]'
}

/** Normaliza el MIME type al subconjunto que Gemini acepta para audio */
function normalizeMime(mimeType: string): string {
  const base = mimeType.split(';')[0].trim().toLowerCase()
  const map: Record<string, string> = {
    'audio/ogg':  'audio/ogg',
    'audio/webm': 'audio/webm',
    'audio/mp4':  'audio/mp4',
    'audio/mpeg': 'audio/mpeg',
    'audio/mp3':  'audio/mp3',
    'audio/wav':  'audio/wav',
    'audio/x-m4a': 'audio/mp4',
    'audio/m4a':   'audio/mp4',
    'audio/aac':   'audio/mp4',
    'audio/3gpp':  'audio/mp4',
  }
  return map[base] ?? 'audio/ogg'  // fallback: OGG (más común en WA)
}
