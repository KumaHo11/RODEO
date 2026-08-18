import { useState, useEffect } from 'react'
import { apiFetch } from '@/lib/apiFetch'

export interface MonthlyPoint {
  month: string
  value: number
  period_month: string
}

export function useTimeMachine(paddockId: string | null, metricType: string) {
  const [monthlyData, setMonthlyData] = useState<MonthlyPoint[]>([])
  const [baseline, setBaseline] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    async function load() {
      if (!paddockId || !metricType) {
        setMonthlyData([])
        setBaseline(null)
        setLoading(false)
        return
      }

      try {
        const [trendsRes, baselinesRes] = await Promise.all([
          apiFetch(`/api/metrics/trends?paddock_id=${paddockId}&metric_type=${metricType}&limit=60&order=asc`),
          apiFetch(`/api/metrics/baselines?paddock_id=${paddockId}`)
        ])

        if (cancelled) return

        if (!trendsRes.ok) throw new Error(`Trends: ${trendsRes.status}`)

        const trendsData = await trendsRes.json()
        const baselinesData = baselinesRes.ok ? await baselinesRes.json() : { baselines: [] }

        const data: MonthlyPoint[] = (trendsData.trends || []).map((t: any) => {
          const date = new Date(t.period_start)
          return {
            month: date.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' }),
            value: parseFloat(t.avg_value),
            period_month: t.period_start,
          }
        })

        let baselineVal = null
        for (const b of (baselinesData.baselines || [])) {
          if (b.metric_type === metricType) {
            baselineVal = parseFloat(b.value)
            break
          }
        }

        if (!cancelled) {
          setMonthlyData(data)
          setBaseline(baselineVal)
          setLoading(false)
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Error cargando Time Machine')
          setLoading(false)
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [paddockId, metricType])

  return { monthlyData, baseline, loading, error }
}
