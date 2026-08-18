/**
 * GET /api/cron/metrics-ingest
 *
 * Cron job — Ingesta automática de métricas satelitales para todos los
 * potreros elegibles de todas las organizaciones con métricas habilitadas.
 *
 * Agenda sugerida: "0 8 * * 1" — todos los lunes a las 08:00 ART (11:00 UTC)
 * También se puede llamar manualmente para un backfill histórico.
 *
 * Flujo:
 *   1. Obtiene todas las orgs con plan HOLÍSTICO+ (metrics_module habilitado)
 *   2. Para cada org: obtiene potreros con geometría PostGIS
 *   3. Para cada potrero: llama /api/metrics/indices y persiste snapshots
 *   4. Calcula tendencias simples y persiste en metric_trends
 *   5. Retorna resumen de ejecución
 *
 * Query params:
 *   - org_id: (opcional) limitar a una sola organización
 *   - paddock_id: (opcional) limitar a un solo potrero
 *   - backfill: (opcional) "true" — no omitir potreros con snapshot reciente
 *   - date_from: (opcional) ISO date para backfill histórico (default: hoy)
 *
 * Protegido con CRON_SECRET en el header Authorization.
 */
import { NextRequest, NextResponse } from 'next/server'
import { serviceQuery, serviceQueryOne, serviceMutate } from '@/lib/db'
import { estimateSOC, computeCompactionProxy } from '@/lib/metrics/indices'

export const dynamic    = 'force-dynamic'
export const runtime    = 'nodejs'
export const maxDuration = 300 // 5 min timeout

const CRON_SECRET   = process.env.CRON_SECRET
const APP_BASE_URL  = process.env.NEXT_PUBLIC_APP_URL || 'https://app.rodeoagtech.com'

// Plans eligible for automatic metrics ingestion
const ELIGIBLE_SLUGS = ['holistico', 'pro_ganadero+', 'latifundio', 'enterprise']

// Max paddocks per cron run (to stay within timeout)
const MAX_PADDOCKS_PER_RUN = 50

