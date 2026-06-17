/**
 * GET /api/cron/climate-adjustment
 *
 * Cron job — Recalcula el Ajuste Clima para todos los potreros activos
 * (con rodeos pastoreando) de todas las organizaciones elegibles.
 *
 * Agenda sugerida: "0 6 * * *" — todos los días a las 06:00 ART (09:00 UTC)
 *
 * Flujo:
 *   1. Obtiene todas las orgs con plan PLANIFICADOR+ y feature flag activo
 *   2. Para cada org: obtiene potreros activos (GRAZING) + clima API
 *   3. Ejecuta calculateClimateAdjustment para cada potrero
 *   4. Persiste snapshots y despacha alertas si corresponde
 *   5. Retorna resumen de ejecución
 *
 * Protegido con CRON_SECRET en el header Authorization.
 */
import { NextRequest, NextResponse } from 'next/server'
import { serviceQuery, serviceQueryOne, serviceMutate } from '@/lib/db'
import {
  calculateClimateAdjustment,
  type ClimateAdjustmentInput,
  type DroughtIndex,
} from '@/lib/climate-adjustment'
import { dispatchBatchClimateAlerts, type ClimateAlertPayload } from '@/lib/climate-alert-dispatcher'

export const dynamic  = 'force-dynamic'
export const runtime  = 'nodejs'
export const maxDuration = 300 // 5 min timeout para Vercel Pro

const CRON_SECRET  = process.env.CRON_SECRET
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.rodeoagtech.com'

