'use client'

/**
 * useMetrics — Hook para obtener métricas satelitales de un paddock o de la org entera.
 * Consulta /api/metrics/snapshots y /api/metrics/trends.
 */

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/apiFetch'
import type { MetricSnapshot, MetricTrend, MetricType } from '../components/MetricCard'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MetricsState {
  snapshots:   Partial<Record<MetricType, MetricSnapshot>>
  trends:      Partial<Record<MetricType, MetricTrend>>
  baselines:   Partial<Record<MetricType, number>>   // 2020 baseline values
  captureDate: string | null
  loading:     boolean
  error:       string | null
  refetch:     () => void
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useMetrics(paddockId?: string | null): MetricsState {
  const [snapshots, setSnapshots]   = useState<Partial<Record<MetricType, MetricSnapshot>>>({})
  const [trends, setTrends]         = useState<Partial<Record<MetricType, MetricTrend>>>({})
  const [baselines, setBaselines]   = useState<Partial<Record<MetricType, number>>>({})
  const [captureDate, setCaptureDate] = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [tick, setTick]             = useState(0)

  const refetch = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const qs = paddockId ? `?paddock_id=${paddockId}` : ''

        const [snapshotsRes, trendsRes, baselinesRes] = await Promise.all([
          apiFetch(`/api/metrics/snapshots${qs}`),
          apiFetch(`/api/metrics/trends${qs}`),
          apiFetch(`/api/metrics/baselines${qs}`),
        ])

        if (cancelled) return

        if (!snapshotsRes.ok) throw new Error(`Snapshots: ${snapshotsRes.status}`)

        const snapshotsData  = await snapshotsRes.json()
        const trendsData     = trendsRes.ok  ? await trendsRes.json()    : { trends: [] }
        const baselinesData  = baselinesRes.ok ? await baselinesRes.json() : { baselines: [] }

        // Index by metricType
        const snapMap: Partial<Record<MetricType, MetricSnapshot>> = {}
        let latestDate: string | null = null
        for (const s of (snapshotsData.snapshots || [])) {
          snapMap[s.metric_type as MetricType] = {
            metricType:  s.metric_type,
            value:       parseFloat(s.value),
            unit:        s.unit || 'index',
            captureDate: s.capture_date,
            source:      s.source,
            confidence:  s.confidence,
          }
          if (!latestDate || s.capture_date > latestDate) latestDate = s.capture_date
        }

        const trendMap: Partial<Record<MetricType, MetricTrend>> = {}
        for (const t of (trendsData.trends || [])) {
          trendMap[t.metric_type as MetricType] = {
            avgValue:       parseFloat(t.avg_value),
            pctChange:      t.pct_change != null ? parseFloat(t.pct_change) : null,
            trendDirection: t.trend_direction || 'stable',
            dataPoints:     t.data_points || 0,
          }
        }

        const baselineMap: Partial<Record<MetricType, number>> = {}
        for (const b of (baselinesData.baselines || [])) {
          baselineMap[b.metric_type as MetricType] = parseFloat(b.value)
        }

        if (!cancelled) {
          setSnapshots(snapMap)
          setTrends(trendMap)
          setBaselines(baselineMap)
          setCaptureDate(latestDate)
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
  }, [paddockId, tick])

  return { snapshots, trends, baselines, captureDate, loading, error, refetch }
}
