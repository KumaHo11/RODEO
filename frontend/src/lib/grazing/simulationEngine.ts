/**
 * simulationEngine.ts — Motor de simulación agronómica (función pura)
 * ─────────────────────────────────────────────────────────────────────
 * Temporada Abierta — Algoritmo multi-vuelta:
 *
 *   C_i      = areaHa × rank
 *   C_total  = Σ C_k  (solo potreros enabled)
 *   C_base   = min(C_i)  (lote de menor aporte)
 *   DP_i     = round( C_i × D / (C_total − C_base) )  [mín. 1]
 *   T_ciclo  = Σ DP_k  (suma de todos los DP de la vuelta)
 *   Descanso_real_i = T_ciclo − DP_i  (circuito cerrado real)
 *
 *   El motor itera en bucle desde fechaInicio hasta fechaFin,
 *   cambiando el parámetro D al cruzar fechaCorte (primavera→verano).
 *
 * Temporada Cerrada: presupuestación forrajera (sin cambios).
 */

import type {
  SimulationInput,
  SimulationResult,
  SimulationConfig,
  PaddockSimRow,
  PaddockSimResult,
  BalanceResult,
  SimRowStatus,
  PlanEvent,
} from './types'

export function simulate(input: SimulationInput): SimulationResult {
  if (input.paddocks.length === 0) return emptyResult()
  if (input.config.mode === 'open') return simulateOpen(input.config, input.paddocks)
  return simulateClosed(input.config, input.paddocks)
}

// ── Helpers de fecha ──────────────────────────────────────────────────────────

function daysBetween(a: string, b: string): number {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000))
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

// ── Temporada Abierta ─────────────────────────────────────────────────────────

