/**
 * POST /api/analyze-biomass
 * Analiza una foto de pastura y devuelve estimación de biomasa con Gemini.
 */
export const maxDuration = 60

import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { checkFeatureAccess } from '@/lib/plan-limits'
import { queryOne } from '@/lib/db'
import { IntaContextService } from '@/services/IntaContextService'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Helper: timeout de 60s para llamadas a Gemini
function makeGeminiTimeout(): Promise<never> {
  return new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Gemini timeout after 60s')), 60_000)
  )
}

export async function POST(req: NextRequest) {
  try {
    // Auth Check
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

    const decoded = await verifyFirebaseToken(token)
    if (!decoded) return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 })

    // Plan check
    const hasAccess = await checkFeatureAccess(decoded.uid, 'ai_insights')
    if (!hasAccess) {
      return NextResponse.json({ success: false, error: 'Tu plan no incluye análisis de biomasa IA' }, { status: 403 })
    }

    const { imageBase64, mimeType = 'image/jpeg', imagesBase64, imageUrl, imageUrls, paddockId, herdId } = await req.json()

    // Support imageUrls
    let urlsToFetch = imageUrls || (imageUrl ? [imageUrl] : [])
    let images = imagesBase64 || (imageBase64 ? [{ base64: imageBase64, mimeType }] : [])

    if (images.length === 0 && urlsToFetch.length > 0) {
      try {
        images = await Promise.all(urlsToFetch.map(async (url: string) => {
          const fetchRes = await fetch(url)
          if (!fetchRes.ok) throw new Error(`HTTP ${fetchRes.status} fetching image: ${url}`)
          const buf = Buffer.from(await fetchRes.arrayBuffer())
          const detectedMime = fetchRes.headers.get('content-type')?.split(';')[0] || 'image/jpeg'
          return { base64: buf.toString('base64'), mimeType: detectedMime }
        }))
      } catch (fetchErr: any) {
        return NextResponse.json({ success: false, error: `No se pudo obtener la imagen: ${fetchErr.message}` }, { status: 400 })
      }
    }

    if (images.length === 0) {
      return NextResponse.json({ success: false, error: 'No images provided' }, { status: 400 })
    }

    // gemini-2.5-flash — multimodal, supports vision and audio
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    let lat: number | null = null
    let lng: number | null = null

    if (paddockId) {
      try {
        const row = await queryOne<{ lat: number, lng: number }>(`
          SELECT ST_Y(ST_Centroid(geom)) as lat, ST_X(ST_Centroid(geom)) as lng 
          FROM paddocks 
          WHERE id = $1
        `, [paddockId])
        if (row) {
          lat = row.lat
          lng = row.lng
        }
      } catch (e) {
        console.error("Error fetching paddock location:", e)
      }
    }

    const currentMonth = new Date().toLocaleString('es', { month: 'long' });
    const intaContext = await IntaContextService.getContext(lat, lng)

    const prompt = `Eres un experto agronómico evaluando un lote en la región: ${intaContext.region}.
Mes actual: ${currentMonth}.
Especies INTA predominantes de la zona: ${intaContext.species}.
REGLA ESTRICTA DE CONVERSIÓN (Base INTA): ${intaContext.conversionRules} (Usa esta regla para calcular la Materia Seca a partir de la altura y cobertura visual).
Analiza las imágenes proporcionadas y extrae la información requerida cumpliendo ESTRICTAMENTE el esquema JSON definido. No justifiques ni uses markdown.

{
  "estimated_dry_matter_kg_ha": número (materia seca disponible en kg/ha),
  "confidence_interval": { "min": número, "max": número },
  "predominant_species": arreglo de strings (especies detectadas),
  "average_height_cm": número (altura promedio del pasto en cm),
  "ground_cover_percentage": número (cobertura vegetal de 0 a 100),
  "growth_stage": "vegetativo" | "reproductivo" | "senescente",
  "pasture_status": "optimo" | "bajo" | "pasado",
  "regional_context_note": "Cálculo base INTA - ${intaContext.region} (${currentMonth})",
  "recommendation": texto (recomendación práctica)
}
Respondé SOLO con el JSON, sin markdown, sin bloques de código, sin explicaciones.`

    const imageParts = images.map((img: any) => ({
      inlineData: {
        data: img.base64,
        mimeType: img.mimeType as any,
      },
    }))

    const result = await Promise.race([
      model.generateContent([...imageParts, prompt]),
      makeGeminiTimeout(),
    ])

    const text = result.response.text().trim()

    // Strip markdown code fences if model wraps in ```json ... ```
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('Biomass: no JSON in response:', text)
      return NextResponse.json({ success: false, error: 'No se pudo parsear la respuesta de IA', raw: text }, { status: 500 })
    }

    const data = JSON.parse(jsonMatch[0])

    if (data.error) {
      return NextResponse.json({ success: false, error: data.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    const isTimeout = err?.message?.includes('timeout')
    console.error('Gemini analyze-biomass error:', err)
    return NextResponse.json(
      { success: false, error: isTimeout ? 'El análisis tardó demasiado, intentá nuevamente' : (err.message || 'Error en análisis de IA') },
      { status: isTimeout ? 504 : 500 }
    )
  }
}
