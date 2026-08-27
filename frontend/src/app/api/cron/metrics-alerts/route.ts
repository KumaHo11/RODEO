import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const maxDuration = 120

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    const alertsCreated = []

    // 1. NDVI_DROP & BSI_CRITICAL
    // Fetch latest and 30-day old snapshots
    const snapshots: any[] = await query(`
      SELECT s1.org_id, s1.paddock_id, s1.metric_type, s1.value as current_value, s2.value as old_value, p.name
      FROM (
        SELECT DISTINCT ON (paddock_id, metric_type) org_id, paddock_id, metric_type, value, capture_date
        FROM metric_snapshots
        ORDER BY paddock_id, metric_type, capture_date DESC
      ) s1
      JOIN paddocks p ON s1.paddock_id = p.id
      LEFT JOIN (
        SELECT DISTINCT ON (paddock_id, metric_type) paddock_id, metric_type, value
        FROM metric_snapshots
        WHERE capture_date <= NOW() - INTERVAL '30 days'
        ORDER BY paddock_id, metric_type, capture_date DESC
      ) s2 ON s1.paddock_id = s2.paddock_id AND s1.metric_type = s2.metric_type
      WHERE s1.metric_type IN ('NDVI', 'BSI')
    `)

    for (const s of snapshots) {
      if (s.metric_type === 'NDVI' && s.old_value && s.current_value < s.old_value * 0.85) {
        alertsCreated.push({
          org_id: s.org_id, paddock_id: s.paddock_id,
          title: `Caída crítica de NDVI en ${s.name}`,
          desc: `El NDVI cayó más del 15% en los últimos 30 días.`
        })
      }
      if (s.metric_type === 'BSI' && s.current_value > 0.1) {
        alertsCreated.push({
          org_id: s.org_id, paddock_id: s.paddock_id,
          title: `Suelo desnudo crítico en ${s.name}`,
          desc: `El BSI superó el umbral de 0.1.`
        })
      }
    }

    // 2. DEFORESTATION_ALERT
    const defor: any[] = await query(`
      SELECT DISTINCT ON (d.paddock_id) d.org_id, d.paddock_id, p.name
      FROM deforestation_checks d
      JOIN paddocks p ON d.paddock_id = p.id
      WHERE d.status = 'DEFORESTED'
      ORDER BY d.paddock_id, d.checked_at DESC
    `)
    for (const d of defor) {
      alertsCreated.push({
        org_id: d.org_id, paddock_id: d.paddock_id,
        title: `Alerta de Deforestación en ${d.name}`,
        desc: `Se ha detectado posible deforestación post-2020.`
      })
    }

    // 3. NO_DATA_30D
    const noData: any[] = await query(`
      SELECT p.id as paddock_id, p.org_id, p.name
      FROM paddocks p
      LEFT JOIN (
        SELECT paddock_id, MAX(capture_date) as last_capture
        FROM metric_snapshots
        GROUP BY paddock_id
      ) s ON p.id = s.paddock_id
      WHERE p.geom IS NOT NULL 
        AND (s.last_capture IS NULL OR s.last_capture < NOW() - INTERVAL '30 days')
    `)
    for (const p of noData) {
      alertsCreated.push({
        org_id: p.org_id, paddock_id: p.paddock_id,
        title: `Sin datos recientes en ${p.name}`,
        desc: `No se han recibido métricas satelitales en más de 30 días.`
      })
    }

    // 4. COMPLIANCE_RISK (EUDR < 50%)
    const eudrFail: any[] = await query(`
      SELECT p.org_id, p.id as paddock_id, p.name
      FROM paddocks p
      LEFT JOIN deforestation_checks d ON p.id = d.paddock_id
      LEFT JOIN (
        SELECT paddock_id, value as fcover FROM metric_snapshots WHERE metric_type = 'FCOVER' AND capture_date > NOW() - INTERVAL '30 days'
      ) f ON p.id = f.paddock_id
      WHERE d.status = 'DEFORESTED' OR f.fcover < 0.3
    `)
    for (const p of eudrFail) {
      alertsCreated.push({
        org_id: p.org_id, paddock_id: p.paddock_id,
        title: `Riesgo Compliance EUDR en ${p.name}`,
        desc: `El score proyectado de EUDR es menor a 50%.`
      })
    }

    // Insert into farm_events
    let inserted = 0
    for (const a of alertsCreated) {
      const idempotencyKey = `ALERT-${a.paddock_id}-${new Date().toISOString().split('T')[0]}-${a.title.substring(0, 10)}`
      
      const existing: any[] = await query(
        `SELECT id FROM farm_events WHERE idempotency_key = $1`,
        [idempotencyKey]
      )

      if (existing.length === 0) {
        await query(
          `INSERT INTO farm_events 
           (org_id, title, event_type, event_date, paddock_id, description, status, idempotency_key, created_at, updated_at)
           VALUES ($1, $2, 'METRIC_ALERT', NOW(), $3, $4, 'OPEN', $5, NOW(), NOW())`,
          [a.org_id, a.title, a.paddock_id, a.desc, idempotencyKey]
        )
        inserted++
      }
    }

    return NextResponse.json({ success: true, alerts_evaluated: alertsCreated.length, alerts_created: inserted })
  } catch (error: any) {
    console.error('Alert Engine Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