function simulateOpen(config: SimulationConfig, all: PaddockSimRow[]): SimulationResult {
  const active = all.filter(p => p.enabled).sort((a, b) => a.order - b.order)
  const warnings: string[] = []

  if (active.length === 0) {
    return { ...emptyResult(), rows: all.map(p => disabledRow(p)) }
  }

  // Sin rodeo seleccionado → no hay plan que generar (cronograma vacío, sin advertencias falsas)
  const sinRodeo = config.totalEV === 0 && config.demandaDiariaKgMs === 0

  // 1. Coeficientes forrajeros C_i = areaHa × rank
  const coefs = active.map(p => ({ id: p.id, name: p.name, C: p.areaHa * p.rank }))
  const C_total = coefs.reduce((s, c) => s + c.C, 0)
  const C_max   = Math.max(...coefs.map(c => c.C))

  // 2. Calcular DP para ambas sub-temporadas (usando matemática del descanso obligatorio)
  const calcInitialDPs = (D: number) => {
    if (C_total === 0) return active.map(p => ({ id: p.id, dp: 1 }))
    
    // T_ciclo teórico para que el lote de MAYOR permanencia descanse al menos D días
    const w_max = C_max / C_total
    const T_ciclo_teorico = w_max < 1 ? D / (1 - w_max) : D

    const dps = active.map(p => {
      const Ci = p.areaHa * p.rank
      const w_i = Ci / C_total
      return { id: p.id, dp: Math.max(1, Math.round(w_i * T_ciclo_teorico)) }
    })

    // Guardarraíl: Asegurar que el descanso real (por redondeo) alcance exactamente D
    const T_ciclo_real = dps.reduce((s, x) => s + x.dp, 0)
    const maxDpObj = dps.reduce((max, obj) => obj.dp > max.dp ? obj : max, dps[0])
    const deficit = D - (T_ciclo_real - maxDpObj.dp)
    
    if (deficit > 0) {
      // Reasignamos el déficit a otros lotes para estirar el ciclo sin penalizar el descanso del máximo
      const others = dps.filter(d => d.id !== maxDpObj.id)
      if (others.length > 0) {
        const secondMax = others.reduce((max, obj) => obj.dp > max.dp ? obj : max, others[0])
        secondMax.dp += deficit
      } else {
        maxDpObj.dp += deficit // Failsafe (solo 1 potrero)
      }
    }
    return dps
  }

  const dpsPrimavera = calcInitialDPs(config.descansosPrimavera)
  const dpsVerano    = calcInitialDPs(config.descansosVerano)
  
  const cicloPrimavera = dpsPrimavera.reduce((s, x) => s + x.dp, 0)
  const cicloVerano    = dpsVerano.reduce((s, x) => s + x.dp, 0)

  // 3. Construir resultados por potrero activo
  const activeResults = new Map<string, Omit<PaddockSimResult, keyof PaddockSimRow>>()

  const enPrimavera = config.fechaInicio < config.fechaCorte

  for (const p of active) {
    const Ci          = p.areaHa * p.rank
    const dpP         = dpsPrimavera.find(d => d.id === p.id)?.dp ?? 1
    const dpV         = dpsVerano.find(d => d.id === p.id)?.dp ?? 1
    const dpSugerido  = enPrimavera ? dpP : dpV
    const T_ciclo     = enPrimavera ? cicloPrimavera : cicloVerano
    // Descanso real = suma de DP de todos los DEMÁS potreros
    const descanso    = T_ciclo - dpSugerido
    const D_actual    = enPrimavera ? config.descansosPrimavera : config.descansosVerano
    const needsBoyero = enPrimavera && dpP > 5
    const { status, statusMsg } = calcStatus(descanso, D_actual, needsBoyero, dpSugerido)

    if (status !== 'ok') warnings.push(`${p.name}: ${statusMsg}`)

    activeResults.set(p.id, {
      coeficiente: Ci,
      dpPrimavera: dpP,
      dpVerano: dpV,
      dpSugerido,
      descansoResultante: descanso,
      needsBoyero,
      status,
      statusMsg,
    })
  }

  // 4. Rows para TODOS (inactivos con valores neutros)
  const rows: PaddockSimResult[] = all.map(p => {
    if (!p.enabled) return disabledRow(p)
    return { ...p, ...activeResults.get(p.id)! }
  })

  const totalDays = active.reduce((s, p) => {
    const r = activeResults.get(p.id)
    return s + (r?.dpSugerido ?? 0)
  }, 0)

  // Balance forrajero
  const diasPeriodo       = daysBetween(config.fechaInicio, config.fechaFin) || 365
  const totalAreaHa = active.reduce((s, p) => s + p.areaHa, 0)

  // Oferta: aforo inicial + crecimiento neto con TC editable
  const ofertaKgMs = active.reduce((s, p) => {
    if (p.aforoKgMsHa <= 0 && p.tasaCrecimientoKgHaDia <= 0) return s
    const fa  = p.factorAprovechamiento > 0 ? p.factorAprovechamiento : 0.5
    const tc  = p.tasaCrecimientoKgHaDia > 0 ? p.tasaCrecimientoKgHaDia : 0
    const rem = p.remanenteObjetivoKgMsHa > 0 ? p.remanenteObjetivoKgMsHa : 0
    const aforoDisp = Math.max(0, (p.aforoKgMsHa - rem) * p.areaHa)
    const crecimiento = p.areaHa * tc * diasPeriodo * fa
    return s + aforoDisp + crecimiento + (p.suplementoKgMs ?? 0)
  }, 0)

  const demandaKgMs       = config.demandaDiariaKgMs * diasPeriodo
  const pct               = demandaKgMs > 0 ? Math.round((ofertaKgMs / demandaKgMs) * 100) : 0

  // Carga animal
  const totalEV   = config.totalEV
  const cargaEvHa = totalAreaHa > 0 ? +(totalEV / totalAreaHa).toFixed(2) : 0
  const cargaStatus: 'optimo' | 'moderado' | 'sobrepastoreo' =
    cargaEvHa <= 1.5 ? 'optimo' : cargaEvHa <= 2.5 ? 'moderado' : 'sobrepastoreo'

  // Cobertura forrajera
  const diasCoberturaForrajera = config.demandaDiariaKgMs > 0
    ? Math.round(ofertaKgMs / config.demandaDiariaKgMs)
    : 0
  const balanceStatus: 'superavit' | 'ajustado' | 'deficit' =
    pct >= 110 ? 'superavit' : pct >= 85 ? 'ajustado' : 'deficit'

  const balance: BalanceResult = {
    cicloPrimavera,
    cicloVerano,
    dpBasePrimavera: Math.min(...dpsPrimavera.map(d => d.dp)),
    dpBaseVerano:    Math.min(...dpsVerano.map(d => d.dp)),
    ofertaKgMs:      Math.round(ofertaKgMs),
    demandaKgMs:     Math.round(demandaKgMs),
    pct,
    diasPeriodo,
    totalAreaHa:     +totalAreaHa.toFixed(1),
    totalEV,
    cargaEvHa,
    cargaStatus,
    diasCoberturaForrajera,
    balanceStatus,
  }

  // 5. Generar cronograma multi-vuelta (limitado estacionalmente)
  const chronogram = sinRodeo
    ? []  // Sin rodeo activo: no generar fechas
    : generateChronogram(config, active, dpsPrimavera, dpsVerano, cicloPrimavera, cicloVerano)

  // Advertencia si no hay rodeo
  if (sinRodeo) warnings.push('Seleccioná al menos 1 rodeo para generar el cronograma.')

  // ─ Detectar heterogeneidad de coeficientes (ratio >= 2.5×) ─────────────────
  // Umbral: cuando el potrero de mayor coeficiente es ≥ 2.5× el de menor,
  // se activa el banner sutil de alerta y el modal de planes de manejo.
  // Equivale aproximadamente a una Calidad Relativa máxima > 1.5.
  const coefMax = coefs.reduce((max, c) => c.C > max.C ? c : max, coefs[0])
  const coefMin = coefs.reduce((min, c) => c.C < min.C ? c : min, coefs[0])
  const ratio = coefMin.C > 0 ? coefMax.C / coefMin.C : 0
  const heterogeneidadExtrema = ratio >= 2.5 ? {
    potreroMax: coefMax.name,
    potreroMin: coefMin.name,
    ratio: +ratio.toFixed(1),
    suggestion: `${coefMax.name} tiene un coeficiente ${ratio.toFixed(1)}× mayor que ${coefMin.name}. Considerá dividir ${coefMax.name} con boyero eléctrico, o ajustar el ranking para un plan más equilibrado.`,
  } : undefined

  return { rows, totalDays, balance, warnings, chronogram, heterogeneidadExtrema }
}

