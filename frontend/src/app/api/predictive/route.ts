import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { checkFeatureAccess } from '@/lib/plan-limits'

const PARSER_SERVICE_URL = process.env.PARSER_SERVICE_URL || 'http://localhost:8000'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const decoded = await verifyFirebaseToken(token)
    if (!decoded) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    // Plan check
    const hasAccess = await checkFeatureAccess(decoded.uid, 'ai_insights')
    if (!hasAccess) {
      return NextResponse.json({ error: 'Tu plan no incluye modelos predictivos' }, { status: 403 })
    }

    const body = await req.json()
    const { type, ...params } = body

    let endpoint = ''
    if (type === 'financial') endpoint = '/api/insights/financial-scenarios'
    else if (type === 'climate') endpoint = '/api/predictions/biomass-growth'
    else return NextResponse.json({ error: 'Tipo de predicción inválido' }, { status: 400 })

    const response = await fetch(`${PARSER_SERVICE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({ error: 'Error en el servicio predictivo', details: errorText }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (err: any) {
    console.error('Predictive API error:', err)
    return NextResponse.json({ error: 'Error interno: ' + err.message }, { status: 500 })
  }
}
