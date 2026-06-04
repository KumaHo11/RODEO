/**
 * POST /api/transcribe-audio
 * Recibe un archivo de audio (multipart/form-data), lo transcribe con Gemini y
 * devuelve además la categoría detectada, el potrero mencionado y las tareas pendientes.
 *
 * Body (FormData):
 *   file: Blob  (audio/webm | audio/mp4 | audio/ogg)
 *
 * Response:
 *   { transcript, category, paddock_hint, tasks, confidence }
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { checkFeatureAccess } from '@/lib/plan-limits'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

const VALID_CATEGORIES = [
  'INFRAESTRUCTURA', 'SANIDAD_VEGETAL', 'GANADO',
  'BIOMASA', 'HIDRICO', 'RESTRICCION', 'GENERAL',
] as const

export async function POST(req: NextRequest) {
  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const token = req.headers.get('authorization')?.replace('Bearer ', '').trim() || ''
    if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    const decoded = await verifyFirebaseToken(token)
    if (!decoded) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    // ── Plan Check ────────────────────────────────────────────────────────────
    const hasAccess = await checkFeatureAccess(decoded.uid, 'voice_bitacora')
    if (!hasAccess) {
      return NextResponse.json({ error: 'Tu plan no incluye transcripción de audio' }, { status: 403 })
    }

    // ── File ──────────────────────────────────────────────────────────────────
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const base64Audio = Buffer.from(bytes).toString('base64')
    const mimeType = (file.type || 'audio/webm') as string

    // ── Gemini ────────────────────────────────────────────────────────────────
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const result = await model.generateContent([
      { inlineData: { data: base64Audio, mimeType: mimeType as any } },
      `Sos el asistente de campo de RODEO, sistema de gestión ganadera regenerativa.
Audio grabado por un capataz o recorredor en Argentina.

Analizá el audio y respondé ÚNICAMENTE con un objeto JSON (sin markdown, sin texto extra):
{
  "transcript": "<transcripción literal en español rioplatense>",
  "category": "<una de las categorías de abajo>",
  "paddock_hint": "<nombre del potrero mencionado, o null>",
  "tasks": ["<tarea pendiente concreta>"],
  "confidence": <0.0 a 1.0>
}

CATEGORÍAS (elegí la más relevante):
• GANADO — animales, vacas, terneros, toros, partos, cojera, sanidad animal, peso, rodeo
• INFRAESTRUCTURA — alambrados, aguadas, bebederos, corrales, mangas, bombas, bretes, postes, tranqueras
• SANIDAD_VEGETAL — malezas, plagas, hongos, enfermedades de pasturas
• BIOMASA — pasto, forraje, materia seca, pasturas, rebrote, cobertura vegetal
• HIDRICO — agua, inundación, sequía, napa, aguada sin agua
• RESTRICCION — área vedada, acceso bloqueado, peligro
• GENERAL — todo lo demás, o si no podés categorizar con confianza > 0.6

PADDOCK HINT: extraé cualquier referencia a potrero, lote, número o nombre propio (ej: "Lote 4", "el norte", "la laguna"). Si no hay mención clara, devolvé null.
TASKS: solo acciones concretas y pendientes ("revisar vaca coja", "arreglar alambrado sur"). Lista vacía si no hay.
Si el audio es inaudible o no tiene voz: transcript "[Sin voz detectable]", category "GENERAL", confidence 0.`,
    ])

    const rawText = result.response.text().trim()

    // ── Parse con fallback ────────────────────────────────────────────────────
    let parsed: {
      transcript: string
      category: string
      paddock_hint: string | null
      tasks: string[]
      confidence: number
    }

    try {
      const cleaned = rawText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim()
      parsed = JSON.parse(cleaned)
    } catch {
      // Gemini devolvió texto plano → lo usamos como transcripción
      parsed = {
        transcript: rawText || '[Sin voz detectable]',
        category: 'GENERAL',
        paddock_hint: null,
        tasks: [],
        confidence: 0,
      }
    }

    // Validar category
    const category = VALID_CATEGORIES.includes(parsed.category as any)
      ? parsed.category
      : 'GENERAL'

    return NextResponse.json({
      transcript:   parsed.transcript   || '[Sin voz detectable]',
      category,
      paddock_hint: parsed.paddock_hint || null,
      tasks:        Array.isArray(parsed.tasks) ? parsed.tasks.filter(Boolean) : [],
      confidence:   typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0,
    })

  } catch (err: any) {
    console.error('POST /api/transcribe-audio error:', err)
    return NextResponse.json(
      { error: 'Error al transcribir', detail: err.message },
      { status: 500 }
    )
  }
}