// ── Generador del cronograma multi-vuelta ─────────────────────────────────────
//
// Límite agronómico estricto por potrero:
//   - MAX 2 pasadas de primavera (crecimiento rápido, descanso 50d)
//   - MAX 1 pasada de verano (crecimiento lento, descanso 100d)
// Esto impide rotaciones infinitas que no tienen sustento biológico.

const MAX_PASADAS_PRIMAVERA = 2
const MAX_PASADAS_VERANO    = 1

function generateChronogram(
  config: SimulationConfig,
  active: PaddockSimRow[],
  dpsPrimavera: { id: string; dp: number }[],
  dpsVerano:    { id: string; dp: number }[],
  _cicloPrimavera: number,
  _cicloVerano:    number,
): PlanEvent[] {
  if (active.length < 2) return []

  const events: PlanEvent[] = []

  // Offset inicial: potrero k arranca cuando terminan los k-1 anteriores
  const offsetsPrimera: number[] = []
  let acum = 0
  for (const p of active) {
    offsetsPrimera.push(acum)
    const dp = dpsPrimavera.find(d => d.id === p.id)?.dp ?? 1
    acum += dp
  }

  active.forEach((paddock, idx) => {
    const dpP = dpsPrimavera.find(d => d.id === paddock.id)?.dp ?? 1
    const dpV = dpsVerano.find(d => d.id === paddock.id)?.dp ?? 1

    let fechaEntrada    = addDays(config.fechaInicio, offsetsPrimera[idx])
    let vuelta          = 1
    let cntPrimavera    = 0
    let cntVerano       = 0

    while (fechaEntrada < config.fechaFin) {
      const esPrimavera = fechaEntrada < config.fechaCorte
      const subtemporada: 'primavera' | 'verano' = esPrimavera ? 'primavera' : 'verano'

      // Guardarraíl de pasadas por sub-temporada
      if (esPrimavera  && cntPrimavera >= MAX_PASADAS_PRIMAVERA) {
        // Ya alcanzamos el límite de primavera → saltar a primera entrada posible de verano
        fechaEntrada = addDays(config.fechaCorte, config.descansosPrimavera)
        continue
      }
      if (!esPrimavera && cntVerano >= MAX_PASADAS_VERANO) break

      const dp          = esPrimavera ? dpP : dpV
      const fechaSalida = addDays(fechaEntrada, dp)
      const D_descanso  = esPrimavera ? config.descansosPrimavera : config.descansosVerano

      events.push({
        vuelta,
        subtemporada,
        paddockId:          paddock.id,
        paddockName:        paddock.name,
        areaHa:             paddock.areaHa,
        posicion:           idx + 1,
        fechaEntrada,
        fechaSalida,
        diasPastoreo:       dp,
        descansoAlRegresar: D_descanso,
        demandaMSKg:        Math.round(dp * config.demandaDiariaKgMs),
      })

      if (esPrimavera) cntPrimavera++
      else             cntVerano++

      fechaEntrada = addDays(fechaSalida, D_descanso)
      vuelta++
    }
  })

  events.sort((a, b) => a.fechaEntrada.localeCompare(b.fechaEntrada))
  return events
}

