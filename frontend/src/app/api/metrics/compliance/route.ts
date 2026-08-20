import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { serviceQuery } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth) return new NextResponse('Unauthorized', { status: 401 })
    const orgId = auth.orgId

    // 1. Fetch Paddocks
    const paddocks: any[] = await serviceQuery(
      'SELECT id, name, geom FROM paddocks WHERE org_id = $1',
      [orgId]
    )

    if (paddocks.length === 0) {
      return NextResponse.json({
        scores: {
          eudr: { total: 0, breakdown: {} },
          eov: { total: 0, breakdown: {} },
          grsb: { total: 0, breakdown: {} },
        },
        paddocks_detail: [],
        recommendations: [],
        last_updated: new Date().toISOString()
      })
    }

    // 2. Fetch Latest Snapshots (resilient to missing v22 tables)
    let snapshots: any[] = []
    try {
      snapshots = await serviceQuery(`
        SELECT DISTINCT ON (paddock_id, metric_type) 
          paddock_id, metric_type, value, capture_date
        FROM metric_snapshots
        WHERE org_id = $1
        ORDER BY paddock_id, metric_type, capture_date DESC
      `, [orgId])
    } catch (e: any) {
      if (!e.message?.includes('does not exist')) throw e
      console.warn('[compliance] metric_snapshots table not found — returning empty data')
    }

    // 3. Compute trends inline from metric_snapshots (last 2 data points per paddock+metric)
    let trendRows: any[] = []
    try {
      trendRows = await serviceQuery(`
        WITH ranked AS (
          SELECT paddock_id, metric_type, value, capture_date,
            ROW_NUMBER() OVER (PARTITION BY paddock_id, metric_type ORDER BY capture_date DESC) AS rn
          FROM metric_snapshots
          WHERE org_id = $1
        ),
        latest AS (SELECT paddock_id, metric_type, value FROM ranked WHERE rn = 1),
        prev   AS (SELECT paddock_id, metric_type, value FROM ranked WHERE rn = 2)
        SELECT l.paddock_id, l.metric_type,
          CASE WHEN p.value IS NOT NULL AND p.value != 0
            THEN ROUND(((l.value - p.value) / p.value * 100)::numeric, 2)
            ELSE 0
          END AS pct_change
        FROM latest l LEFT JOIN prev p USING (paddock_id, metric_type)
      `, [orgId])
    } catch (e: any) {
      if (!e.message?.includes('does not exist')) console.warn('[compliance] trends calc error:', e.message)
    }

    // 4. Fetch Baselines (2020-11-01 to 2021-01-31)
    let baselines: any[] = []
    try {
      baselines = await serviceQuery(`
        SELECT paddock_id, metric_type, AVG(value) as baseline
        FROM metric_snapshots
        WHERE org_id = $1 AND capture_date BETWEEN '2020-11-01' AND '2021-01-31'
        GROUP BY paddock_id, metric_type
      `, [orgId])
    } catch (e: any) {
      if (!e.message?.includes('does not exist')) throw e
    }

    // 5. Fetch Deforestation Checks
    let deforestation: any[] = []
    try {
      deforestation = await serviceQuery(`
        SELECT DISTINCT ON (paddock_id) paddock_id, status
        FROM deforestation_checks
        WHERE org_id = $1
        ORDER BY paddock_id, checked_at DESC
      `, [orgId])
    } catch (e: any) {
      if (!e.message?.includes('does not exist')) throw e
    }

    // Pre-process data by paddock
    const paddockData = new Map<string, any>()
    for (const p of paddocks) {
      paddockData.set(p.id, {
        id: p.id,
        name: p.name,
        hasGeom: !!p.geom,
        snapshots: {},
        trends: {},
        baselines: {},
        deforestationStatus: 'UNKNOWN'
      })
    }

    for (const s of snapshots) {
      if (paddockData.has(s.paddock_id)) paddockData.get(s.paddock_id).snapshots[s.metric_type] = s
    }
    for (const t of trendRows) {
      if (paddockData.has(t.paddock_id)) paddockData.get(t.paddock_id).trends[t.metric_type] = t
    }
    for (const b of baselines) {
      if (paddockData.has(b.paddock_id)) paddockData.get(b.paddock_id).baselines[b.metric_type] = b.baseline
    }
    for (const d of deforestation) {
      if (paddockData.has(d.paddock_id)) paddockData.get(d.paddock_id).deforestationStatus = d.status
    }

    let paddocksWithGeom = 0
    let latestCapture = 0
    
    // Evaluate per paddock
    const paddocksDetail = []
    const recommendations = []

    for (const [id, pd] of paddockData.entries()) {
      if (pd.hasGeom) paddocksWithGeom++

      const ndviSnapshot   = pd.snapshots['NDVI']        ? parseFloat(pd.snapshots['NDVI'].value)        : undefined
      const ndviTrend      = parseFloat(pd.trends['NDVI']?.pct_change   ?? 0)
      const ndviBaseline   = pd.baselines['NDVI']         ? parseFloat(pd.baselines['NDVI'])              : undefined
      const fcoverSnapshot = pd.snapshots['FCOVER']       ? parseFloat(pd.snapshots['FCOVER'].value)       : undefined
      const fcoverTrend    = parseFloat(pd.trends['FCOVER']?.pct_change ?? 0)
      const specHetSnapshot= pd.snapshots['SPECTRAL_HETEROGENEITY'] ? parseFloat(pd.snapshots['SPECTRAL_HETEROGENEITY'].value) : undefined
      const bsiSnapshot    = pd.snapshots['BSI']          ? parseFloat(pd.snapshots['BSI'].value)          : undefined
      const isDeforested = pd.deforestationStatus === 'DEFORESTED'
      const statusLabel = isDeforested ? '🚨 Alerta' : pd.deforestationStatus === 'CLEAN' ? '✅ Limpio' : '❓ Desconocido'
      
      const captureDate = pd.snapshots['NDVI']?.capture_date
      if (captureDate) {
        const d = new Date(captureDate).getTime()
        if (d > latestCapture) latestCapture = d
      }

      // Paddocks detail
      const eudrScore = (
        (!isDeforested ? 30 : 0) +
        (ndviTrend >= 0 ? 25 : 0) +
        ((fcoverSnapshot || 0) > 0.3 ? 20 : 0) +
        (pd.hasGeom ? 15 : 0) +
        10 // Assumed verified data points for now, will calculate overall later
      )

      const eovScore = (
        ((ndviBaseline && ndviSnapshot > ndviBaseline * 1.05) ? 25 : 0) +
        ((specHetSnapshot || 0) > 0.1 ? 25 : 0) +
        ((bsiSnapshot || 0) < -0.05 ? 25 : 0) +
        (fcoverTrend > 0 ? 25 : 0)
      )

      paddocksDetail.push({
        id: pd.id,
        name: pd.name,
        ndvi: ndviSnapshot !== undefined ? ndviSnapshot.toFixed(2) : '—',
        ndviTrend: ndviTrend,
        deforest: statusLabel,
        fCover: fcoverSnapshot !== undefined ? fcoverSnapshot.toFixed(2) : '—',
        eudr: eudrScore,
        eov: eovScore
      })

      // Recommendations
      if (isDeforested) {
        recommendations.push({ paddockId: pd.id, paddockName: pd.name, level: 'URGENTE', message: `Alerta de deforestación detectada en ${pd.name}. Revisar imágenes satelitales inmediatamente.` })
      }
      if (ndviBaseline && ndviSnapshot < ndviBaseline) {
        recommendations.push({ paddockId: pd.id, paddockName: pd.name, level: 'ADVERTENCIA', message: `Caída de NDVI en ${pd.name} respecto a la línea base de 2020.` })
      }
      if (fcoverSnapshot !== undefined && fcoverSnapshot < 0.2) {
        recommendations.push({ paddockId: pd.id, paddockName: pd.name, level: 'ADVERTENCIA', message: `Baja cobertura vegetal (fCover < 0.2) en ${pd.name}. Riesgo de erosión.` })
      }
    }

    const totalPaddocks = paddocks.length || 1

    // Aggregate EUDR
    const eudrNoDeforest = Array.from(paddockData.values()).every(pd => pd.deforestationStatus !== 'DEFORESTED')
    const eudrNdviStable = Array.from(paddockData.values()).filter(pd => (pd.trends['NDVI']?.pct_change || 0) >= 0).length / totalPaddocks
    const eudrFcover = Array.from(paddockData.values()).filter(pd => (pd.snapshots['FCOVER']?.value || 0) > 0.3).length / totalPaddocks
    const geomRatio = paddocksWithGeom / totalPaddocks
    const verified90d = latestCapture > (Date.now() - 90 * 24 * 60 * 60 * 1000)

    const eudrTotal = Math.round(
      (eudrNoDeforest ? 30 : 0) +
      (eudrNdviStable * 25) +
      (eudrFcover * 20) +
      (geomRatio * 15) +
      (verified90d ? 10 : 0)
    )

    // Aggregate EOV
    const eovNdviImp = Array.from(paddockData.values()).filter(pd => {
      const snap = pd.snapshots['NDVI']?.value
      const base = pd.baselines['NDVI']
      return base && snap && snap > base * 1.05
    }).length / totalPaddocks

    const eovSpecHet = Array.from(paddockData.values()).filter(pd => (pd.snapshots['SPECTRAL_HETEROGENEITY']?.value || 0) > 0.1).length / totalPaddocks
    const eovBsi = Array.from(paddockData.values()).filter(pd => (pd.snapshots['BSI']?.value || 0) < -0.05).length / totalPaddocks
    const eovFcoverTrend = Array.from(paddockData.values()).filter(pd => (pd.trends['FCOVER']?.pct_change || 0) > 0).length / totalPaddocks

    const eovTotal = Math.round(
      (eovNdviImp * 25) +
      (eovSpecHet * 25) +
      (eovBsi * 25) +
      (eovFcoverTrend * 25)
    )

    // Aggregate GRSB
    const grsbNdviStable = eudrNdviStable
    const grsbNoDeforest = eudrNoDeforest
    const grsbDataCoverage = geomRatio > 0.8

    const grsbTotal = Math.round(
      (grsbNdviStable * 33) +
      (grsbNoDeforest ? 33 : 0) +
      (grsbDataCoverage ? 34 : 0)
    )

    return NextResponse.json({
      scores: {
        eudr: {
          total: eudrTotal,
          breakdown: {
            no_deforestation: { score: eudrNoDeforest ? 30 : 0, max: 30, met: eudrNoDeforest },
            ndvi_stable: { score: Math.round(eudrNdviStable * 25), max: 25, met: eudrNdviStable >= 0.5 },
            fcover_high: { score: Math.round(eudrFcover * 20), max: 20, met: eudrFcover >= 0.5 },
            traceability: { score: Math.round(geomRatio * 15), max: 15, met: geomRatio === 1 },
            verified_data: { score: verified90d ? 10 : 0, max: 10, met: verified90d }
          }
        },
        eov: {
          total: eovTotal,
          breakdown: {
            ndvi_improving: { score: Math.round(eovNdviImp * 25), max: 25, met: eovNdviImp >= 0.5 },
            spectral_heterogeneity: { score: Math.round(eovSpecHet * 25), max: 25, met: eovSpecHet >= 0.5 },
            bsi_low: { score: Math.round(eovBsi * 25), max: 25, met: eovBsi >= 0.5 },
            fcover_trend: { score: Math.round(eovFcoverTrend * 25), max: 25, met: eovFcoverTrend >= 0.5 }
          }
        },
        grsb: {
          total: grsbTotal,
          breakdown: {
            ndvi_stable: { score: Math.round(grsbNdviStable * 33), max: 33, met: grsbNdviStable >= 0.5 },
            no_deforestation: { score: grsbNoDeforest ? 33 : 0, max: 33, met: grsbNoDeforest },
            data_coverage: { score: grsbDataCoverage ? 34 : 0, max: 34, met: grsbDataCoverage }
          }
        }
      },
      paddocks_detail: paddocksDetail,
      recommendations: recommendations,
      last_updated: latestCapture ? new Date(latestCapture).toISOString() : new Date().toISOString()
    })
  } catch (error: any) {
    console.error('Compliance API Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
