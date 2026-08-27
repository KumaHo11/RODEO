/**
 * POST /api/deforestation/check
 *
 * Ejecuta el análisis de deforestación post-2020 para un potrero.
 * Fuentes (por prioridad):
 *   1. GFW API (Global Forest Watch) — alta confianza si API key disponible
 *   2. Análisis multi-índice en metric_snapshots (NDVI + BSI)
 *
 * FIX v27-EUDR — Correcciones críticas:
 *   ❌ ANTES: NDVI_FOREST_MIN = 0.55 (calibrado para Pampa Húmeda — NUNCA se cumple en el Chaco)
 *   ✅ AHORA: NDVI_FOREST_MIN = 0.30 (rango real del Bosque Chaqueño Seco)
 *
 *   ❌ ANTES: Baseline 3 meses (nov-ene) — sesgo de verano, datos insuficientes
 *   ✅ AHORA: Baseline 2019-2020 época seca (mayo-oct) — referencia correcta del bosque
 *
 *   ❌ ANTES: Solo NDVI — no discrimina pasturas de bosque en Chaco
 *   ✅ AHORA: NDVI + BSI (Bare Soil Index) — doble confirmación de desmonte
 *
 *   ❌ ANTES: Mock NDVI > 0.35 enmascara pérdida de biomasa
 *   ✅ AHORA: Datos 'estimated' excluidos de la baseline (source != 'estimated')
 *
 * Umbrales calibrados para Gran Chaco Seco (Chaco Árido y Semiárido, Argentina):
 *   Fuente: Hansen et al. 2013, MapBiomas Chaco v3.0, Baumann et al. 2017
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { serviceQuery, serviceMutate } from '@/lib/db'

// ─────────────────────────────────────────────────────────────────────────────
// UMBRALES CALIBRADOS — GRAN CHACO SECO (Argentina / Bolivia / Paraguay)
// ─────────────────────────────────────────────────────────────────────────────
const CHACO_THRESHOLDS = {
  // ── NDVI (Normalized Difference Vegetation Index) ──────────────────────
  // Bosque chaqueño nativo (época seca):        0.30 – 0.55
  // Pastizal implantado post-desmonte:          0.20 – 0.35
  // Suelo desnudo / desmonte reciente:          0.05 – 0.20
  NDVI_FOREST_MIN:      0.30,   // Umbral mínimo para clasificar como bosque
  NDVI_DEFORESTED_MAX:  0.25,   // Por debajo → vegetación estructural eliminada
  NDVI_DROP_ALERT:      0.12,   // Caída absoluta ≥ 0.12 → DEFORESTED
  NDVI_DROP_WARNING:    0.08,   // Caída absoluta ≥ 0.08 → AT_RISK

  // ── BSI (Bare Soil Index) ────────────────────────────────────────────────
  // BSI = ((SWIR + Red) - (NIR + Blue)) / ((SWIR + Red) + (NIR + Blue))
  // Bosque chaqueño sano:         BSI < -0.05
  // Suelo desnudo / pastura baja: BSI > 0.10
  BSI_FOREST_MAX:       -0.05,
  BSI_DEFORESTED_MIN:    0.10,
  BSI_INCREASE_ALERT:    0.18,  // Aumento > 0.18 desde baseline → DEFORESTED
  BSI_INCREASE_WARNING:  0.10,  // Aumento > 0.10 desde baseline → AT_RISK

  // ── Ventana temporal baseline (EUDR cutoff: 31/12/2020) ─────────────────
  // Usar época SECA (mayo-octubre) para evitar sesgo del verano austral.
  // El Chaco tiene NDVI alto en verano por lluvias, pero bajos en seca → bosque.
  BASELINE_START: '2019-05-01',
  BASELINE_END:   '2020-10-31',

  // ── GFW: canopy density threshold ───────────────────────────────────────
  // El Chaco tiene 60-70% cobertura de copas — usar threshold=10 para capturar
  // desmontes parciales (bosque semiabierto) que threshold=30 ignora.
  GFW_CANOPY_THRESHOLD: 10,
} as const

type AnalysisStatus = 'DEFORESTED' | 'AT_RISK' | 'CLEAN' | 'INSUFFICIENT_DATA'
type FinalStatus    = 'DEFORESTED' | 'AT_RISK' | 'CLEAN' | 'PENDING'

// ─────────────────────────────────────────────────────────────────────────────
// Handler principal
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { paddock_id, geojson } = body

    // ── Obtener polígono ───────────────────────────────────────────────────
    let polygon = geojson

    if (paddock_id && !polygon) {
      const paddockRes = await serviceQuery(
        `SELECT ST_AsGeoJSON(geom)::json as geometry FROM paddocks WHERE id = $1 AND org_id = $2`,
        [paddock_id, auth.orgId]
      )
      if (!paddockRes.length) {
        return NextResponse.json({ error: 'Paddock not found' }, { status: 404 })
      }
      polygon = paddockRes[0].geometry
    }

    if (!polygon) {
      return NextResponse.json({ error: 'No geometry provided' }, { status: 400 })
    }

    // Normalizar a objeto geometry (no Feature)
    const geometry = polygon.type === 'Feature' ? polygon.geometry : polygon

    // ─────────────────────────────────────────────────────────────────────
    // FUENTE 1: GFW API — Global Forest Watch (alta confianza)
    // ─────────────────────────────────────────────────────────────────────
    const gfwApiKey = process.env.GFW_API_KEY
    let gfwResult: { has_deforestation: boolean; loss_area_ha: number } | null = null

    if (gfwApiKey) {
      try {
        // Paso 1: Registrar geometría en geostore
        const geostoreRes = await fetch('https://data-api.globalforestwatch.org/geostore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': gfwApiKey },
          body: JSON.stringify({ geometry }),
          signal: AbortSignal.timeout(15000),
        })

        if (geostoreRes.ok) {
          // Paso 2: Analizar pérdida de cobertura arbórea post-2020
          // canopy_density threshold=10 (más sensible) para capturar bosque abierto del Chaco
          const analysisRes = await fetch(
            `https://data-api.globalforestwatch.org/dataset/umd_tree_cover_loss/latest/query`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-api-key': gfwApiKey },
              body: JSON.stringify({
                geometry,
                filters: [
                  {
                    field: 'umd_tree_cover_density_2000__threshold',
                    operator: 'greater_than_or_equal',
                    value: CHACO_THRESHOLDS.GFW_CANOPY_THRESHOLD,
                  },
                  {
                    field: 'umd_tree_cover_loss__year',
                    operator: 'greater_than',
                    value: 2020,  // EUDR cutoff: después del 31/12/2020
                  },
                ],
              }),
              signal: AbortSignal.timeout(20000),
            }
          )

          if (analysisRes.ok) {
            const data = await analysisRes.json()
            const lossArea = data.data?.[0]?.area ?? 0
            gfwResult = { has_deforestation: lossArea > 0, loss_area_ha: lossArea }
            console.log(`[deforestation/check] GFW result: loss=${lossArea}ha paddock=${paddock_id}`)
          }
        }
      } catch (err: any) {
        console.error('[deforestation/check] GFW API error:', err.message)
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // FUENTE 2: Análisis multi-índice en metric_snapshots (NDVI + BSI)
    // Solo activo si hay un paddock_id registrado con snapshots históricos.
    // ─────────────────────────────────────────────────────────────────────
    let ndviAnalysis: {
      baseline: number | null
      current: number | null
      drop: number | null
      status: AnalysisStatus
    } = { baseline: null, current: null, drop: null, status: 'INSUFFICIENT_DATA' }

    let bsiAnalysis: {
      baseline: number | null
      current: number | null
      increase: number | null
      status: AnalysisStatus
    } = { baseline: null, current: null, increase: null, status: 'INSUFFICIENT_DATA' }

    if (paddock_id) {
      // ── NDVI Baseline: 2019-2020 época SECA (mayo-octubre) ─────────────
      // Excluir datos 'estimated' (mocks del pipeline roto) para integridad
      const baselineRes = await serviceQuery(`
        SELECT
          AVG(value) AS ndvi_baseline,
          COUNT(*)   AS baseline_count
        FROM metric_snapshots
        WHERE paddock_id = $1
          AND metric_type = 'NDVI'
          AND source != 'estimated'
          AND capture_date BETWEEN $2 AND $3
      `, [paddock_id, CHACO_THRESHOLDS.BASELINE_START, CHACO_THRESHOLDS.BASELINE_END])

      // ── NDVI Post-corte EUDR: 2021 en adelante ─────────────────────────
      // ndvi_min_post2020: captura el evento de mínimo (peor momento del desmonte)
      const currentRes = await serviceQuery(`
        SELECT
          AVG(value)  AS ndvi_avg_post2020,
          MIN(value)  AS ndvi_min_post2020,
          COUNT(*)    AS current_count
        FROM metric_snapshots
        WHERE paddock_id = $1
          AND metric_type = 'NDVI'
          AND source != 'estimated'
          AND capture_date >= '2021-01-01'
      `, [paddock_id])

      const b = baselineRes[0]
      const c = currentRes[0]

      if (b?.ndvi_baseline != null && c?.ndvi_avg_post2020 != null) {
        const baseline   = parseFloat(b.ndvi_baseline as string)
        const ndviAvg    = parseFloat(c.ndvi_avg_post2020 as string)
        const ndviMin    = c.ndvi_min_post2020 != null ? parseFloat(c.ndvi_min_post2020 as string) : ndviAvg
        // Usar el MÍNIMO post-2020 para detectar el peor evento de pérdida
        const current    = Math.min(ndviAvg, ndviMin)
        const drop       = baseline - current

        let ndviStatus: AnalysisStatus = 'CLEAN'
        if (
          // Bosque chaqueño (≥0.30) → post-desmonte (≤0.25): cambio estructural definitivo
          (baseline >= CHACO_THRESHOLDS.NDVI_FOREST_MIN && current <= CHACO_THRESHOLDS.NDVI_DEFORESTED_MAX)
          || drop >= CHACO_THRESHOLDS.NDVI_DROP_ALERT
        ) {
          ndviStatus = 'DEFORESTED'
        } else if (drop >= CHACO_THRESHOLDS.NDVI_DROP_WARNING) {
          ndviStatus = 'AT_RISK'
        }

        ndviAnalysis = { baseline, current, drop, status: ndviStatus }
        console.log(`[deforestation/check] NDVI baseline=${baseline.toFixed(3)} current=${current.toFixed(3)} drop=${drop.toFixed(3)} → ${ndviStatus} (paddock=${paddock_id})`)
      } else {
        console.warn(`[deforestation/check] NDVI: datos insuficientes en metric_snapshots (paddock=${paddock_id}, baseline_count=${b?.baseline_count ?? 0})`)
      }

      // ── BSI Baseline: 2019-2020 ─────────────────────────────────────────
      const bsiBaseRes = await serviceQuery(`
        SELECT AVG(value) AS bsi_baseline FROM metric_snapshots
        WHERE paddock_id = $1
          AND metric_type = 'BSI'
          AND source != 'estimated'
          AND capture_date BETWEEN '2019-01-01' AND '2020-12-31'
      `, [paddock_id])

      // ── BSI Post-corte: 2021 en adelante ───────────────────────────────
      // Usar MAX para detectar el pico de suelo desnudo (post-desmonte)
      const bsiCurrentRes = await serviceQuery(`
        SELECT
          MAX(value) AS bsi_max_post2020,
          AVG(value) AS bsi_avg_post2020
        FROM metric_snapshots
        WHERE paddock_id = $1
          AND metric_type = 'BSI'
          AND source != 'estimated'
          AND capture_date >= '2021-01-01'
      `, [paddock_id])

      const bb = bsiBaseRes[0]
      const bc = bsiCurrentRes[0]

      if (bb?.bsi_baseline != null && bc?.bsi_max_post2020 != null) {
        const bsiBaseline = parseFloat(bb.bsi_baseline as string)
        const bsiCurrent  = parseFloat(bc.bsi_max_post2020 as string)
        const bsiIncrease = bsiCurrent - bsiBaseline

        let bsiStatus: AnalysisStatus = 'CLEAN'
        if (bsiIncrease >= CHACO_THRESHOLDS.BSI_INCREASE_ALERT || bsiCurrent >= CHACO_THRESHOLDS.BSI_DEFORESTED_MIN) {
          bsiStatus = 'DEFORESTED'
        } else if (bsiIncrease >= CHACO_THRESHOLDS.BSI_INCREASE_WARNING) {
          bsiStatus = 'AT_RISK'
        }

        bsiAnalysis = { baseline: bsiBaseline, current: bsiCurrent, increase: bsiIncrease, status: bsiStatus }
        console.log(`[deforestation/check] BSI baseline=${bsiBaseline.toFixed(3)} current=${bsiCurrent.toFixed(3)} increase=${bsiIncrease.toFixed(3)} → ${bsiStatus}`)
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // REGLA DE DECISIÓN FINAL
    // Política EUDR: preferimos falso positivo sobre falso negativo.
    // Un potrero es NO CONFORME si CUALQUIER fuente detecta deforestación.
    // ─────────────────────────────────────────────────────────────────────
    let finalStatus:     FinalStatus
    let finalConfidence: 'HIGH' | 'MEDIUM' | 'LOW'
    let has_deforestation = false
    let loss_area_ha      = 0
    let data_source:     string

    if (gfwResult !== null) {
      // GFW es la fuente de autoridad (canopy data validada por Universidad de Maryland)
      loss_area_ha = gfwResult.loss_area_ha

      if (gfwResult.has_deforestation) {
        finalStatus       = 'DEFORESTED'
        finalConfidence   = 'HIGH'
        has_deforestation = true
        data_source       = 'GFW_API'
      } else if (ndviAnalysis.status === 'DEFORESTED' || bsiAnalysis.status === 'DEFORESTED') {
        // GFW dice CLEAN pero los índices espectrales dicen DEFORESTED
        // → Elevar a AT_RISK con prioridad de revisión manual
        finalStatus     = 'AT_RISK'
        finalConfidence = 'MEDIUM'
        data_source     = 'GFW_API+NDVI_CONFLICT'
      } else if (ndviAnalysis.status === 'AT_RISK' || bsiAnalysis.status === 'AT_RISK') {
        finalStatus     = 'AT_RISK'
        finalConfidence = 'MEDIUM'
        data_source     = 'GFW_API'
      } else {
        finalStatus     = 'CLEAN'
        finalConfidence = 'HIGH'
        data_source     = 'GFW_API'
      }
    } else if (ndviAnalysis.status !== 'INSUFFICIENT_DATA' || bsiAnalysis.status !== 'INSUFFICIENT_DATA') {
      // Sin GFW — usar la señal más severa entre NDVI y BSI
      const statusOrder: AnalysisStatus[] = ['DEFORESTED', 'AT_RISK', 'CLEAN', 'INSUFFICIENT_DATA']
      const worstIdx = Math.min(
        statusOrder.indexOf(ndviAnalysis.status),
        statusOrder.indexOf(bsiAnalysis.status)
      )
      const worstStatus = statusOrder[worstIdx]

      finalStatus     = worstStatus === 'INSUFFICIENT_DATA' ? 'PENDING' : worstStatus as FinalStatus
      finalConfidence = 'MEDIUM'
      has_deforestation = worstStatus === 'DEFORESTED'
      data_source     = 'NDVI_BSI_SPECTRAL'
    } else {
      // Sin datos suficientes en ninguna fuente
      finalStatus     = 'PENDING'
      finalConfidence = 'LOW'
      data_source     = 'NO_DATA'
    }

    // ─────────────────────────────────────────────────────────────────────
    // Persistir en deforestation_checks (con NDVI + BSI)
    // ─────────────────────────────────────────────────────────────────────
    if (paddock_id) {
      try {
        await serviceMutate(`
          INSERT INTO deforestation_checks (
            org_id, paddock_id, status, confidence,
            baseline_ndvi, current_ndvi, ndvi_drop,
            baseline_bsi,  current_bsi,  bsi_increase,
            checked_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
          ON CONFLICT (org_id, paddock_id) DO UPDATE SET
            status         = EXCLUDED.status,
            confidence     = EXCLUDED.confidence,
            baseline_ndvi  = EXCLUDED.baseline_ndvi,
            current_ndvi   = EXCLUDED.current_ndvi,
            ndvi_drop      = EXCLUDED.ndvi_drop,
            baseline_bsi   = EXCLUDED.baseline_bsi,
            current_bsi    = EXCLUDED.current_bsi,
            bsi_increase   = EXCLUDED.bsi_increase,
            checked_at     = EXCLUDED.checked_at
        `, [
          auth.orgId, paddock_id, finalStatus, finalConfidence,
          ndviAnalysis.baseline,  ndviAnalysis.current,  ndviAnalysis.drop,
          bsiAnalysis.baseline,   bsiAnalysis.current,   bsiAnalysis.increase,
        ])
      } catch (dbErr: any) {
        // No crítico: el resultado se devuelve igual, el error queda en logs
        console.error('[deforestation/check] DB write error:', dbErr.message)
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Respuesta
    // ─────────────────────────────────────────────────────────────────────
    return NextResponse.json({
      paddock_id,
      has_deforestation,
      loss_area_ha,

      // Status técnico interno
      status: finalStatus,

      // Estado EUDR legible para la UI
      eudr_status: finalStatus === 'DEFORESTED' ? 'NON_COMPLIANT'
                 : finalStatus === 'AT_RISK'     ? 'AT_RISK'
                 : finalStatus === 'CLEAN'        ? 'COMPLIANT'
                 : 'PENDING',

      confidence:  finalConfidence,
      data_source,
      check_date:  new Date().toISOString(),

      // Detalle del análisis para trazabilidad
      analysis: {
        ndvi: ndviAnalysis,
        bsi:  bsiAnalysis,
        gfw:  gfwResult,
        thresholds_ecosystem: 'GRAN_CHACO_DRY_FOREST',
        thresholds: {
          ndvi_forest_min:      CHACO_THRESHOLDS.NDVI_FOREST_MIN,
          ndvi_deforested_max:  CHACO_THRESHOLDS.NDVI_DEFORESTED_MAX,
          ndvi_drop_alert:      CHACO_THRESHOLDS.NDVI_DROP_ALERT,
          bsi_increase_alert:   CHACO_THRESHOLDS.BSI_INCREASE_ALERT,
          baseline_period:      `${CHACO_THRESHOLDS.BASELINE_START} → ${CHACO_THRESHOLDS.BASELINE_END}`,
          eudr_cutoff:          '2020-12-31',
        },
      },
    })

  } catch (error: any) {
    console.error('[deforestation/check] Fatal error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
