import { NextRequest, NextResponse } from 'next/server'
import { serviceMutate, serviceQuery } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const CRON_SECRET = process.env.CRON_SECRET
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.rodeoagtech.com'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = req.nextUrl.searchParams
  const paddockId = searchParams.get('paddock_id')
  const yearFromStr = searchParams.get('year_from') || '2020'
  const yearToStr = searchParams.get('year_to') || new Date().getFullYear().toString()

  if (!paddockId) {
    return NextResponse.json({ error: 'paddock_id is required' }, { status: 400 })
  }

  const yearFrom = parseInt(yearFromStr, 10)
  const yearTo = parseInt(yearToStr, 10)

  let processed_months = 0
  let inserted = 0
  let skipped = 0
  const errors: string[] = []

  try {
    const paddockInfo = await serviceQuery<{ org_id: string, geojson: any }>(`
      SELECT p.org_id AS org_id, ST_AsGeoJSON(p.geom)::json AS geojson
      FROM paddocks p
      WHERE p.id = $1 AND p.geom IS NOT NULL
    `, [paddockId])

    if (!paddockInfo.length) {
      return NextResponse.json({ error: 'Paddock not found or missing geometry' }, { status: 404 })
    }

    const { org_id, geojson } = paddockInfo[0]

    const currentDate = new Date()
    const currentYear = currentDate.getFullYear()
    const currentMonth = currentDate.getMonth()

    for (let y = yearFrom; y <= yearTo; y++) {
      for (let m = 0; m < 12; m++) {
        if (y === currentYear && m > currentMonth) break // Don't go into the future
        
        const monthStr = (m + 1).toString().padStart(2, '0')
        const dateStr = `${y}-${monthStr}-01`
        
        processed_months++

        try {
          const indicesRes = await fetch(`${APP_BASE_URL}/api/metrics/indices`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${CRON_SECRET || 'cron'}`,
              'X-Cron-Job': 'metrics-ingest',
            },
            body: JSON.stringify({
              geojson,
              paddock_id: paddockId,
              capture_date: dateStr,
            }),
            signal: AbortSignal.timeout(25_000),
          })

          if (!indicesRes.ok) {
            errors.push(`${dateStr}: HTTP ${indicesRes.status}`)
            skipped++
            continue
          }

          const result = await indicesRes.json()
          const indices: Array<{ metricType: string; value: number; unit: string; confidence: string }> = result.indices || []

          if (indices.length === 0) {
            skipped++
            continue
          }

          const captureDate = result.captureDate || dateStr
          const source = result.source || 'estimated'
          const sceneId = result.sceneId || null
          const cloudCover = result.cloudCover ?? null

          for (const idx of indices) {
            await serviceMutate(`
              INSERT INTO metric_snapshots
                (org_id, paddock_id, metric_type, value, unit, capture_date,
                 source, scene_id, cloud_cover, confidence, metadata)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
              ON CONFLICT DO NOTHING
            `, [
              org_id,
              paddockId,
              idx.metricType,
              idx.value,
              idx.unit || 'index',
              captureDate,
              source,
              sceneId,
              cloudCover,
              idx.confidence || 'HIGH',
              JSON.stringify({ scene_id: sceneId, cloud_cover: cloudCover }),
            ])
            inserted++
          }

        } catch (err: any) {
          errors.push(`${dateStr}: ${err?.message || 'Error'}`)
          skipped++
        }
      }
    }

    return NextResponse.json({
      processed_months,
      processed_paddocks: 1,
      inserted,
      skipped,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}
