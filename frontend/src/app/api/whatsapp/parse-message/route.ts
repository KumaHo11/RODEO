/**
 * POST /api/whatsapp/parse-message
 *
 * Interpreta un mensaje de WhatsApp (texto ya transcripto) usando Gemini,
 * inyectando el contexto del campo del usuario (potreros, rodeos).
 *
 * Diseño:
 *  - Si confidence ≥ 85 → sugiere la acción y la guarda como FieldNote PENDING
 *  - Si confidence  < 85 → guarda igual pero el operador deberá validarla en la UI
 *  - Cero fricción para el peón: él envía, el sistema interpreta, el admin valida
 *
 * Input (JSON):
 *   { orgId, profileId, rawText, mediaUrl?, wamid?, occurredAt? }
 *
 * Output (JSON):
 *   { fieldNoteId, intent, confidence, entities, suggestion?, analysisResult }
 */

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import prisma from '@/lib/prisma'

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de intención que el parser puede detectar
// ─────────────────────────────────────────────────────────────────────────────
export type ParsedIntent =
  | 'HERD_MOVE'          // Movimiento de rodeo entre potreros
  | 'BIRTH'              // Nacimiento de animales
  | 'DEATH'              // Mortandad
  | 'RAINFALL'           // Lluvia / mm
  | 'OBSERVATION'        // Observación general (salud, pasturas, etc.)
  | 'TASK'               // Tarea / pendiente reportado
  | 'UNKNOWN'

interface ParseResult {
  intent: ParsedIntent
  confidence: number          // 0-100
  entities: {
    herd_name?: string        // Rodeo mencionado (raw)
    herd_id?: string          // Resuelto por fuzzy match
    from_paddock_name?: string
    from_paddock_id?: string
    to_paddock_name?: string
    to_paddock_id?: string
    head_count?: number
    birth_count?: number
    death_count?: number
    rainfall_mm?: number
    observation?: string
  }
  title: string
  content: string             // Texto limpio generado por el LLM
  suggestion?: string         // Acción sugerida para el planificador
  needsReview: boolean        // true si confidence < 85
}

// ─────────────────────────────────────────────────────────────────────────────
// Fuzzy matching simple: Levenshtein normalizado
// Retorna la entidad más cercana si supera el umbral
// ─────────────────────────────────────────────────────────────────────────────
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return dp[m][n]
}

