import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType, species } = await req.json()
    if (!imageBase64) return NextResponse.json({ success: false, error: 'No image provided' }, { status: 400 })

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt = `Eres un veterinario y nutricionista animal experto en ganadería bovina, ovina y equina del Cono Sur de América Latina, especializado en evaluación de condición corporal (CC / BCS - Body Condition Score).

Analizá esta imagen de un animal o rebaño (especie principal: ${species || 'bovino'}) y respondé SOLO con un objeto JSON válido, sin texto adicional, sin markdown, sin comillas de bloque de código.

El JSON debe tener exactamente estos campos:
{
  "bcs_score": número con un decimal (escala 1-5 para bovinos/ovinos, 1-9 para equinos),
  "bcs_scale": "1-5" o "1-9",
  "condition_label": "MUY FLACO" | "FLACO" | "MODERADO" | "BUENO" | "OBESO",
  "condition_es": descripción en español del estado corporal observado (1-2 oraciones),
  "visible_signs": array de strings con señales visibles observadas (ej: ["costillas visibles", "grupa hundida", "lomo estrecho"]),
  "recommendation": recomendación práctica en español para el ganadero (2-3 oraciones),
  "nutritional_status": "DEFICIENTE" | "BAJO" | "OPTIMO" | "EXCESO",
  "estimated_weight_kg": number estimado de peso vivo del animal en kg (o null si no se puede estimar),
  "alert_level": "NINGUNA" | "ATENCION" | "URGENTE",
  "alert_reason": razón de la alerta en español (o null si no hay alerta),
  "confidence": número entre 0 y 1 indicando confianza del análisis,
  "animal_count_visible": número de animales visibles en la imagen (1 si es solo uno)
}`

    const result = await model.generateContent([
      {
        inlineData: {
          data: imageBase64,
          mimeType: mimeType || 'image/jpeg',
        },
      },
      prompt,
    ])

    const text = result.response.text().trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No se pudo parsear la respuesta de la IA')

    const data = JSON.parse(jsonMatch[0])
    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    console.error('[analyze-body-condition]', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
