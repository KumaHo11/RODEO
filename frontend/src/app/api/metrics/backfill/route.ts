import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { checkFeatureAccess } from '@/lib/plan-limits'
import { processBackfill } from '@/lib/metrics/backfill-processor'

/**
 * POST /api/metrics/backfill
 *
 * Triggers historical metrics generation for a paddock.
 * Responds immediately with 200. Uses after() to run the heavy
 * processing directly (no HTTP self-call) so it survives navigation
 * and runs within Cloud Run's 300s timeout.
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
    const { paddock_id, year_from = 2020 } = body

    if (!paddock_id) {
      return NextResponse.json({ error: 'paddock_id requerido' }, { status: 400 })
    }

    // Run processing directly in after() — no HTTP self-call.
    // This runs in the same process, inheriting Cloud Run's 300s timeout.
    after(async () => {
      try {
        console.log(`[backfill] Starting: paddock=${paddock_id} year_from=${year_from}`)
        const result = await processBackfill(paddock_id, year_from)
        console.log(`[backfill] Complete:`, JSON.stringify(result))
      } catch (err: any) {
        console.error('[backfill] Error:', err?.message || err)
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
