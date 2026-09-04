/**
 * POST /api/analyze-biomass
 * Analiza una foto de pastura y devuelve estimación de biomasa con Gemini.
 */
import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { checkFeatureAccess } from '@/lib/plan-limits'

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

    const { imageBase64, mimeType = 'image/jpeg', imagesBase64 } = await req.json()

    const images = imagesBase64 || (imageBase64 ? [{ base64: imageBase64, mimeType }] : [])

    if (images.length === 0) {
      return NextResponse.json({ success: false, error: 'No images provided' }, { status: 400 })
    }

    // gemini-2.5-flash — multimodal, supports vision and audio
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt = `Eres un experto agronómico especializado en pasturas y forraje del cono sur de América Latina.
Analizá esta foto de pastura/potrero y respondé SOLO con un objeto JSON válido, sin texto adicional, con exactamente estos campos:
{
  "grass_height_cm": número (altura promedio del pasto en centímetros, estima visualmente),
  "coverage_pct": número (cobertura vegetal en %, de 0 a 100),
  "dry_matter_kg_ha": número (materia seca disponible en kg/ha, rango típico 500-4000),
  "pasture_type": texto en español (estimación del tipo de pasto visible, ej: campo natural, alfalfa, agropiro, festuca, etc.),
  "protein_content_pct": número (estimación del porcentaje de proteína bruta en la materia seca, según el estado fenológico y tipo de pasto visible),
  "weeds_detected": arreglo de strings (lista de nombres comunes de las malezas detectadas, o un arreglo vacío si no hay),
  "condition": "OPTIMO" o "BUENO" o "REGULAR" o "BAJO",
  "condition_label": texto en español describiendo el estado (ej: "Pasto en estado óptimo con buena cobertura"),
  "confidence": número de 0 a 100 indicando tu confianza en el análisis,
  "recommendation": texto en español con una recomendación práctica de manejo (ingreso de animales, descanso, etc.),
  "estimated_grazing_days": número estimado de días de pastoreo posibles con 1 EV/ha,
  "notes": texto breve con observaciones adicionales sobre el estado de la pastura
}
Si la imagen NO es de una pastura o pasto, devolvé: {"error": "La imagen no parece ser de una pastura"}
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
