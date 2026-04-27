/**
 * lib/speechToText.ts
 * Transcripción de audio usando Google Cloud Speech-to-Text v1.
 * Acepta Buffer de audio ogg/opus o webm (típico de WhatsApp).
 */

import { SpeechClient } from '@google-cloud/speech'

let _client: SpeechClient | null = null

function getClient() {
  if (_client) return _client

  // En prod se inyecta como JSON string en env
  if (process.env.GOOGLE_CLOUD_KEY_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_CLOUD_KEY_JSON)
    _client = new SpeechClient({ credentials })
  } else {
    // Dev: usa GOOGLE_APPLICATION_CREDENTIALS (path al .json)
    _client = new SpeechClient()
  }
  return _client
}

/**
 * Transcribe un buffer de audio.
 * @param audioBuffer  Buffer del archivo de audio
 * @param mimeType     MIME type ('audio/ogg; codecs=opus' | 'audio/webm' | etc.)
 * @returns            Texto transcripto, o '[Sin voz detectable]' si no hay voz
 */
export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const client = getClient()

  // Mapeo de MIME a encoding de Google STT
  const encodingMap: Record<string, string> = {
    'audio/ogg': 'OGG_OPUS',
    'audio/ogg; codecs=opus': 'OGG_OPUS',
    'audio/webm': 'WEBM_OPUS',
    'audio/webm; codecs=opus': 'WEBM_OPUS',
    'audio/mp4': 'MP3',
    'audio/mpeg': 'MP3',
    'audio/mp3': 'MP3',
  }
  const baseMime = mimeType.split(';')[0].trim()
  const encoding = encodingMap[baseMime] ?? 'OGG_OPUS'

  const [response] = await client.recognize({
    audio: { content: audioBuffer.toString('base64') },
    config: {
      encoding: encoding as any,
      sampleRateHertz: 16000,
      languageCode: 'es-AR',
      alternativeLanguageCodes: ['es-419', 'es-ES'],
      model: 'latest_long',
      enableAutomaticPunctuation: true,
    },
  })

  const transcript = response.results
    ?.map(r => r.alternatives?.[0]?.transcript ?? '')
    .join(' ')
    .trim()

  return transcript || '[Sin voz detectable]'
}
