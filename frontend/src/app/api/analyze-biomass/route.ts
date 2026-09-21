/**
 * POST /api/analyze-biomass
 * Analiza una foto de pastura y devuelve estimación de biomasa con Gemini.
 */
export const maxDuration = 60

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

    const { imageBase64, mimeType = 'image/jpeg', imagesBase64, imageUrl } = await req.json()

    // Support imageUrl: server fetches the image and converts to base64
    // Used for direct analysis from a field_note's photo_url (GCS)
    let images = imagesBase64 || (imageBase64 ? [{ base64: imageBase64, mimeType }] : [])
    if (images.length === 0 && imageUrl) {
      try {
        const fetchRes = await fetch(imageUrl)
        if (!fetchRes.ok) throw new Error(`HTTP ${fetchRes.status} fetching image`)
        const buf = Buffer.from(await fetchRes.arrayBuffer())
        const detectedMime = fetchRes.headers.get('content-type')?.split(';')[0] || 'image/jpeg'
        images = [{ base64: buf.toString('base64'), mimeType: detectedMime }]
      } catch (fetchErr: any) {
        return NextResponse.json({ success: false, error: `No se pudo obtener la imagen: ${fetchErr.message}` }, { status: 400 })
      }
    }

    if (images.length === 0) {
      return NextResponse.json({ success: false, error: 'No images provided' }, { status: 400 })
    }

    // gemini-2.5-flash — multimodal, supports vision and audio
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt = `Eres un experto agronómico especializado en pasturas y forraje del cono sur de América Latina.
Analizá esta(s) foto(s) de pastura/potrero y respondé SOLO con un objeto JSON válido, sin texto adicional, con exactamente estos campos:
{
  "dominant_species": texto en español (especie o familia dominante visible, ej: "Festuca arundinacea", "Agropiro", "Campo natural - gramíneas estivales", "Alfalfa"),
  "grass_height_cm": número (altura promedio del pasto en centímetros, estimado visualmente),
  "coverage_pct": número (cobertura vegetal en %, de 0 a 100),
  "phenological_stage": texto en español (estado fenológico, ej: "Vegetativo", "Elongación", "Espigazon", "Floración", "Senescencia", "Reposo invernal"),
  "green_ratio_pct": número (porcentaje de material verde respecto al total de biomasa visible, de 0 a 100),
  "dry_matter_kg_ha": número (materia seca disponible en kg/ha, rango típico 500-4000),
  "protein_content_pct": número (estimación del porcentaje de proteína cruda en la materia seca según estado fenológico y especie),
  "suggested_remnant_pct": número (porcentaje de remanente objetivo sugerido tras el pastoreo, de 0 a 100),
  "weeds_detected": arreglo de strings (nombres comunes de malezas detectadas, o arreglo vacío),
  "condition": "OPTIMO" o "BUENO" o "REGULAR" o "BAJO",
  "condition_label": texto breve describiendo el estado fenológico y de cobertura (ej: "Vegetativo con alta cobertura", "Elongación temprana, buen verde"),
  "confidence": número de 0 a 100 indicando tu confianza en el análisis,
  "recommendation": texto en español con UNA recomendación práctica de manejo. DEBE ser accionable y referirse a: (a) momento de ingreso o salida de animales, (b) remanente objetivo en cm o % de biomasa a dejar para garantizar la recuperación del forraje, y/o (c) período de descanso estimado. Ejemplos correctos: "Retirar los animales cuando el remanente llegue a 10 cm de altura (\u224040% de biomasa) para asegurar una rápida rebrota." / "Ingresar ahora y mantener un descanso de 25 días tras el pastoreo para permitir la recuperación completa." / "Esperar 12-15 días más antes del ingreso para que el forraje alcance altura óptima de consumo." NUNCA describir el estado del pasto en positivo (como ‘el pasto está excelente’ o ‘alta calidad’) sino dar una acción concreta de manejo rotativo o de recuperación.,
  "alert_level": "NINGUNA" o "MODERADA" o "URGENTE" (si hay algún problema urgente de manejo),
  "alert_reason": texto breve explicando la alerta si alert_level no es NINGUNA, o null,
  "estimated_grazing_days": número estimado de días de pastoreo posibles con 1 EV/ha,
  "notes": texto breve con observaciones adicionales sobre especie, malezas u otras condiciones observadas
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