function fuzzyMatch<T extends { id: string; name: string }>(
  query: string,
  candidates: T[],
  threshold = 0.75
): T | null {
  if (!query || candidates.length === 0) return null
  const q = query.toLowerCase().trim()
  let best: T | null = null
  let bestScore = 0
  for (const c of candidates) {
    const name = c.name.toLowerCase()
    const maxLen = Math.max(q.length, name.length)
    if (maxLen === 0) continue
    const dist = levenshtein(q, name)
    const score = 1 - dist / maxLen
    if (score > bestScore) { bestScore = score; best = c }
  }
  return bestScore >= threshold ? best : null
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler principal
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })

  let body: {
    orgId: string
    profileId: string
    rawText: string
    mediaUrl?: string
    wamid?: string
    occurredAt?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { orgId, profileId, rawText, mediaUrl, wamid, occurredAt } = body

  if (!orgId || !profileId || !rawText?.trim()) {
    return NextResponse.json({ error: 'orgId, profileId y rawText son requeridos' }, { status: 400 })
  }

  // ── 1. Cargar contexto del campo ──────────────────────────────────────────
  const [paddocks, herds] = await Promise.all([
    prisma.paddock.findMany({
      where: { orgId, isActive: true },
      select: { id: true, name: true },
    }),
    prisma.herd.findMany({
      where: { orgId },
      select: { id: true, name: true },
    }),
  ])

  const paddockList = paddocks.map(p => p.name).join(', ')
  const herdList    = herds.map(h => h.name).join(', ')

  // ── 2. Prompt con contexto del campo ─────────────────────────────────────
  const systemPrompt = `
Sos un asistente de ganadería que interpreta mensajes de WhatsApp enviados por peones y capataces de campo.
Tu tarea es extraer información estructurada del mensaje.

CONTEXTO DEL CAMPO:
- Potreros disponibles: ${paddockList || '(ninguno registrado)'}
- Rodeos disponibles: ${herdList || '(ninguno registrado)'}

REGLAS CRÍTICAS:
1. Si mencionan un potrero o rodeo con nombre similar pero no exacto (ej. "el bajo" → "El Bajo Norte"), 
   usá el más parecido y ajustá el confidence hacia abajo.
2. Si no podés identificar claramente el potrero o rodeo destino, bajá el confidence por debajo de 85.
3. Nunca inventes nombres de potreros o rodeos que no estén en el contexto.
4. El campo "confidence" va de 0 a 100: 100 = certeza total, 0 = no entendí nada.
5. Usá "UNKNOWN" como intent solo si el mensaje no tiene relación con ganadería.

TIPOS DE INTENT:
- HERD_MOVE: movimiento de animales entre potreros
- BIRTH: nacimientos
- DEATH: mortandad / animales muertos
- RAINFALL: lluvia en milímetros
- OBSERVATION: observación general del campo
- TASK: tarea o pendiente
- UNKNOWN: no relacionado

Respondé ÚNICAMENTE con JSON válido, sin markdown ni explicaciones.
`.trim()

  const userMessage = `Mensaje del campo: "${rawText}"`

  // ── 3. Llamar a Gemini con output estructurado ────────────────────────────
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.5-flash-lite',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          intent:             { type: SchemaType.STRING },
          confidence:         { type: SchemaType.NUMBER },
          title:              { type: SchemaType.STRING },
          content:            { type: SchemaType.STRING },
          suggestion:         { type: SchemaType.STRING },
          entities: {
            type: SchemaType.OBJECT,
            properties: {
              herd_name:         { type: SchemaType.STRING },
              from_paddock_name: { type: SchemaType.STRING },
              to_paddock_name:   { type: SchemaType.STRING },
              head_count:        { type: SchemaType.NUMBER },
              birth_count:       { type: SchemaType.NUMBER },
              death_count:       { type: SchemaType.NUMBER },
              rainfall_mm:       { type: SchemaType.NUMBER },
              observation:       { type: SchemaType.STRING },
            },
          },
        },
        required: ['intent', 'confidence', 'title', 'content', 'entities'],
      },
    },
  })

  let parsed: ParseResult
  try {
    const result = await model.generateContent([
      { text: systemPrompt },
      { text: userMessage },
    ])
    parsed = JSON.parse(result.response.text()) as ParseResult
  } catch (e) {
    console.error('[parse-message] Gemini error:', e)
    return NextResponse.json({ error: 'Error al procesar con IA' }, { status: 502 })
  }

  // ── 4. Fuzzy matching del contexto ────────────────────────────────────────
  const ents = parsed.entities ?? {}

  const matchedHerd        = fuzzyMatch(ents.herd_name        ?? '', herds)
  const matchedFromPaddock = fuzzyMatch(ents.from_paddock_name ?? '', paddocks)
  const matchedToPaddock   = fuzzyMatch(ents.to_paddock_name   ?? '', paddocks)

  // Si había nombre pero no hubo match → bajar confidence
  let confidence = Math.min(100, Math.max(0, Math.round(parsed.confidence ?? 50)))
  if (ents.herd_name        && !matchedHerd)        confidence = Math.min(confidence, 70)
  if (ents.from_paddock_name && !matchedFromPaddock) confidence = Math.min(confidence, 70)
  if (ents.to_paddock_name   && !matchedToPaddock)   confidence = Math.min(confidence, 70)

  const needsReview = confidence < 85

  // ── 5. Guardar como FieldNote en la DB ───────────────────────────────────
  const analysisResult = {
    intent:     parsed.intent,
    confidence,
    needsReview,
    entities: {
      ...ents,
      herd_id:          matchedHerd?.id          ?? null,
      from_paddock_id:  matchedFromPaddock?.id   ?? null,
      to_paddock_id:    matchedToPaddock?.id      ?? null,
    },
    suggestion: parsed.suggestion ?? null,
    raw:        rawText,
  }

  // Deduplicación por wamid (si ya existe, retorna el existente)
  if (wamid) {
    const existing = await prisma.fieldNote.findUnique({
      where: { whatsappMsgId: wamid },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json({ fieldNoteId: existing.id, ...analysisResult, cached: true })
    }
  }

  const fieldNote = await prisma.fieldNote.create({
    data: {
      orgId,
      createdBy:      profileId,
      paddockId:      matchedToPaddock?.id ?? matchedFromPaddock?.id ?? null,
      title:          parsed.title,
      content:        parsed.content,
      source:         'WHATSAPP',
      status:         needsReview ? 'PENDING' : 'APPROVED',
      analysisResult,
      whatsappMsgId:  wamid ?? null,
      occurredAt:     occurredAt ? new Date(occurredAt) : new Date(),
      audioUrl:       mediaUrl ?? null,
    },
  })

  return NextResponse.json({
    fieldNoteId:    fieldNote.id,
    intent:         parsed.intent,
    confidence,
    needsReview,
    entities:       analysisResult.entities,
    suggestion:     parsed.suggestion ?? null,
    title:          parsed.title,
    content:        parsed.content,
    analysisResult,
  })
}