function calcStatus(
  descanso: number,
  D: number,
  needsBoyero: boolean,
  dp: number,
): { status: SimRowStatus; statusMsg: string } {
  if (dp === 0) return { status: 'danger', statusMsg: 'Sin días de pastoreo — verificar datos' }
  if (needsBoyero) return { status: 'warn', statusMsg: `DP ${dp}d > 5d en primavera — usar boyero/fraccionamiento` }
  if (descanso < D * 0.75) return { status: 'warn', statusMsg: `Descanso ${descanso}d por debajo del objetivo` }
  return { status: 'ok', statusMsg: `Descanso ${descanso}d ✓` }
}

// ── Temporada Cerrada ─────────────────────────────────────────────────────────
// Presupuestación forrajera: DP = disponible / demanda

function simulateClosed(config: SimulationConfig, all: PaddockSimRow[]): SimulationResult {
  const active = all.filter(p => p.enabled)
  const warnings: string[] = []
  let totalOferta = 0
  let totalDays = 0

  // Valor de aforo por defecto cuando el potrero no tiene aforo medido.
  // 1200 kg MS/ha es un mínimo conservador de invierno para la región pampeana.
  const DEFAULT_AFORO_KG_MS_HA = 1200

  const activeResults = new Map<string, Omit<PaddockSimResult, keyof PaddockSimRow>>()

  for (const p of active) {
    // Aforo real o fallback conservador — nunca NaN
    const aforoReal = (p.aforoKgMsHa > 0 && isFinite(p.aforoKgMsHa))
      ? p.aforoKgMsHa
      : DEFAULT_AFORO_KG_MS_HA
    if (p.aforoKgMsHa === 0 || !isFinite(p.aforoKgMsHa)) {
      warnings.push(`${p.name}: sin aforo medido, usando ${DEFAULT_AFORO_KG_MS_HA} kg MS/ha estimado`)
    }

    const rem = (p.remanenteObjetivoKgMsHa > 0) ? p.remanenteObjetivoKgMsHa : (config.targetRemnantKgHa > 0 ? config.targetRemnantKgHa : 0)
    const disp = Math.max(0, aforoReal * p.areaHa + p.suplementoKgMs - rem * p.areaHa)

    // demandaDiariaKgMs puede ser 0 si no hay rodeos activos — evitar división por cero
    const dp = (config.demandaDiariaKgMs > 0 && isFinite(config.demandaDiariaKgMs))
      ? Math.max(0, Math.floor(disp / config.demandaDiariaKgMs))
      : 0
    totalOferta += disp
    totalDays += dp

    const status: SimRowStatus = dp === 0 ? 'danger' : dp < 3 ? 'warn' : 'ok'
    const statusMsg = dp === 0
      ? (config.demandaDiariaKgMs === 0 ? 'Sin rodeos activos' : 'Sin forraje disponible')
      : dp < 3 ? `Solo ${dp}d` : `${dp}d ✓`
    if (status !== 'ok') warnings.push(`${p.name}: ${statusMsg}`)

    activeResults.set(p.id, {
      coeficiente: 0,
      dpPrimavera: 0,
      dpVerano: 0,
      dpSugerido: dp,
      descansoResultante: 0,
      needsBoyero: false,
      status,
      statusMsg,
    })
  }

  const rows: PaddockSimResult[] = all.map(p =>
    p.enabled ? { ...p, ...activeResults.get(p.id)! } : disabledRow(p)
  )

  const totalAreaHa = active.reduce((s, p) => s + p.areaHa, 0)
  const diasPeriodo = daysBetween(config.fechaInicio, config.fechaFin) || 90
  const demandaKgMs = config.demandaDiariaKgMs * diasPeriodo
  const pct = demandaKgMs > 0 ? Math.round((totalOferta / demandaKgMs) * 100) : 0

  const totalEV   = config.totalEV
  const cargaEvHa = totalAreaHa > 0 ? +(totalEV / totalAreaHa).toFixed(2) : 0
  const cargaStatus: 'optimo' | 'moderado' | 'sobrepastoreo' =
    cargaEvHa <= 1.5 ? 'optimo' : cargaEvHa <= 2.5 ? 'moderado' : 'sobrepastoreo'
  const diasCoberturaForrajera = config.demandaDiariaKgMs > 0
    ? Math.round(totalOferta / config.demandaDiariaKgMs) : 0
  const balanceStatus: 'superavit' | 'ajustado' | 'deficit' =
    pct >= 110 ? 'superavit' : pct >= 85 ? 'ajustado' : 'deficit'

  const balance: BalanceResult = {
    cicloPrimavera: 0, cicloVerano: 0, dpBasePrimavera: 0, dpBaseVerano: 0,
    ofertaKgMs:  Math.round(totalOferta),
    demandaKgMs: Math.round(demandaKgMs),
    pct,
    diasPeriodo,
    totalAreaHa: +totalAreaHa.toFixed(1),
    totalEV,
    cargaEvHa,
    cargaStatus,
    diasCoberturaForrajera,
    balanceStatus,
  }

  // ── Generar cronograma de racionamiento estático ──────────────────────────
  // Modelo: una sola pasada por potrero, secuencial desde fechaInicio.
  // No usa lógica de rotación (sin descansosPrimavera, sin fechaCorte).
  // Si el presupuesto alcanza solo 13 días de 184, las tarjetas se renderizan
  // igual para esos 13 días — NO se aborta el render.
  const chronogram: PlanEvent[] = []

  if (config.demandaDiariaKgMs > 0 && active.length > 0) {
    let cursor = config.fechaInicio
    const sortedActive = [...active].sort((a, b) => a.order - b.order)

    for (let idx = 0; idx < sortedActive.length; idx++) {
      const p = sortedActive[idx]
      const res = activeResults.get(p.id)
      const dpRaw = res?.dpSugerido ?? 0

      // Si dp=0 (aforo no alcanza ni para 1 día): incluir igual con 1d mínimo
      // El usuario DEBE ver la card del potrero para entender que está en déficit.
      // La demandaMSKg mostrará el costo real vs. lo disponible.
      const dp = Math.max(1, dpRaw)

      // Límite estricto: no superar fechaFin del período
      const fechaEntrada = cursor
      const rawSalida    = addDays(fechaEntrada, dp)
      const fechaSalida  = rawSalida <= config.fechaFin ? rawSalida : config.fechaFin
      const diasReales   = daysBetween(fechaEntrada, fechaSalida)

      if (diasReales <= 0) break // Se acabó el período planificado

      // Demanda MS total de esta estancia (al ritmo de demanda diaria)
      const demandaMSKg = Math.round(config.demandaDiariaKgMs * diasReales)

      chronogram.push({
        vuelta:      1,          // Una sola vuelta: racionamiento estático
        subtemporada: 'primavera', // Placeholder neutro (SandboxSchedule muestra "Cerrada")
        paddockId:    p.id,
        paddockName:  p.name,
        areaHa:       p.areaHa,
        posicion:     idx + 1,
        fechaEntrada,
        fechaSalida,
        diasPastoreo:       diasReales,
        descansoAlRegresar: 0,          // Sin rotación → sin descanso definido
        demandaMSKg,
        // balanceDiasPotrero < 0 → el potrero está en déficit (aforo insuficiente)
        balanceDiasPotrero: dpRaw - diasReales,
      })

      cursor = fechaSalida
      if (cursor >= config.fechaFin) break
    }
  }


  return { rows, totalDays, balance, warnings, chronogram }

}

// ── Helpers ───────────────────────────────────────────────────────────────────

function disabledRow(p: PaddockSimRow): PaddockSimResult {
  return {
    ...p,
    coeficiente: 0,
    dpPrimavera: 0,
    dpVerano: 0,
    dpSugerido: 0,
    descansoResultante: 0,
    needsBoyero: false,
    status: 'ok',
    statusMsg: 'Excluido de la rotación',
  }
}

function emptyResult(): SimulationResult {
  return {
    rows: [],
    totalDays: 0,
    balance: {
      cicloPrimavera: 0, cicloVerano: 0, dpBasePrimavera: 0, dpBaseVerano: 0,
      ofertaKgMs: 0, demandaKgMs: 0, pct: 0, diasPeriodo: 0,
      totalAreaHa: 0, totalEV: 0, cargaEvHa: 0,
      cargaStatus: 'optimo', diasCoberturaForrajera: 0, balanceStatus: 'ajustado',
    },
    warnings: [],
    chronogram: [],
  }
}
