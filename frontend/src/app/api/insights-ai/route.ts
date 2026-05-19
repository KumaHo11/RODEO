import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { checkFeatureAccess } from '@/lib/plan-limits'

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Missing GEMINI_API_KEY' }, { status: 500 })

  // 1. Auth check
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const decoded = await verifyFirebaseToken(token)
  if (!decoded) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  // 2. Plan check
  const hasAccess = await checkFeatureAccess(decoded.uid, 'ai_insights')
  if (!hasAccess) {
    return NextResponse.json({ error: 'Tu plan no incluye Insights IA' }, { status: 403 })
  }

  const { context } = await req.json()
  if (!context) return NextResponse.json({ error: 'No context' }, { status: 400 })

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-flash-lite-latest' })




  const prompt = `Eres un experto en pastoreo holístico (Savory Institute) y ganadería regenerativa en el Río de la Plata.
Basándote en los siguientes datos de un sistema ganadero real, genera UNA recomendación práctica y concreta (máximo 3 oraciones) para el productor. La recomendación debe ser accionable HOY o esta semana.

Datos del campo:
- Potreros totales: ${context.paddocks}
- Superficie total: ${context.totalHa?.toFixed?.(1)} ha
- Rodeos: ${context.herds}
- Animales totales: ${context.totalAnimals}
- Equivalentes vaca (EV): ${context.totalEV}
- Carga animal: ${context.stockingRate} EV/ha
- Potreros con pastoreo activo ahora: ${context.activePlans}
- Potreros en descanso: ${context.restingPaddocks}
- Biomasa disponible (último análisis): ${context.lastBiomassMs ? context.lastBiomassMs + ' kg MS/ha' : 'sin datos'}
- Días desde último movimiento: ${context.daysSinceLastMove ?? 'sin datos'}
- Eventos próximos (30d): ${context.upcomingEvents}
- Score holístico actual: ${context.score}/100

Responde SOLO con la recomendación. Sin introducción ni cierre. En español rioplatense. Máximo 3 oraciones.`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()
    return NextResponse.json({ recommendation: text })
  } catch (err) {
    return NextResponse.json({ error: 'Gemini error', details: String(err) }, { status: 500 })
  }
}
