import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { checkFeatureAccess } from '@/lib/plan-limits'

/**
 * POST /api/metrics/backfill
 * Dispara el backfill histórico para un potrero desde la UI.
 * Responde inmediatamente. Usa after() para que el proceso corra aunque
 * el usuario navegue a otra pantalla (sobrevive en Cloud Run).
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth || !auth.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasAccess = await checkFeatureAccess(auth.uid, 'metrics_module')
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'El módulo de Metrics requiere plan HOLISTICO o superior.' },
        { status: 403 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const { paddock_id, year_from = 2019 } = body

    if (!paddock_id) {
      return NextResponse.json({ error: 'paddock_id requerido' }, { status: 400 })
    }

    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      return NextResponse.json(
        { error: 'CRON_SECRET no configurado en el servidor' },
        { status: 500 }
      )
    }

    const baseUrl =
      process.env.NEXTAUTH_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000'

    const backfillUrl = `${baseUrl}/api/cron/metrics-backfill?paddock_id=${paddock_id}&year_from=${year_from}`

    // ✅ after() keeps the process alive in Cloud Run after the response is sent.
    // Without this, navigating away kills the background fetch (CPU throttled).
    after(async () => {
      try {
        console.log(`[backfill] Starting background job: paddock=${paddock_id} year_from=${year_from}`)
        const res = await fetch(backfillUrl, {
          method: 'GET',
          headers: { Authorization: `Bearer ${cronSecret}` },
        })
        const text = await res.text()
        console.log(`[backfill] Job done: status=${res.status} | ${text.substring(0, 200)}`)
      } catch (err: any) {
        console.error('[backfill] Background error:', err?.message)
      }
    })

    return NextResponse.json({
      ok: true,
      background: true,
      message: `Backfill iniciado para potrero ${paddock_id}. Datos disponibles en 2–5 min.`,
    })

  } catch (err: any) {
    console.error('[/api/metrics/backfill]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
