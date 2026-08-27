import { useState, useEffect } from 'react'
import { apiFetch } from '@/lib/apiFetch'

export type TrendArrow = '↑' | '↓' | '~'

export interface MultiMetricPoint {
  period_month: string
  month: string          // human-readable label "ene. 2022"
  scene_id: string | null
  ndvi: number | null
  evi: number | null
  soc: number | null
  fcover: number | null
  ndvi_trend: TrendArrow
  evi_trend: TrendArrow
  soc_trend: TrendArrow
  fcover_trend: TrendArrow
  /** True if this month is the first one where forest loss vs. pre-2021 baseline is detected */
  eudr_alert: boolean
}

export interface EudrStatus {
  /** Does this paddock have any deforestation event after Dec 31 2020? */
  hasAlert: boolean
  /** The period_month when the first loss was detected (ISO date string), or null */
  alertMonth: string | null
  /** Is the paddock clean? (no deforestation detected in any period) */
  isClean: boolean
}

interface RawTrend {
  avg_value: string
  period_start: string
  scene_id: string | null
  trend_direction: string
}

function toArrow(direction: string): TrendArrow {
  if (direction === 'up') return '↑'
  if (direction === 'down') return '↓'
  return '~'
}

const FOREST_BASELINE_THRESHOLD = 0.30  // fCover ≥ 0.30 → considered "forested"
const FOREST_LOSS_THRESHOLD     = 0.10  // fCover < 0.10 → considered "cleared"
const EUDR_CUTOFF_DATE          = '2021-01-01' // post-31-Dec-2020

/**
 * Fetches NDVI, EVI, SOC_ESTIMATED and FCOVER time series in parallel for a paddock,
 * merges them by period_month, computes trend arrows, and detects EUDR deforestation events.
 */
export function useMultiMetric(paddockId: string | null) {
  const [data, setData]       = useState<MultiMetricPoint[]>([])
  const [eudr, setEudr]       = useState<EudrStatus>({ hasAlert: false, alertMonth: null, isClean: true })
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    async function load() {
      if (!paddockId) {
        setData([])
        setEudr({ hasAlert: false, alertMonth: null, isClean: true })
        setLoading(false)
        return
      }

      try {
        const base = `/api/metrics/trends?paddock_id=${paddockId}&limit=120&order=asc&metric_type=`

        const [ndviRes, eviRes, socRes, fcoverRes] = await Promise.all([
          apiFetch(`${base}NDVI`),
          apiFetch(`${base}EVI`),
          apiFetch(`${base}SOC_ESTIMATED`),
          apiFetch(`${base}FCOVER`),
        ])

        if (cancelled) return

        const [ndviData, eviData, socData, fcoverData] = await Promise.all([
          ndviRes.ok   ? ndviRes.json()   : { trends: [] },
          eviRes.ok    ? eviRes.json()    : { trends: [] },
          socRes.ok    ? socRes.json()    : { trends: [] },
          fcoverRes.ok ? fcoverRes.json() : { trends: [] },
        ])

        if (cancelled) return

        // Build lookup maps keyed by period_start (ISO date)
        const ndviMap   = new Map<string, RawTrend>()
        const eviMap    = new Map<string, RawTrend>()
        const socMap    = new Map<string, RawTrend>()
        const fcoverMap = new Map<string, RawTrend>()

        for (const t of (ndviData.trends   || [])) ndviMap.set(t.period_start, t)
        for (const t of (eviData.trends    || [])) eviMap.set(t.period_start, t)
        for (const t of (socData.trends    || [])) socMap.set(t.period_start, t)
        for (const t of (fcoverData.trends || [])) fcoverMap.set(t.period_start, t)

        // Union of all periods — sorted asc
        const allPeriods = Array.from(
          new Set([
            ...ndviMap.keys(),
            ...eviMap.keys(),
            ...socMap.keys(),
            ...fcoverMap.keys(),
          ])
        ).sort()

        // Determine EUDR baseline: was there forest (fCover ≥ threshold) before 2021?
        const preEudrPeriods = allPeriods.filter(p => p < EUDR_CUTOFF_DATE)
        const hadForestBaseline = preEudrPeriods.some(p => {
          const fc = fcoverMap.get(p)
          return fc ? parseFloat(fc.avg_value) >= FOREST_BASELINE_THRESHOLD : false
        })

        // Merge into MultiMetricPoint[]
        const merged: MultiMetricPoint[] = allPeriods.map(period => {
          const ndviRaw   = ndviMap.get(period)
          const eviRaw    = eviMap.get(period)
          const socRaw    = socMap.get(period)
          const fcoverRaw = fcoverMap.get(period)

          const date = new Date(period)
          const month = date.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })

          // Prefer scene_id from NDVI (most frequently captured)
          const scene_id = ndviRaw?.scene_id ?? eviRaw?.scene_id ?? fcoverRaw?.scene_id ?? null

          return {
            period_month:  period,
            month,
            scene_id,
            ndvi:   ndviRaw   ? parseFloat(ndviRaw.avg_value)   : null,
            evi:    eviRaw    ? parseFloat(eviRaw.avg_value)    : null,
            soc:    socRaw    ? parseFloat(socRaw.avg_value)    : null,
            fcover: fcoverRaw ? parseFloat(fcoverRaw.avg_value) : null,
            ndvi_trend:   toArrow(ndviRaw?.trend_direction   || 'stable'),
            evi_trend:    toArrow(eviRaw?.trend_direction    || 'stable'),
            soc_trend:    toArrow(socRaw?.trend_direction    || 'stable'),
            fcover_trend: toArrow(fcoverRaw?.trend_direction || 'stable'),
            eudr_alert: false, // will be set below
          }
        })

        // Detect EUDR alert: first post-2020 month where forest cover collapsed
        let alertMonth: string | null = null
        if (hadForestBaseline) {
          for (const pt of merged) {
            if (pt.period_month >= EUDR_CUTOFF_DATE && pt.fcover !== null && pt.fcover < FOREST_LOSS_THRESHOLD) {
              pt.eudr_alert = true
              if (alertMonth === null) alertMonth = pt.period_month
            }
          }
        }

        const eudrStatus: EudrStatus = {
          hasAlert:  alertMonth !== null,
          alertMonth,
          isClean:   alertMonth === null,
        }

        if (!cancelled) {
          setData(merged)
          setEudr(eudrStatus)
          setLoading(false)
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Error cargando métricas')
          setLoading(false)
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [paddockId])

  return { data, eudr, loading, error }
}
