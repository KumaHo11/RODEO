import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { checkFeatureAccess } from '@/lib/plan-limits'

/**
 * POST /api/metrics/backfill
 * Dispara el backfill histórico para un potrero específico desde la UI.
 * Protegido por sesión de usuario (no requiere CRON_SECRET).
 * Solo disponible para HOLISTICO+ (metrics_module).
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth || !auth.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Feature gate — checkFeatureAccess recibe uid
    const hasAccess = await checkFeatureAccess(auth.uid, 'metrics_module')
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'El módulo de Metrics requiere plan HOLISTICO o superior.' },
        { status: 403 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const { paddock_id, year_from = 2020 } = body

    if (!paddock_id) {
      return NextResponse.json({ error: 'paddock_id requerido' }, { status: 400 })
    }

    // Llamar al cron de backfill internamente con el CRON_SECRET del servidor
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

    const backfillRes = await fetch(backfillUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
      // No esperamos a que termine — timeout de 25s (límite de Cloud Run de respuesta)
      signal: AbortSignal.timeout(25_000),
    })

    if (!backfillRes.ok) {
      const errText = await backfillRes.text()
      return NextResponse.json(
        { error: 'Error en el backfill', details: errText },
        { status: 502 }
      )
    }

    const result = await backfillRes.json()
    return NextResponse.json({
      ok: true,
      message: `Backfill iniciado para potrero ${paddock_id}`,
      ...result,
    })
  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      // El backfill sigue corriendo en background — esto es OK
      return NextResponse.json({
        ok: true,
        message: 'Backfill iniciado en background. Los datos estarán disponibles en unos minutos.',
        background: true,
      })
    }
    console.error('[/api/metrics/backfill]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
