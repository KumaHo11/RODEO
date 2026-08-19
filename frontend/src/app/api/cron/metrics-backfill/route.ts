import { NextRequest, NextResponse } from 'next/server'
import { processBackfill } from '@/lib/metrics/backfill-processor'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const CRON_SECRET = process.env.CRON_SECRET

/**
 * GET /api/cron/metrics-backfill?paddock_id=xxx&year_from=2019
 *
 * Thin wrapper for Cloud Scheduler. Auth via CRON_SECRET.
 * All processing logic lives in backfill-processor.ts.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const paddockId   = req.nextUrl.searchParams.get('paddock_id')
  const yearFromStr = req.nextUrl.searchParams.get('year_from') || '2019'
  const yearToStr   = req.nextUrl.searchParams.get('year_to')

  if (!paddockId) {
    return NextResponse.json({ error: 'paddock_id is required' }, { status: 400 })
  }

  try {
    const result = await processBackfill(
      paddockId,
      parseInt(yearFromStr, 10),
      yearToStr ? parseInt(yearToStr, 10) : undefined,
    )
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[cron/metrics-backfill]', err)
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}