// ─── Eligible plan slugs ─────────────────────────────────────────────────────
const ELIGIBLE_SLUGS = ['planificador', 'pro_ganadero', 'pro_ganadero+', 'holistico', 'latifundio', 'enterprise']

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  // ── Security ──────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  let orgsProcessed = 0
  let paddocksProcessed = 0
  let alertsDispatched = 0
  const errors: string[] = []

  try {
    // ── 1. Feature flag global: ¿está habilitado climate_adjustment? ──────────
    const globalFlag = await serviceQueryOne<{ flag_value: unknown }>(`
      SELECT flag_value FROM system_feature_flags
      WHERE flag_key = 'climate_adjustment' LIMIT 1
    `, []).catch(() => null)

    if (globalFlag && (globalFlag.flag_value === false || globalFlag.flag_value === 'false')) {
      return NextResponse.json({
        skipped: true,
        reason: 'feature_flag_disabled',
        durationMs: Date.now() - startedAt,
      })
    }

    // ── 2. Obtener orgs elegibles ─────────────────────────────────────────────
    const eligibleOrgs = await serviceQuery<{
      org_id: string
      org_name: string
      owner_profile_id: string
      owner_email: string
      owner_first_name: string | null
      latitude: number | null
      longitude: number | null
      default_target_remnant_kg_ha: number | null
      default_daily_allocation_kg: number | null
    }>(`
      SELECT DISTINCT
        o.id         AS org_id,
        o.name       AS org_name,
        pr.id        AS owner_profile_id,
        pr.email     AS owner_email,
        pr.first_name AS owner_first_name,
        o.latitude,
        o.longitude,
        o.default_target_remnant_kg_ha,
        o.default_daily_allocation_kg
      FROM organizations o
      JOIN subscriptions_plans sp ON o.subscription_plan_id = sp.id
      JOIN profiles pr ON pr.organization_id = o.id
                       AND (pr.team_role IS NULL OR pr.team_role = 'owner')
      WHERE sp.slug = ANY($1::text[])
      ORDER BY o.id
    `, [ELIGIBLE_SLUGS])

    if (eligibleOrgs.length === 0) {
      return NextResponse.json({
        orgsProcessed: 0,
        paddocksProcessed: 0,
        alertsDispatched: 0,
        durationMs: Date.now() - startedAt,
      })
    }

    const allAlerts: ClimateAlertPayload[] = []

    // ── 3. Procesar cada org ──────────────────────────────────────────────────
    for (const org of eligibleOrgs) {
      try {
        // 3a. Potreros ACTIVOS únicamente — solo donde el rodeo está pastoreando hoy.
        // Bug fix: excluir status='PLANNED' para evitar alertas en potreros sin ganado.
        // Un plan PLANNED significa que el rodeo aún no entró; solo ACTIVE confirma pastoreo real.
        const activePaddocks = await serviceQuery<{
          paddock_id: string
          paddock_name: string
          area_ha: number
          dry_matter_kg_ha: number | null
          current_ndvi: number | null
          previous_ndvi: number | null
          previous_ndvi_date: string | null
          herd_ids: string[]
          planned_days: number | null
          entry_date: string
          exit_date: string | null
        }>(`
          SELECT
            p.id            AS paddock_id,
            p.name          AS paddock_name,
            p.area_ha,
            p.dry_matter_kg_ha,
            p.current_ndvi,
            p.previous_ndvi,
            p.previous_ndvi_date,
            gp.herd_ids,
            EXTRACT(DAY FROM gp.exit_date - gp.entry_date)::int AS planned_days,
            gp.entry_date::text,
            gp.exit_date::text
          FROM grazing_plans gp
          JOIN paddocks p ON p.id = gp.paddock_id
          WHERE gp.org_id = $1
            AND gp.status = 'ACTIVE'
            AND gp.entry_date <= CURRENT_DATE
            AND (gp.exit_date IS NULL OR gp.exit_date >= CURRENT_DATE)
        `, [org.org_id])

        if (activePaddocks.length === 0) continue

        // 3b. Obtener EV de cada herd (batch)
        const allHerdIds = [...new Set(activePaddocks.flatMap(p => p.herd_ids || []))]
        const herdsData = allHerdIds.length > 0
          ? await serviceQuery<{ id: string; total_ev: number; head_count: number; avg_weight_kg: number | null }>(`
              SELECT id, total_ev, head_count, avg_weight_kg
              FROM herds WHERE id = ANY($1::uuid[]) AND org_id = $2
            `, [allHerdIds, org.org_id])
          : []
        const herdMap = new Map(herdsData.map(h => [h.id, h]))

        // 3c. Clima de la org (API cache o valor por defecto)
        const weatherCache = await serviceQueryOne<{
          humidity: number | null
          wind_speed: number | null
          precipitation_sum: number | null
          drought_index: string | null
          forecast_mm_14d: number | null
          temperatura_c: number | null
          radiacion_solar: number | null
        }>(`
          SELECT humidity, wind_speed, precipitation_sum, drought_index, forecast_mm_14d,
                 temperatura_c, radiacion_solar
          FROM weather_cache
          WHERE org_id = $1
          ORDER BY fetched_at DESC
          LIMIT 1
        `, [org.org_id]).catch(() => null)

        // Lluvias declaradas últimos 7 días
        const rainfall7dRow = await serviceQueryOne<{ total_mm: number }>(`
          SELECT COALESCE(SUM(value), 0) AS total_mm
          FROM weather_events
          WHERE org_id = $1
            AND type = 'RAIN'
            AND date >= CURRENT_DATE - INTERVAL '7 days'
        `, [org.org_id]).catch(() => null)

        // 3d. Calcular por potrero
        for (const paddock of activePaddocks) {
          try {
            // Calcular EV del rodeo en este potrero
            let totalEv = 0
            for (const herdId of (paddock.herd_ids || [])) {
              const h = herdMap.get(herdId)
              if (!h) continue
              if (h.total_ev > 0) {
                totalEv += Number(h.total_ev)
              } else {
                const avgW = Number(h.avg_weight_kg) || 400
                totalEv += Number(h.head_count) * (avgW / 450)
              }
            }

            if (totalEv <= 0) continue

            const daysSincePrevNdvi = paddock.previous_ndvi_date
              ? Math.round((Date.now() - new Date(paddock.previous_ndvi_date).getTime()) / 86400000)
              : undefined

            // Lluvia usuario de los últimos 7 días (prioridad sobre API)
            const userRainRow = await serviceQueryOne<{ total_mm: number }>(`
              SELECT COALESCE(SUM(precipitacion_usuario_mm), 0) AS total_mm
              FROM historial_potrero
              WHERE paddock_id = $1
                AND fecha >= CURRENT_DATE - INTERVAL '7 days'
                AND precipitacion_usuario_mm IS NOT NULL
            `, [paddock.paddock_id]).catch(() => null)

            // NDVI previo desde historial_potrero
            const prevNdviRow = await serviceQueryOne<{ ndvi: number; fecha: string }>(`
              SELECT ndvi, fecha::text FROM historial_potrero
              WHERE paddock_id = $1 AND ndvi IS NOT NULL AND fecha < CURRENT_DATE
              ORDER BY fecha DESC LIMIT 1
            `, [paddock.paddock_id]).catch(() => null)

            const rainfallManual = (userRainRow?.total_mm ?? 0) > 0
              ? Number(userRainRow!.total_mm)
              : undefined

            // Remanente holístico: usa el configurado por el usuario, no el hardcodeado
            const targetRemnantKgHa = Number(org.default_target_remnant_kg_ha) || 600
            const dailyRationKgEv   = Number(org.default_daily_allocation_kg)  || 12

            const input: ClimateAdjustmentInput = {
              paddockId:             paddock.paddock_id,
              areaHa:                Number(paddock.area_ha) || 1,
              currentForageMsHa:     Number(paddock.dry_matter_kg_ha) || 1200,
              currentNdvi:           Number(paddock.current_ndvi) || 0.50,
              previousNdvi:          prevNdviRow?.ndvi ? Number(prevNdviRow.ndvi)
                                       : (paddock.previous_ndvi ? Number(paddock.previous_ndvi) : undefined),
              daysSincePreviousNdvi: daysSincePrevNdvi,
              totalEv,
              dailyRationKgPerEv:    dailyRationKgEv,
              targetRemnantKgHa,
              rainfall7dMm:          Number(rainfall7dRow?.total_mm) || Number(weatherCache?.precipitation_sum) || 0,
              rainfallManualMm:      rainfallManual,
              humidityPct:           Number(weatherCache?.humidity) || 65,
              forecastRainfall14dMm: Number(weatherCache?.forecast_mm_14d) || 0,
              droughtIndex:          (weatherCache?.drought_index as DroughtIndex) || 'NONE',
              avgWindKmh:            Number(weatherCache?.wind_speed) || undefined,
              temperaturaC:          weatherCache?.temperatura_c != null ? Number(weatherCache.temperatura_c) : undefined,
              radiacionSolar:        weatherCache?.radiacion_solar != null ? Number(weatherCache.radiacion_solar) : undefined,
              latitudCampo:          org.latitude ?? undefined,
              currentMonth:          new Date().getMonth() + 1,
            }

            // originalDays: días planificados del plan ACTIVO actual (no un default arbitrario)
            const originalDays = paddock.planned_days ?? 0
            const result = calculateClimateAdjustment(input, originalDays)

            // Persistir snapshot
            await serviceMutate(`
              INSERT INTO climate_adjustment_snapshots (
                org_id, paddock_id, ndvi, rainfall_7d_mm, humidity_pct,
                drought_index, forage_ms_ha, total_ev, grass_growth_rate,
                climate_multiplier, base_remaining_days, adjusted_remaining_days,
                alert_level, alert_message, delta_from_plan, multiplier_breakdown
              ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
              )
            `, [
              org.org_id, paddock.paddock_id,
              input.currentNdvi, input.rainfall7dMm, input.humidityPct,
              input.droughtIndex, input.currentForageMsHa, input.totalEv,
              result.grassGrowthRateKgHaDay, result.climateMultiplier,
              result.baseRemainingDays, result.adjustedRemainingDays,
              result.alertLevel, result.alertMessage, result.deltaFromPlan,
              JSON.stringify(result.multiplierBreakdown),
            ]).catch(() => {})

            // Upsert en historial_potrero con datos del día
            const wb = result.waterBalance
            const flags = result.dataSourceFlags
            await serviceMutate(`
              INSERT INTO historial_potrero (
                org_id, paddock_id, fecha,
                ndvi, precipitacion_api_mm,
                humedad_pct, velocidad_viento_kmh, temperatura_c, radiacion_solar,
                et_calculada_mm, balance_hidrico_mm, c_adj,
                lluvia_fuente, rs_fuente, temp_fuente
              ) VALUES (
                $1,$2,CURRENT_DATE,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
              )
              ON CONFLICT (paddock_id, fecha) DO UPDATE SET
                ndvi                 = COALESCE(EXCLUDED.ndvi, historial_potrero.ndvi),
                precipitacion_api_mm = EXCLUDED.precipitacion_api_mm,
                humedad_pct          = EXCLUDED.humedad_pct,
                velocidad_viento_kmh = EXCLUDED.velocidad_viento_kmh,
                temperatura_c        = EXCLUDED.temperatura_c,
                radiacion_solar      = EXCLUDED.radiacion_solar,
                et_calculada_mm      = EXCLUDED.et_calculada_mm,
                balance_hidrico_mm   = EXCLUDED.balance_hidrico_mm,
                c_adj                = EXCLUDED.c_adj,
                rs_fuente            = EXCLUDED.rs_fuente,
                temp_fuente          = EXCLUDED.temp_fuente,
                updated_at           = NOW()
            `, [
              org.org_id,
              paddock.paddock_id,
              input.currentNdvi,
              input.rainfall7dMm,
              input.humidityPct,
              input.avgWindKmh ?? null,
              input.temperaturaC ?? null,
              input.radiacionSolar ?? null,
              wb.etCalculadaMm,
              wb.balanceHidricoMm,
              result.climateMultiplier,
              flags.rainfallSource,
              flags.rsSource,
              flags.tempSource,
            ]).catch(() => {})

            paddocksProcessed++

            // Acumular alertas para despacho en batch ha sido desactivado
            // según requerimiento del cliente.
          } catch (err: any) {
            errors.push(`org=${org.org_id} paddock=${paddock.paddock_id}: ${err.message}`)
          }
        }

        orgsProcessed++
      } catch (err: any) {
        errors.push(`org=${org.org_id}: ${err.message}`)
        console.error('[climate-cron] org error:', org.org_id, err)
      }
    }

    // ── 4. Despachar alertas en batch (Desactivado) ───────────────────────────
    alertsDispatched = 0

    const durationMs = Date.now() - startedAt
    console.log(`[climate-cron] ✓ orgs=${orgsProcessed} paddocks=${paddocksProcessed} alerts=${alertsDispatched} ms=${durationMs}`)

    return NextResponse.json({
      success:           true,
      orgsProcessed,
      paddocksProcessed,
      alertsDispatched,
      errorsCount:       errors.length,
      errors:            errors.length > 0 ? errors.slice(0, 10) : undefined,
      durationMs,
    })
  } catch (err: any) {
    console.error('[climate-cron] fatal error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
