import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '').trim() || ''
    const decoded = token ? await verifyFirebaseToken(token) : null
    if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { photo, paddock_id } = await req.json()
    if (!photo) return NextResponse.json({ error: 'No photo provided' }, { status: 400 })

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    // Decode base64 — strip data URI prefix if present
    const base64Data = photo.replace(/^data:image\/[a-z]+;base64,/, '')
    const mimeMatch = photo.match(/^data:(image\/[a-z]+);base64,/)
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg'

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const prompt = `Sos un experto en manejo holístico de pasturas y ganadería regenerativa.
Analizá esta foto de un potrero luego de un pastoreo rotacional.

Por favor devolvé SOLO un JSON válido (sin markdown, sin bloques de código) con esta estructura exacta:
{
  "dry_matter_kg_ha": <número estimado de kg de materia seca por hectárea visible, entre 200 y 4000>,
  "cover_pct": <porcentaje de cobertura del suelo visible, 0-100>,
  "condition": "EXCELENTE" | "BUENO" | "REGULAR" | "POBRE",
  "description": "<descripción en español de 1-2 oraciones sobre el estado del remanente>"
}

Estimá la materia seca residual en base a la altura y densidad del pasto visible.
Si el remanente es menor a 800 kg MS/ha, la condición debe ser POBRE.
Si es 800-1200, REGULAR. Si es 1200-1800, BUENO. Si supera 1800, EXCELENTE.`

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType as any,
        }
      },
      { text: prompt }
    ])

    const text = result.response.text().trim()

    // Parse JSON response
    let parsed: any = {}
    try {
      // Remove any potential markdown wrapping
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      // If parse fails, return a structured estimate
      parsed = {
        dry_matter_kg_ha: 1000,
        cover_pct: 60,
        condition: 'REGULAR',
        description: text.slice(0, 200),
      }
    }

    return NextResponse.json(parsed)
  } catch (err: any) {
    console.error('[analyze-remnant]', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}
