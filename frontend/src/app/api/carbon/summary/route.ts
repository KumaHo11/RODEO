import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Feature gate check: could use org features, assuming allowed for now
    // Or check if user has metrics_module enabled.

    const { searchParams } = new URL(req.url)
    const year = searchParams.get('year') || new Date().getFullYear().toString()

    let summaryRes: any[] = []
    let paddocksRes: any[] = []

    try {
      // Aggregate by farm
      summaryRes = await query<{
        total_gross_tco2e: number,
        total_sequestration_tco2e: number,
        net_balance_tco2e: number
      }>(
        `SELECT 
          SUM(gross_emissions_tco2e) as total_gross_tco2e,
          SUM(soc_sequestration_tco2e) as total_sequestration_tco2e,
          SUM(net_balance_tco2e) as net_balance_tco2e
         FROM carbon_estimates
         WHERE org_id = $1 AND EXTRACT(YEAR FROM period_month) = $2`,
        [auth.orgId, year]
      )

      // Aggregate by paddock
      paddocksRes = await query<{
        paddock_id: string,
        name: string,
        area_ha: number,
        avg_head_count: number,
        gross_tco2e: number,
        sequestration_tco2e: number,
        net_balance_tco2e: number
      }>(
        `SELECT 
          ce.paddock_id,
          p.name,
          AVG(ce.paddock_ha) as area_ha,
          AVG(ce.head_count) as avg_head_count,
          SUM(ce.gross_emissions_tco2e) as gross_tco2e,
          SUM(ce.soc_sequestration_tco2e) as sequestration_tco2e,
          SUM(ce.net_balance_tco2e) as net_balance_tco2e
         FROM carbon_estimates ce
         JOIN paddocks p ON p.id = ce.paddock_id
         WHERE ce.org_id = $1 AND EXTRACT(YEAR FROM ce.period_month) = $2
         GROUP BY ce.paddock_id, p.name
         ORDER BY net_balance_tco2e ASC`,
        [auth.orgId, year]
      )
    } catch (e: any) {
      if (!e.message?.includes('does not exist')) throw e
      console.warn('[carbon/summary] carbon_estimates table not found — returning empty data')
    }

    const summary = summaryRes[0] || {
      total_gross_tco2e: 0,
      total_sequestration_tco2e: 0,
      net_balance_tco2e: 0
    }

    return NextResponse.json({
      total_gross_tco2e: Number(summary.total_gross_tco2e || 0),
      total_sequestration_tco2e: Number(summary.total_sequestration_tco2e || 0),
      net_balance_tco2e: Number(summary.net_balance_tco2e || 0),
      paddocks: paddocksRes.map(p => ({
        ...p,
        area_ha: Number(p.area_ha || 0),
        avg_head_count: Number(p.avg_head_count || 0),
        gross_tco2e: Number(p.gross_tco2e || 0),
        sequestration_tco2e: Number(p.sequestration_tco2e || 0),
        net_balance_tco2e: Number(p.net_balance_tco2e || 0),
      })),
      months: [] // Could be added if needed
    })
  } catch (error) {
    console.error('Carbon summary error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
