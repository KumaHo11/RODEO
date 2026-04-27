/**
 * GET /api/weather/insights
 * Computa métricas agregadas del módulo Clima para la org:
 *   - Top potreros por mm acumulados (lluvia)
 *   - Top potreros más afectados por heladas
 *   - Potreros "ciegos" (sin registros en últimos 90 días)
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { queryOne, query } from '@/lib/db'
import type { WeatherInsights, PaddockRainfallStat, PaddockFrostStat, BlindPaddock } from '@/lib/types/weather'

const BLIND_DAYS_THRESHOLD = 90

async function getAuth(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim() || ''
  if (!token) return null
  const decoded = await verifyFirebaseToken(token)
  if (!decoded) return null
  const profile = await queryOne<{ organization_id: string }>(
    'SELECT organization_id FROM profiles WHERE firebase_uid = $1',
    [decoded.uid]
  )
  if (!profile?.organization_id) return null
  return { orgId: profile.organization_id }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuth(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { orgId } = auth

    // ── 1. Rain: total mm per paddock ─────────────────────────────────────────
    const rainRows = await query<{ paddock_id: string; paddock_name: string; total_mm: string; event_count: string }>(`
      SELECT
        p.id    AS paddock_id,
        p.name  AS paddock_name,
        COALESCE(SUM(we.value), 0)::NUMERIC AS total_mm,
        COUNT(wep.weather_event_id)::INTEGER AS event_count
      FROM paddocks p
      JOIN weather_event_paddocks wep ON wep.paddock_id = p.id
      JOIN weather_events we ON we.id = wep.weather_event_id AND we.type = 'RAIN'
      WHERE p.org_id = $1
      GROUP BY p.id, p.name
      ORDER BY total_mm DESC
      LIMIT 5
    `, [orgId])

    const topRainfallPaddocks: PaddockRainfallStat[] = rainRows.map(r => ({
      paddockId:   r.paddock_id,
      paddockName: r.paddock_name,
      totalMm:     Math.round(Number(r.total_mm) * 10) / 10,
      eventCount:  Number(r.event_count),
    }))

    // ── 2. Frost: count of events + min temp per paddock ──────────────────────
    const frostRows = await query<{ paddock_id: string; paddock_name: string; frost_count: string; min_temp: string }>(`
      SELECT
        p.id    AS paddock_id,
        p.name  AS paddock_name,
        COUNT(wep.weather_event_id)::INTEGER AS frost_count,
        MIN(we.value)::NUMERIC            AS min_temp
      FROM paddocks p
      JOIN weather_event_paddocks wep ON wep.paddock_id = p.id
      JOIN weather_events we ON we.id = wep.weather_event_id AND we.type = 'FROST'
      WHERE p.org_id = $1
      GROUP BY p.id, p.name
      ORDER BY frost_count DESC
      LIMIT 5
    `, [orgId])

    const topFrostPaddocks: PaddockFrostStat[] = frostRows.map(r => ({
      paddockId:       r.paddock_id,
      paddockName:     r.paddock_name,
      frostEventCount: Number(r.frost_count),
      minTempC:        Number(r.min_temp),
    }))

    // ── 3. Blind paddocks — no events in last N days ──────────────────────────
    const allPaddocks = await query<{ id: string; name: string; last_event: string | null }>(`
      SELECT
        p.id,
        p.name,
        MAX(we.date) AS last_event
      FROM paddocks p
      LEFT JOIN weather_event_paddocks wep ON wep.paddock_id = p.id
      LEFT JOIN weather_events we ON we.id = wep.weather_event_id
      WHERE p.org_id = $1
      GROUP BY p.id, p.name
    `, [orgId])

    const now = Date.now()
    const thresholdMs = BLIND_DAYS_THRESHOLD * 24 * 60 * 60 * 1000

    const blindPaddocks: BlindPaddock[] = allPaddocks
      .filter(p => {
        if (!p.last_event) return true
        const daysSince = (now - new Date(p.last_event).getTime()) / (1000 * 60 * 60 * 24)
        return daysSince >= BLIND_DAYS_THRESHOLD
      })
      .map(p => ({
        paddockId: p.id,
        paddockName: p.name,
        daysSinceLastEvent: p.last_event
          ? Math.floor((now - new Date(p.last_event).getTime()) / (1000 * 60 * 60 * 24))
          : null,
      }))
      .sort((a, b) => {
        if (a.daysSinceLastEvent === null && b.daysSinceLastEvent === null) return 0
        if (a.daysSinceLastEvent === null) return -1
        if (b.daysSinceLastEvent === null) return 1
        return b.daysSinceLastEvent - a.daysSinceLastEvent
      })

    const insights: WeatherInsights = {
      topRainfallPaddocks,
      topFrostPaddocks,
      blindPaddocks,
      computedAt: new Date().toISOString(),
    }

    return NextResponse.json(insights)
  } catch (err: unknown) {
    console.error('[GET /api/weather/insights]', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
