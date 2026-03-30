import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = await req.json()

    if (!imageBase64) {
      return NextResponse.json({ success: false, error: 'No image provided' }, { status: 400 })
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })




    const prompt = `Eres un experto agronómico especializado en pasturas y forraje del cono sur de América Latina.
Analizá esta foto de pastura/potrero y respondé SOLO con un objeto JSON válido, sin texto adicional, con exactamente estos campos:
{
  "grass_height_cm": número (altura promedio del pasto en centímetros, estima visualmente),
  "coverage_pct": número (cobertura vegetal en %, de 0 a 100),
  "dry_matter_kg_ha": número (materia seca disponible en kg/ha, rango típico 500-4000),
  "condition": "OPTIMO" o "BUENO" o "REGULAR" o "BAJO",
  "condition_label": texto en español describiendo el estado (ej: "Pasto en estado óptimo con buena cobertura"),
  "confidence": número de 0 a 100 indicando tu confianza en el análisis,
  "recommendation": texto en español con una recomendación práctica de manejo (ingreso de animales, descanso, etc.),
  "estimated_grazing_days": número estimado de días de pastoreo posibles con 1 EV/ha,
  "notes": texto breve con observaciones adicionales sobre el estado de la pastura
}
Si la imagen NO es de una pastura o pasto, devolvé: {"error": "La imagen no parece ser de una pastura"}
Respondé SOLO con el JSON, sin markdown, sin explicaciones.`

    const result = await model.generateContent([
      {
        inlineData: {
          data: imageBase64,
          mimeType: mimeType as any,
        },
      },
      prompt,
    ])

    const text = result.response.text().trim()

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ success: false, error: 'No se pudo parsear la respuesta de IA' }, { status: 500 })
    }

    const data = JSON.parse(jsonMatch[0])

    if (data.error) {
      return NextResponse.json({ success: false, error: data.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    console.error('Gemini analyze error:', err)
    return NextResponse.json({ success: false, error: err.message || 'Error en análisis de IA' }, { status: 500 })
  }
}
