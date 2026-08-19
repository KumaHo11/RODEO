import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { checkFeatureAccess } from '@/lib/plan-limits'

/**
 * POST /api/metrics/backfill
 * Dispara el backfill histórico para un potrero específico desde la UI.
 * Protegido por sesión de usuario (no requiere CRON_SECRET).
 * Solo disponible para HOLISTICO+ (metrics_module).
 * Responde inmediatamente con 202 y corre el backfill en background.
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

    // 🔥 Fire-and-forget: dispatch without awaiting — prevents 408 timeout
    // The cron will run in background and populate metric_snapshots
    fetch(backfillUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
    }).catch((err) => {
      console.error('[/api/metrics/backfill] Background cron error:', err?.message)
    })

    // Respond immediately so the client doesn't timeout
    return NextResponse.json({
      ok: true,
      background: true,
      message: `Backfill iniciado en segundo plano para potrero ${paddock_id}. Los datos aparecerán en 2-5 minutos.`,
    })

  } catch (err: any) {
    console.error('[/api/metrics/backfill]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
