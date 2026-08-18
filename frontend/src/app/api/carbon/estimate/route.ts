import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { query } from '@/lib/db'
import { calculateCarbonBalance, CarbonEstimate } from '@/lib/carbon/carbonEngine'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const paddockId = searchParams.get('paddock_id')
    const periodFrom = searchParams.get('period_from') // YYYY-MM
    const periodTo = searchParams.get('period_to')     // YYYY-MM

    if (!paddockId || !periodFrom || !periodTo) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    // Simplified for now: We assume one month calculation based on periodFrom
    const periodMonth = `${periodFrom}-01`
    
    // 1. Get paddock details
    const paddockRes = await query<{ area_ha: number }>(
      'SELECT area_ha FROM paddocks WHERE id = $1 AND org_id = $2',
      [paddockId, auth.orgId]
    )
    if (!paddockRes.length) return NextResponse.json({ error: 'Paddock not found' }, { status: 404 })
    const paddockHa = Number(paddockRes[0].area_ha) || 1

    // 2. Get metric snapshots for SOC and NDVI in the period
    const metricsRes = await query<{ metric_type: string, value: number }>(
      `SELECT metric_type, AVG(value) as value 
       FROM metric_snapshots 
       WHERE paddock_id = $1 AND org_id = $2 
         AND metric_type IN ('SOC_ESTIMATED', 'NDVI')
         AND capture_date >= $3::date AND capture_date < ($3::date + INTERVAL '1 month')
       GROUP BY metric_type`,
      [paddockId, auth.orgId, periodMonth]
    )
    let socProxy = 0.3 // default if not found
    let ndvi = 0.5     // default if not found
    metricsRes.forEach(m => {
      if (m.metric_type === 'SOC_ESTIMATED') socProxy = Number(m.value)
      if (m.metric_type === 'NDVI') ndvi = Number(m.value)
    })

    // 3. Get animal head count (animals table or grazing plans fallback)
    let headCount = 0
    let daysInPeriod = 30

    // Try finding animals in paddock
    const animalsRes = await query<{ head_count: number }>(
      `SELECT COUNT(*) as head_count FROM animals 
       WHERE current_paddock_id = $1 AND org_id = $2 AND status = 'VIVO'`,
      [paddockId, auth.orgId]
    )
    headCount = Number(animalsRes[0]?.head_count || 0)

    // Fallback to herds JOIN grazing_plans (or just grazing_plans)
    if (headCount === 0) {
      const herdsRes = await query<{ total_heads: number }>(
        `SELECT SUM(h.head_count) as total_heads 
         FROM grazing_plans gp
         JOIN herds h ON h.id = gp.herd_id
         WHERE gp.paddock_id = $1 AND gp.org_id = $2`,
        [paddockId, auth.orgId]
      )
      headCount = Number(herdsRes[0]?.total_heads || 0)
    }

    // 4. Calculate carbon balance
    const estimate = calculateCarbonBalance({
      headCount,
      daysInPeriod,
      paddockHa,
      socProxy,
      ndvi
    })

    // 5. Upsert into carbon_estimates
    await query(
      `INSERT INTO carbon_estimates (
        org_id, paddock_id, period_month, head_count, days_in_paddock,
        ch4_enteric_kg, ch4_manure_kg, n2o_manure_kg, soc_proxy, ndvi_mean,
        biomass_above_t, paddock_ha, gross_emissions_tco2e, 
        soc_sequestration_tco2e, net_balance_tco2e, methodology, confidence, notes
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13,
        $14, $15, $16, $17, $18
      ) ON CONFLICT (org_id, paddock_id, period_month) DO UPDATE SET
        head_count = EXCLUDED.head_count,
        days_in_paddock = EXCLUDED.days_in_paddock,
        ch4_enteric_kg = EXCLUDED.ch4_enteric_kg,
        ch4_manure_kg = EXCLUDED.ch4_manure_kg,
        n2o_manure_kg = EXCLUDED.n2o_manure_kg,
        soc_proxy = EXCLUDED.soc_proxy,
        ndvi_mean = EXCLUDED.ndvi_mean,
        biomass_above_t = EXCLUDED.biomass_above_t,
        paddock_ha = EXCLUDED.paddock_ha,
        gross_emissions_tco2e = EXCLUDED.gross_emissions_tco2e,
        soc_sequestration_tco2e = EXCLUDED.soc_sequestration_tco2e,
        net_balance_tco2e = EXCLUDED.net_balance_tco2e,
        methodology = EXCLUDED.methodology,
        confidence = EXCLUDED.confidence,
        notes = EXCLUDED.notes
      `,
      [
        auth.orgId, paddockId, periodMonth, headCount, headCount * daysInPeriod,
        estimate.ch4EntericKg, estimate.ch4ManureKg, estimate.n2oManureKg, socProxy, ndvi,
        estimate.biomassAboveT, paddockHa, estimate.grossEmissionsTco2e,
        estimate.socSequestrationTco2e, estimate.netBalanceTco2e, estimate.methodology, estimate.confidence, estimate.notes
      ]
    )

    return NextResponse.json({
      period_month: periodMonth,
      estimate
    })
  } catch (error) {
    console.error('Carbon estimate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
