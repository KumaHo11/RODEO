import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { serviceQuery, serviceMutate } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { paddock_id, geojson } = body

    let polygon = geojson

    if (paddock_id && !polygon) {
      const paddockRes = await serviceQuery(
        `SELECT ST_AsGeoJSON(boundary)::json as boundary FROM paddocks WHERE id = $1 AND org_id = $2`,
        [paddock_id, auth.orgId]
      )
      if (!paddockRes.length) return NextResponse.json({ error: 'Paddock not found' }, { status: 404 })
      
      polygon = typeof paddockRes[0].boundary === 'string' ? JSON.parse(paddockRes[0].boundary) : paddockRes[0].boundary
    }

    if (!polygon) {
      return NextResponse.json({ error: 'No geometry provided' }, { status: 400 })
    }

    let has_deforestation = false
    let loss_area_ha = 0
    let confidence = 'LOW'
    let data_source = 'UNKNOWN'
    let status = 'UNKNOWN' // CLEAN, ALERT, WARNING, UNKNOWN

    let baseline_ndvi: number | null = null
    let current_ndvi: number | null = null
    let ndvi_drop: number | null = null

    const gfwApiKey = process.env.GFW_API_KEY
    let gfwSuccess = false

    if (gfwApiKey) {
      try {
        const geostoreRes = await fetch('https://data-api.globalforestwatch.org/geostore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': gfwApiKey },
          body: JSON.stringify({ geometry: polygon })
        })

        if (geostoreRes.ok) {
          const analysisRes = await fetch(
            `https://data-api.globalforestwatch.org/dataset/umd_tree_cover_loss/latest/query`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-api-key': gfwApiKey },
              body: JSON.stringify({ 
                geometry: polygon, 
                filters: [{ field: 'umd_tree_cover_loss__year', operator: 'greater_than', value: 2020 }] 
              })
            }
          )

          if (analysisRes.ok) {
            const data = await analysisRes.json()
            const lossArea = data.data?.[0]?.area || 0
            loss_area_ha = lossArea
            has_deforestation = lossArea > 0
            status = has_deforestation ? 'ALERT' : 'CLEAN'
            confidence = 'HIGH'
            data_source = 'GFW_API'
            gfwSuccess = true
          }
        }
      } catch (err) {
        console.error("GFW API error", err)
      }
    }

    if (!gfwSuccess && paddock_id) {
      const baselineRes = await serviceQuery(`
        SELECT AVG(value) as ndvi_baseline FROM metric_snapshots
        WHERE paddock_id = $1 AND metric_type = 'NDVI' 
        AND capture_date BETWEEN '2020-11-01' AND '2021-01-31'
      `, [paddock_id])

      const currentRes = await serviceQuery(`
        SELECT AVG(value) as ndvi_current FROM metric_snapshots  
        WHERE paddock_id = $1 AND metric_type = 'NDVI'
        AND capture_date >= NOW() - INTERVAL '6 months'
      `, [paddock_id])

      baseline_ndvi = baselineRes[0]?.ndvi_baseline ? parseFloat(baselineRes[0].ndvi_baseline as string) : null
      current_ndvi = currentRes[0]?.ndvi_current ? parseFloat(currentRes[0].ndvi_current as string) : null

      if (baseline_ndvi !== null && current_ndvi !== null) {
        ndvi_drop = baseline_ndvi - current_ndvi
        data_source = 'NDVI_HEURISTIC'
        if (baseline_ndvi > 0.55 && current_ndvi < 0.30) {
          has_deforestation = true
          confidence = 'ESTIMATED'
          status = 'ALERT'
        } else {
          has_deforestation = false
          confidence = 'ESTIMATED'
          status = 'CLEAN'
        }
      }
    }

    let dbStatus = 'PENDING'
    if (status === 'ALERT') dbStatus = 'DEFORESTED'
    else if (status === 'WARNING') dbStatus = 'AT_RISK'
    else if (status === 'CLEAN') dbStatus = 'CLEAN'

    let dbConfidence = confidence === 'ESTIMATED' ? 'LOW' : confidence

    if (paddock_id) {
      await serviceMutate(`
        INSERT INTO deforestation_checks (
          org_id, paddock_id, status, confidence, baseline_ndvi, current_ndvi, ndvi_drop, checked_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (org_id, paddock_id) DO UPDATE SET
          status = EXCLUDED.status,
          confidence = EXCLUDED.confidence,
          baseline_ndvi = EXCLUDED.baseline_ndvi,
          current_ndvi = EXCLUDED.current_ndvi,
          ndvi_drop = EXCLUDED.ndvi_drop,
          checked_at = EXCLUDED.checked_at
      `, [auth.orgId, paddock_id, dbStatus, dbConfidence, baseline_ndvi, current_ndvi, ndvi_drop])
    }

    return NextResponse.json({
      paddock_id,
      has_deforestation,
      loss_area_ha,
      confidence,
      data_source,
      status,
      check_date: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Error en /api/deforestation/check', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