// Skip paddocks that have a recent snapshot within N days (unless backfill=true)
const RECENCY_DAYS = 5

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  // ── Security ────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams  = req.nextUrl.searchParams
  const filterOrgId   = searchParams.get('org_id')
  const filterPadId   = searchParams.get('paddock_id')
  const isBackfill    = searchParams.get('backfill') === 'true'
  const dateFrom      = searchParams.get('date_from') || new Date().toISOString().split('T')[0]

  const startedAt     = Date.now()
  let paddocksQueued  = 0
  let paddocksSuccess = 0
  let paddocksSkipped = 0
  let indicesStored   = 0
  const errors: string[] = []

  try {
    // ── 1. Feature flag global ────────────────────────────────────────────────
    const globalFlag = await serviceQueryOne<{ flag_value: unknown }>(
      `SELECT flag_value FROM system_feature_flags
       WHERE flag_key = 'metrics_module' LIMIT 1`,
      []
    ).catch(() => null)

    if (globalFlag && (globalFlag.flag_value === false || globalFlag.flag_value === 'false')) {
      return NextResponse.json({
        skipped: true,
        reason: 'feature_flag_disabled',
        durationMs: Date.now() - startedAt,
      })
    }

    // ── 2. Obtener potreros elegibles ─────────────────────────────────────────
    // Joins: organization → plan → paddock with geom
    // Excludes paddocks without a PostGIS polygon (can't be analyzed)
    // Excludes recently-analyzed paddocks unless backfill=true
    const paddocks = await serviceQuery<{
      paddock_id:  string
      paddock_name: string
      area_ha:     number
      geojson:     any      // ST_AsGeoJSON result
      org_id:      string
      plan_slug:   string
      last_snapshot_date: string | null
    }>(`
      SELECT
        p.id            AS paddock_id,
        p.name          AS paddock_name,
        p.area_ha,
        ST_AsGeoJSON(p.geom)::json AS geojson,
        o.id            AS org_id,
        sp.slug         AS plan_slug,
        (
          SELECT MAX(ms.capture_date)::text
          FROM metric_snapshots ms
          WHERE ms.paddock_id = p.id AND ms.metric_type = 'NDVI'
        ) AS last_snapshot_date
      FROM paddocks p
      JOIN organizations o ON p.organization_id = o.id
      JOIN subscriptions_plans sp ON o.subscription_plan_id = sp.id
      WHERE sp.slug = ANY($1::text[])
        AND p.geom IS NOT NULL
        AND p.is_grazable = true
        ${filterOrgId ? 'AND o.id = $3' : ''}
        ${filterPadId ? `AND p.id = $${filterOrgId ? '4' : '3'}` : ''}
      ORDER BY last_snapshot_date ASC NULLS FIRST, p.id
      LIMIT $2
    `, [
      ELIGIBLE_SLUGS,
      MAX_PADDOCKS_PER_RUN,
      ...(filterOrgId ? [filterOrgId] : []),
      ...(filterPadId ? [filterPadId] : []),
    ])

    paddocksQueued = paddocks.length

    if (paddocksQueued === 0) {
      return NextResponse.json({
        paddocksQueued: 0,
        paddocksSuccess: 0,
        paddocksSkipped: 0,
        indicesStored: 0,
        durationMs: Date.now() - startedAt,
        message: 'No eligible paddocks found',
      })
    }

    // ── 3. Procesar cada potrero ──────────────────────────────────────────────
    for (const paddock of paddocks) {
      try {
        // Skip if recently analyzed and not a backfill run
        if (!isBackfill && paddock.last_snapshot_date) {
          const daysSince = Math.floor(
            (Date.now() - new Date(paddock.last_snapshot_date).getTime()) / 86_400_000
          )
          if (daysSince < RECENCY_DAYS) {
            paddocksSkipped++
            continue
          }
        }

        // ── 3a. Call /api/metrics/indices ─────────────────────────────────────
        const indicesRes = await fetch(`${APP_BASE_URL}/api/metrics/indices`, {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${CRON_SECRET || 'cron'}`,
            'X-Cron-Job':    'metrics-ingest',     // bypass user auth in the endpoint
          },
          body: JSON.stringify({
            geojson:    paddock.geojson,
            paddock_id: paddock.paddock_id,
            capture_date: dateFrom,
          }),
          signal: AbortSignal.timeout(25_000),
        })

        if (!indicesRes.ok) {
          const errText = await indicesRes.text().catch(() => indicesRes.status.toString())
          errors.push(`Paddock ${paddock.paddock_id}: HTTP ${indicesRes.status} — ${errText}`)
          continue
        }

        const result = await indicesRes.json()
        const indices: Array<{ metricType: string; value: number; unit: string; confidence: string }> =
          result.indices || []

        if (indices.length === 0) {
          paddocksSkipped++
          continue
        }

        // Calculate SOC and Compaction proxies based on Sentinel-2 indices
        const ndviIdx = indices.find(i => i.metricType === 'NDVI')?.value
        const bsiIdx = indices.find(i => i.metricType === 'BSI')?.value
        const saviIdx = indices.find(i => i.metricType === 'SAVI')?.value
        const fcoverIdx = indices.find(i => i.metricType === 'FCOVER')?.value
        const ndmiIdx = indices.find(i => i.metricType === 'NDMI')?.value

        if (ndviIdx != null && bsiIdx != null && saviIdx != null && fcoverIdx != null && ndmiIdx != null) {
          const params = { ndvi: ndviIdx, bsi: bsiIdx, savi: saviIdx, fcover: fcoverIdx, ndmi: ndmiIdx }
          const soc = estimateSOC(params)
          indices.push({
            metricType: 'SOC_ESTIMATED',
            value: Number(soc.toFixed(4)),
            unit: 'index',
            confidence: 'ESTIMATED'
          })

          const compactionScore = computeCompactionProxy(params)
          
          indices.push({
            metricType: 'COMPACTION_PROXY',
            value: compactionScore,
            unit: 'index',
            confidence: 'ESTIMATED'
          })
        }

        // ── 3b. Persist each index as a metric_snapshot ───────────────────────
        const captureDate = result.captureDate || dateFrom
        const source      = result.source || 'estimated'
        const sceneId     = result.sceneId || null
        const cloudCover  = result.cloudCover ?? null

        for (const idx of indices) {
          await serviceMutate(`
            INSERT INTO metric_snapshots
              (org_id, paddock_id, metric_type, value, unit, capture_date,
               source, scene_id, cloud_cover, confidence, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT DO NOTHING
          `, [
            paddock.org_id,
            paddock.paddock_id,
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
          indicesStored++
        }

        // ── 3c. Also store drought index from climate data if available ────────
        // (Re-uses existing climate_adjustment_snapshots data as a metrics source)
        const droughtSnap = await serviceQueryOne<{ drought_index: string; grass_growth_rate: number }>(
          `SELECT drought_index, grass_growth_rate
           FROM climate_adjustment_snapshots
           WHERE paddock_id = $1
           ORDER BY created_at DESC LIMIT 1`,
          [paddock.paddock_id]
        ).catch(() => null)

        if (droughtSnap) {
          const droughtValue = droughtIndexToNumber(droughtSnap.drought_index)
          await serviceMutate(`
            INSERT INTO metric_snapshots
              (org_id, paddock_id, metric_type, value, unit, capture_date, source, confidence)
            VALUES ($1, $2, 'DROUGHT_INDEX', $3, 'index', $4, 'calculated', 'HIGH')
            ON CONFLICT DO NOTHING
          `, [paddock.org_id, paddock.paddock_id, droughtValue, captureDate]).catch(() => null)
          indicesStored++
        }

        paddocksSuccess++

      } catch (padErr: any) {
        errors.push(`Paddock ${paddock.paddock_id}: ${padErr?.message || 'Unknown error'}`)
      }
    }

    // ── 4. Compute simple monthly trends (async, best-effort) ─────────────────
    try {
      await computeMonthlyTrends()
    } catch (trendErr: any) {
      errors.push(`Trends computation error: ${trendErr?.message}`)
    }

    // ── 5. Return summary ─────────────────────────────────────────────────────
    return NextResponse.json({
      paddocksQueued,
      paddocksSuccess,
      paddocksSkipped,
      indicesStored,
      errors: errors.length > 0 ? errors : undefined,
      durationMs: Date.now() - startedAt,
    })

  } catch (err: any) {
    console.error('[METRICS-INGEST] Fatal error:', err)
    return NextResponse.json(
      { error: err?.message || 'Internal error', durationMs: Date.now() - startedAt },
      { status: 500 }
    )
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function droughtIndexToNumber(idx: string): number {
  switch (idx) {
    case 'NONE':     return 0
    case 'MILD':     return 0.33
    case 'MODERATE': return 0.66
    case 'SEVERE':   return 1
    default:         return 0
  }
}

/**
 * Computes or refreshes monthly metric_trends for the last 2 months.
 * Uses INSERT ... ON CONFLICT DO UPDATE to upsert.
 */
async function computeMonthlyTrends(): Promise<void> {
  // Get all org+paddock+metric_type combos with recent snapshots
  const combos = await serviceQuery<{
    org_id: string
    paddock_id: string | null
    metric_type: string
  }>(`
    SELECT DISTINCT org_id, paddock_id, metric_type
    FROM metric_snapshots
    WHERE capture_date >= (CURRENT_DATE - INTERVAL '60 days')
  `, [])

  for (const combo of combos) {
    // Monthly aggregation for the last 2 complete months
    const monthStats = await serviceQuery<{
      period_start: string
      period_end:   string
      avg_value:    number
      min_value:    number
      max_value:    number
      data_points:  number
      prev_avg:     number | null
    }>(`
      WITH monthly AS (
        SELECT
          DATE_TRUNC('month', capture_date)::date          AS period_start,
          (DATE_TRUNC('month', capture_date) + INTERVAL '1 month - 1 day')::date AS period_end,
          AVG(value)::DECIMAL(10,4)   AS avg_value,
          MIN(value)::DECIMAL(10,4)   AS min_value,
          MAX(value)::DECIMAL(10,4)   AS max_value,
          COUNT(*)::int               AS data_points
        FROM metric_snapshots
        WHERE org_id = $1
          ${combo.paddock_id ? 'AND paddock_id = $4' : 'AND paddock_id IS NOT NULL'}
          AND metric_type = $2
          AND capture_date >= (CURRENT_DATE - INTERVAL '60 days')
        GROUP BY DATE_TRUNC('month', capture_date)
        ORDER BY period_start
      ),
      with_prev AS (
        SELECT *, LAG(avg_value) OVER (ORDER BY period_start) AS prev_avg
        FROM monthly
      )
      SELECT * FROM with_prev
    `, [
      combo.org_id,
      combo.metric_type,
      'monthly',
      ...(combo.paddock_id ? [combo.paddock_id] : []),
    ])

    for (const stat of monthStats) {
      const pctChange = stat.prev_avg != null && stat.prev_avg !== 0
        ? ((stat.avg_value - stat.prev_avg) / Math.abs(stat.prev_avg)) * 100
        : null

      const direction = pctChange == null ? 'stable'
        : pctChange > 2  ? 'improving'
        : pctChange < -2 ? 'declining'
        : 'stable'

      await serviceMutate(`
        INSERT INTO metric_trends
          (org_id, paddock_id, metric_type, period, period_start, period_end,
           avg_value, min_value, max_value, trend_direction, pct_change, data_points)
        VALUES ($1, $2, $3, 'monthly', $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (org_id, paddock_id, metric_type, period, period_start)
        DO UPDATE SET
          avg_value       = EXCLUDED.avg_value,
          min_value       = EXCLUDED.min_value,
          max_value       = EXCLUDED.max_value,
          trend_direction = EXCLUDED.trend_direction,
          pct_change      = EXCLUDED.pct_change,
          data_points     = EXCLUDED.data_points
      `, [
        combo.org_id,
        combo.paddock_id,
        combo.metric_type,
        stat.period_start,
        stat.period_end,
        stat.avg_value,
        stat.min_value,
        stat.max_value,
        direction,
        pctChange != null ? Number(pctChange.toFixed(4)) : null,
        stat.data_points,
      ]).catch(() => null) // non-fatal if trend upsert fails
    }
  }
}
