/**
 * POST /api/climate-adjustment
 * GET  /api/climate-adjustment
 *
 * Calcula el "Ajuste Clima" para un potrero específico.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { queryOne, query, mutate } from '@/lib/db'
import {
  calculateClimateAdjustment,
  validateClimateAdjustmentAccess,
  type ClimateAdjustmentInput,
  type DroughtIndex,
} from '@/lib/climate-adjustment'
import { dispatchClimateAlert } from '@/lib/climate-alert-dispatcher'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ── Auth helper ───────────────────────────────────────────────────────────────
async function getAuth(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim() || ''
  if (!token) return null
  const decoded = await verifyFirebaseToken(token).catch(() => null)
  if (!decoded) return null
  const profile = await queryOne<{ id: string; organization_id: string }>(
    'SELECT id, organization_id FROM profiles WHERE firebase_uid = $1',
    [decoded.uid]
  ).catch(() => null)
  if (!profile?.organization_id) return null
  return { uid: decoded.uid, profileId: profile.id, orgId: profile.organization_id }
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // Auth
    const auth = await getAuth(req)
    if (!auth) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Plan + feature flag validation
    const access = await validateClimateAdjustmentAccess(auth.uid)
    if (!access.allowed) {
      const messages: Record<string, string> = {
        plan_insufficient:     'Tu plan no incluye Ajuste Clima. Actualizá a Planificador o superior.',
        feature_flag_disabled: 'La funcionalidad de Ajuste Clima está temporalmente deshabilitada.',
        unauthorized:          'No autorizado.',
      }
      return NextResponse.json(
        { error: messages[access.reason ?? 'unauthorized'] ?? 'Sin acceso' },
        { status: 403 }
      )
    }

    // Parse body
    const body = await req.json()
    const { paddockId, plannedDays = 21, rainfallManualMm, overrideNdvi } = body

    if (!paddockId) {
      return NextResponse.json({ error: 'paddockId es requerido' }, { status: 400 })
    }

    // Fetch paddock
    const paddock = await queryOne<{
      id: string; name: string; area_ha: number
      dry_matter_kg_ha: number | null
      current_ndvi: number | null
      previous_ndvi_date: string | null
      org_id: string; current_status: string
    }>(`
      SELECT id, name, area_ha, dry_matter_kg_ha, current_ndvi,
             previous_ndvi_date, org_id, current_status
      FROM paddocks
      WHERE id = $1 AND org_id = $2
    `, [paddockId, auth.orgId])

    if (!paddock) {
      return NextResponse.json({ error: 'Potrero no encontrado' }, { status: 404 })
    }

    // Active grazing plan — use broad status filter and date range
    const today = new Date().toISOString().split('T')[0]
    const activePlans = await query<{
      herd_ids: string[] | null; entry_date: string
      exit_date: string | null; planned_recovery_days: number | null; status: string
    }>(`
      SELECT herd_ids, entry_date, exit_date, planned_recovery_days, status
      FROM grazing_plans
      WHERE paddock_id = $1 AND org_id = $2
        AND entry_date <= $3
        AND (exit_date IS NULL OR exit_date >= $3)
      ORDER BY entry_date DESC
      LIMIT 1
    `, [paddockId, auth.orgId, today]).catch(() => [] as any[])

    const activePlan = activePlans[0] ?? null

    // Get total EV from herds
    let totalEv = 0
    const herdIds: string[] = Array.isArray(activePlan?.herd_ids)
      ? activePlan.herd_ids
      : []

    if (herdIds.length > 0) {
      const herds = await query<{ total_ev: number; head_count: number; avg_weight_kg: number | null }>(`
        SELECT total_ev, head_count, avg_weight_kg
        FROM herds WHERE id = ANY($1::uuid[]) AND org_id = $2
      `, [herdIds, auth.orgId]).catch(() => [] as any[])

      totalEv = herds.reduce((sum: number, h: any) => {
        if (Number(h.total_ev) > 0) return sum + Number(h.total_ev)
        const avgW = Number(h.avg_weight_kg) || 400
        return sum + Number(h.head_count) * (avgW / 450)
      }, 0)
    }

    // If no herds in active plan, try to get any herd EV for this org as fallback
    if (totalEv <= 0) {
      const anyHerd = await queryOne<{ total_ev: number }>(`
        SELECT COALESCE(SUM(total_ev), 0) AS total_ev FROM herds WHERE org_id = $1
      `, [auth.orgId]).catch(() => null)
      totalEv = Number(anyHerd?.total_ev) || 1
    }

    // Weather data (from cache or defaults)
    const apiWeather = await queryOne<{
      humidity: number | null; wind_speed: number | null
      precipitation_sum: number | null; drought_index: string | null
      forecast_mm_14d: number | null
    }>(`
      SELECT humidity, wind_speed, precipitation_sum, drought_index, forecast_mm_14d
      FROM weather_cache WHERE org_id = $1 ORDER BY fetched_at DESC LIMIT 1
    `, [auth.orgId]).catch(() => null)

    // Manual rainfall events last 7d
    const rainfallRow = await queryOne<{ total_mm: number }>(`
      SELECT COALESCE(SUM(value), 0) AS total_mm
      FROM weather_events
      WHERE org_id = $1 AND type = 'RAIN' AND date >= CURRENT_DATE - INTERVAL '7 days'
    `, [auth.orgId]).catch(() => null)

    // Days since previous NDVI
    let daysSincePreviousNdvi: number | undefined
    if (paddock.previous_ndvi_date) {
      daysSincePreviousNdvi = Math.round(
        (Date.now() - new Date(paddock.previous_ndvi_date).getTime()) / 86400000
      )
    }

    // Build input
    const adjustmentInput: ClimateAdjustmentInput = {
      paddockId:              paddock.id,
      areaHa:                 Math.max(0.1, Number(paddock.area_ha) || 1),
      currentForageMsHa:      Number(paddock.dry_matter_kg_ha) || 1200,
      currentNdvi:            (overrideNdvi ?? Number(paddock.current_ndvi)) || 0.50,
      daysSincePreviousNdvi,
      totalEv:                Math.max(0.1, totalEv),
      dailyRationKgPerEv:     12,
      rainfall7dMm:           Number(rainfallRow?.total_mm) || Number(apiWeather?.precipitation_sum) || 0,
      rainfallManualMm:       rainfallManualMm !== undefined ? Number(rainfallManualMm) : undefined,
      humidityPct:            Number(apiWeather?.humidity) || 65,
      forecastRainfall14dMm:  Number(apiWeather?.forecast_mm_14d) || 0,
      droughtIndex:           (apiWeather?.drought_index as DroughtIndex) || 'NONE',
      avgWindKmh:             Number(apiWeather?.wind_speed) || undefined,
      currentMonth:           new Date().getMonth() + 1,
    }

    // Calculate
    const result = calculateClimateAdjustment(adjustmentInput, plannedDays)

    // Persist snapshot (non-fatal)
    await persistSnapshot(auth.orgId, paddockId, adjustmentInput, result)

    // Dispatch alert if needed (non-fatal)
    if (result.alertLevel !== 'ok' && result.alertMessage) {
      dispatchClimateAlert({
        orgId:        auth.orgId,
        profileId:    auth.profileId,
        paddockId,
        paddockName:  paddock.name,
        alertLevel:   result.alertLevel,
        alertMessage: result.alertMessage,
        adjustedDays: result.adjustedRemainingDays,
        originalDays: plannedDays,
        deltaFromPlan: result.deltaFromPlan,
      }).catch(err => console.warn('[climate-adjustment] alert skipped:', err?.message))
    }

    return NextResponse.json({
      paddock: {
        id:     paddock.id,
        name:   paddock.name,
        areaHa: paddock.area_ha,
        status: paddock.current_status,
      },
      activePlan: activePlan ? {
        entryDate:    activePlan.entry_date,
        exitDate:     activePlan.exit_date,
        status:       activePlan.status,
        recoveryDays: activePlan.planned_recovery_days,
      } : null,
      totalEv: Math.round(totalEv * 10) / 10,
      inputSummary: {
        ndvi:          adjustmentInput.currentNdvi,
        rainfall7dMm:  adjustmentInput.rainfall7dMm,
        humidity:      adjustmentInput.humidityPct,
        drought:       adjustmentInput.droughtIndex,
        forageMsHa:    adjustmentInput.currentForageMsHa,
      },
      result,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/climate-adjustment]', msg)
    return NextResponse.json({ error: 'Error del servidor', detail: msg }, { status: 500 })
  }
}

// ── GET: historial de snapshots ───────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuth(req)
    if (!auth) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const access = await validateClimateAdjustmentAccess(auth.uid)
    if (!access.allowed) {
      return NextResponse.json({ error: 'Sin acceso', required: 'PLANIFICADOR' }, { status: 403 })
    }

    const snapshots = await query<Record<string, unknown>>(`
      SELECT
        ca.id, ca.paddock_id, ca.ndvi, ca.rainfall_7d_mm, ca.humidity_pct,
        ca.drought_index, ca.forage_ms_ha, ca.total_ev, ca.grass_growth_rate,
        ca.climate_multiplier, ca.base_remaining_days, ca.adjusted_remaining_days,
        ca.alert_level, ca.alert_message, ca.delta_from_plan,
        ca.multiplier_breakdown, ca.calculated_at,
        p.name AS paddock_name, p.area_ha
      FROM climate_adjustment_snapshots ca
      JOIN paddocks p ON p.id = ca.paddock_id
      WHERE ca.org_id = $1
      ORDER BY ca.calculated_at DESC
      LIMIT 500
    `, [auth.orgId]).catch(() => [])

    return NextResponse.json({ snapshots })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET /api/climate-adjustment]', msg)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

// ── Persist snapshot ──────────────────────────────────────────────────────────
async function persistSnapshot(
  orgId: string,
  paddockId: string,
  input: ClimateAdjustmentInput,
  result: ReturnType<typeof calculateClimateAdjustment>
) {
  try {
    await mutate(`
      INSERT INTO climate_adjustment_snapshots (
        org_id, paddock_id, ndvi, rainfall_7d_mm, humidity_pct,
        drought_index, forage_ms_ha, total_ev, grass_growth_rate,
        climate_multiplier, base_remaining_days, adjusted_remaining_days,
        alert_level, alert_message, delta_from_plan, multiplier_breakdown
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    `, [
      orgId, paddockId,
      input.currentNdvi, input.rainfall7dMm, input.humidityPct,
      input.droughtIndex, input.currentForageMsHa, input.totalEv,
      result.grassGrowthRateKgHaDay, result.climateMultiplier,
      result.baseRemainingDays, result.adjustedRemainingDays,
      result.alertLevel, result.alertMessage, result.deltaFromPlan,
      JSON.stringify({ ...result.multiplierBreakdown, animalImpact: result.animalImpact }),
    ])
  } catch (err) {
    console.warn('[climate-adjustment] snapshot skipped:', err instanceof Error ? err.message : err)
  }
}
