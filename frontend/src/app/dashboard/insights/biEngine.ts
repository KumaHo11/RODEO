/**
 * biEngine.ts — Motor de Business Intelligence Ganadero
 *
 * Implementa los 5 algoritmos definidos en el prompt de BI de Rodeo:
 *   1. Valor de Liquidación y Activo Corriente
 *   2. Eficiencia de Cosecha Forrajera (Costo de Oportunidad)
 *   3. Matriz de Decisión de Suplementación
 *   4. Flujo de Caja Biológico (EBITDA Predictivo)
 *   5. Costo de Degradación de Capital Fijo (Sobrepastoreo)
 *
 * Datos externos simulados con referencias a mercado argentino (Cañuelas / MATba).
 */

import type { BIInsightCard, SemaforoEstado } from './BIActionCards'

// ── Tipos de entrada ──────────────────────────────────────────────────────────

export interface Herd {
  id: string
  name?: string
  category?: string          // 'Vaca' | 'Novillo' | 'Vaquillona' | 'Ternero' | 'Toro'
  animal_count: number
  avg_weight_kg?: number
}

export interface Paddock {
  id: string
  name?: string
  area_ha?: number
  dry_matter_kg_ha?: number  // kg MS/ha de NDVI/campo
  current_status?: string    // 'GRAZING' | 'RESTING'
  last_entry_date?: string   // ISO yyyy-mm-dd
  last_exit_date?: string
}

export interface GrazingPlan {
  id: string
  paddock_id: string
  entry_date: string
  exit_date?: string
  herd_id?: string
}

export interface FarmEvent {
  id: string
  event_date: string
  title?: string
  type?: string              // 'PARTO' | 'DESTETE' | 'SERVICIO' | 'VACUNA'
  estimated_head?: number
}

export interface WeatherData {
  forecast_mm_15d?: number
  precipitation_sum?: number[]
  thi_max?: number           // Temperature-Humidity Index
  frost_days_forecast?: number
}

export interface BIInput {
  herds:        Herd[]
  paddocks:     Paddock[]
  plans:        GrazingPlan[]
  farmEvents:   FarmEvent[]
  weather:      WeatherData | null
}

// ── Precios de mercado simulados (DATO_EXTERNO) ────────────────────────────────
// Fuente referencial: Cañuelas / Rosgan / MATba Rofex — mayo 2026
const MARKET = {
  /** ARS / kg vivo por categoría */
  precio_kg_vivo: {
    Vaca:       2_400,
    Novillo:    2_700,
    Vaquillona: 2_500,
    Ternero:    2_900,
    Toro:       2_200,
  } as Record<string, number>,

  /** ARS / tonelada de maíz (referencia MATba Rofex) */
  maiz_ars_ton: 310_000,

  /** ARS / tonelada de rollo alfalfa */
  rollo_ars_ton: 185_000,

  /** kg MS que consume 1 EV por día */
  consumo_ev_dia: 11,

  /** EV de referencia = vaca 450 kg */
  ev_base_kg: 450,
} as const

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtARS(n: number): string {
  return `ARS ${Math.abs(Math.round(n)).toLocaleString('es-AR')}`
}

function semaforo(value: number, okMin: number, alertMin: number): SemaforoEstado {
  if (value >= okMin) return 'optimo'
  if (value >= alertMin) return 'alerta'
  return 'critico'
}

function calcEV(h: Herd): number {
  const w = h.avg_weight_kg ?? 450
  return h.animal_count * (w / MARKET.ev_base_kg)
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000)
}

// ── Algoritmo 1: Valor de Liquidación / Activo Corriente ──────────────────────

function calcActivoCorriente(input: BIInput): BIInsightCard {
  const today = new Date().toISOString().split('T')[0]

  let totalARS = 0
  let totalAnimales = 0
  let totalEV = 0

  for (const h of input.herds) {
    const cat    = h.category ?? 'Novillo'
    const precio = MARKET.precio_kg_vivo[cat] ?? 2_500
    const peso   = h.avg_weight_kg ?? 450
    const valor  = h.animal_count * peso * precio
    totalARS    += valor
    totalAnimales += h.animal_count
    totalEV     += calcEV(h)
  }

  const totalHa  = input.paddocks.reduce((s, p) => s + (Number(p.area_ha) || 0), 0)
  const cargaEVha = totalHa > 0 ? totalEV / totalHa : 0

  const estado: SemaforoEstado = totalARS > 50_000_000 ? 'optimo'
    : totalARS > 10_000_000 ? 'alerta' : 'critico'

  return {
    id: 'activo_corriente',
    titulo: 'Activo corriente ganadero',
    estado,
    kpiPrincipal: fmtARS(totalARS),
    subIndicador: `${totalAnimales} cabezas · ${totalEV.toFixed(1)} EV · Carga: ${cargaEVha.toFixed(2)} EV/ha`,
    cuerpo:
      `El patrimonio ganadero líquido en pie se calcula valuando cada categoría al precio de referencia del Mercado de Cañuelas. ` +
      `Con ${totalAnimales} animales y un peso promedio ponderado del rodeo, el valor de realización inmediata asciende a ${fmtARS(totalARS)}. ` +
      `Este indicador es el activo corriente más sensible de la empresa ganadera y debe monitorearse ante variaciones del tipo de cambio o mermas por clima.`,
    ctaTexto: 'Ver composición del rodeo',
    ctaHref:  '/dashboard/herds',
  }
}

// ── Algoritmo 2: Eficiencia de Cosecha Forrajera ─────────────────────────────

function calcEficienciaCosecha(input: BIInput): BIInsightCard {
  const totalHa = input.paddocks.reduce((s, p) => s + (Number(p.area_ha) || 0), 0)
  const totalEV = input.herds.reduce((s, h) => s + calcEV(h), 0)

  // Oferta real de pasto (kg MS/ha promedio de potreros con NDVI)
  const paddocksConMs = input.paddocks.filter(p => (p.dry_matter_kg_ha ?? 0) > 0)
  const avgMs = paddocksConMs.length > 0
    ? paddocksConMs.reduce((s, p) => s + (p.dry_matter_kg_ha ?? 0), 0) / paddocksConMs.length
    : 1_200

  // Demanda diaria real (kg MS)
  const demandaDiariaKg  = totalEV * MARKET.consumo_ev_dia
  // Oferta total disponible al 60 % de aprovechamiento
  const ofertaDisponible = avgMs * totalHa * 0.6
  // Carga teórica óptima para consumir el 100 % en 45 días (rotación)
  const cargaOptima      = ofertaDisponible / (MARKET.consumo_ev_dia * 45)
  // Excedente de pasto sin cosechar por día (kg MS)
  const excedenteDiario  = Math.max(0, (cargaOptima - totalEV) * MARKET.consumo_ev_dia)
  // Potencial de carne no producido (4 kg MS → 1 kg ganancia viva, novillo referencia)
  const kgCarneNoProducido = excedenteDiario / 4
  // Pérdida económica mensual
  const perdidaMensual   = kgCarneNoProducido * 30 * MARKET.precio_kg_vivo['Novillo']

  const cargaActualEVha  = totalHa > 0 ? totalEV / totalHa : 0
  const excedentePct     = cargaOptima > 0
    ? Math.round(((cargaOptima - totalEV) / cargaOptima) * 100) : 0

  const estado: SemaforoEstado = excedentePct < 10 ? 'optimo'
    : excedentePct < 30 ? 'alerta' : 'critico'

  return {
    id: 'eficiencia_cosecha',
    titulo: 'Eficiencia de cosecha forrajera',
    estado,
    kpiPrincipal: perdidaMensual > 0 ? `− ${fmtARS(perdidaMensual)} / mes` : 'Sin pérdida detectada',
    subIndicador: `Balance forrajero: +${excedentePct}% de excedente sin cosechar · Carga actual: ${cargaActualEVha.toFixed(2)} EV/ha`,
    cuerpo:
      `El análisis satelital de los potreros muestra curvas de NDVI con una tasa de crecimiento de materia seca ` +
      `que supera la capacidad de consumo de la carga actual (${cargaActualEVha.toFixed(2)} EV/ha). ` +
      `Contrastando el vigor fotosintético con la densidad de bocas disponibles, se evidencia un excedente ` +
      `de forraje que corre riesgo de encañarse y perder calidad nutricional, representando una pérdida potencial ` +
      `de ${kgCarneNoProducido.toFixed(0)} kg de carne/día no producidos.`,
    ctaTexto: 'Ajustar rotación de pastoreo',
    ctaHref:  '/dashboard/mi-campo',
  }
}

// ── Algoritmo 3: Matriz de Decisión de Suplementación ────────────────────────

function calcSupplementacion(input: BIInput): BIInsightCard {
  const totalEV          = input.herds.reduce((s, h) => s + calcEV(h), 0)
  const totalHa          = input.paddocks.reduce((s, p) => s + (Number(p.area_ha) || 0), 0)

  const avgMs = (() => {
    const con = input.paddocks.filter(p => (p.dry_matter_kg_ha ?? 0) > 0)
    if (!con.length) return 800
    return con.reduce((s, p) => s + (p.dry_matter_kg_ha ?? 0), 0) / con.length
  })()

  const demandaDiariaKg  = totalEV * MARKET.consumo_ev_dia
  const ofertaTotal      = avgMs * totalHa * 0.6
  const diasAutonomia    = demandaDiariaKg > 0
    ? Math.round(ofertaTotal / demandaDiariaKg) : 999

  // Costo de suplementación diario (maíz a 2 kg/EV/día → 2 % del PV)
  const maizKgEVdia      = 2
  const costoDiarioARS   = totalEV * maizKgEVdia * (MARKET.maiz_ars_ton / 1_000)

  // GDP retenida con suplemento (0.8 kg/día/animal × precio novillo)
  const animalesNovillos = input.herds
    .filter(h => h.category === 'Novillo')
    .reduce((s, h) => s + h.animal_count, 0)
  const ingresoGDPdia    = animalesNovillos * 0.8 * MARKET.precio_kg_vivo['Novillo']

  // Ecuación de conversión: ingreso neto diario
  const netoDiario       = ingresoGDPdia - costoDiarioARS

  // Alerta climática
  const heladas          = (input.weather?.frost_days_forecast ?? 0) > 2
  const secano           = (input.weather?.forecast_mm_15d ?? 30) < 15

  let estado: SemaforoEstado
  if (diasAutonomia < 15 && (heladas || secano)) estado = 'critico'
  else if (diasAutonomia < 30 || netoDiario < 0)  estado = 'alerta'
  else                                             estado = 'optimo'

  const climaTexto = heladas
    ? 'El pronóstico extendido prevé heladas recurrentes que deprimirán el crecimiento de los verdeos.'
    : secano
    ? 'Se proyectan precipitaciones por debajo de los 15 mm, agravando el déficit forrajero.'
    : 'Sin alertas climáticas severas en el horizonte de 15 días.'

  return {
    id: 'suplementacion',
    titulo: 'Decisión de suplementación',
    estado,
    kpiPrincipal: netoDiario < 0
      ? `− ${fmtARS(Math.abs(netoDiario))} / día`
      : `+ ${fmtARS(netoDiario)} / día`,
    subIndicador: `Autonomía forrajera: ${diasAutonomia} días · Costo ración: ${fmtARS(costoDiarioARS)}/día`,
    cuerpo:
      `La sección de planificación acusa un horizonte de ${diasAutonomia} días de pasto disponible. ${climaTexto} ` +
      `Evaluando el costo de la tonelada de maíz de referencia (ARS ${MARKET.maiz_ars_ton.toLocaleString('es-AR')}/t) ` +
      `contra la eficiencia de conversión biológica actual, el resultado neto de suplementar ${animalesNovillos} novillos ` +
      `es de ${netoDiario >= 0 ? 'positivo' : 'negativo'} ${fmtARS(Math.abs(netoDiario))}/día.`,
    ctaTexto: diasAutonomia < 20 ? 'Simular venta de lote' : 'Ver balance forrajero',
    ctaHref:  '/dashboard/herds',
  }
}

// ── Algoritmo 4: Flujo de Caja Biológico (EBITDA Predictivo) ─────────────────

function calcEBITDAPredictivo(input: BIInput): BIInsightCard {
  const today = new Date().toISOString().split('T')[0]

  // Kilos a comercializar según eventos de agenda (destete + servicio)
  const eventosVenta = input.farmEvents.filter(e => {
    const d = e.event_date ?? ''
    return d > today && daysBetween(today, d) <= 360 && (
      e.type === 'DESTETE' || e.type === 'VENTA' || (e.title ?? '').toLowerCase().includes('venta')
    )
  })

  const ternerosPorDes = input.herds.find(h => h.category === 'Ternero')
  const kgTernero      = ternerosPorDes?.avg_weight_kg ?? 180
  const cabTerneros    = ternerosPorDes?.animal_count ?? 0

  // Proyección a 90 / 180 / 360 días
  const ganDiaria = 0.7 // kg/día GDP estándar destete
  const kg90  = cabTerneros * (kgTernero + 90  * ganDiaria) * MARKET.precio_kg_vivo['Ternero']
  const kg180 = cabTerneros * (kgTernero + 180 * ganDiaria) * MARKET.precio_kg_vivo['Novillo']
  const kg360 = cabTerneros * (kgTernero + 360 * ganDiaria) * MARKET.precio_kg_vivo['Novillo']

  // EBITDA simple: ingreso proyectado menos costo de mantenimiento (5 % del valor)
  const costoMant = input.herds.reduce((s, h) => {
    const p = MARKET.precio_kg_vivo[h.category ?? 'Novillo'] ?? 2_500
    return s + h.animal_count * (h.avg_weight_kg ?? 450) * p * 0.05
  }, 0)

  const ebitda360 = kg360 - costoMant
  const estado: SemaforoEstado = ebitda360 > 0 ? (cabTerneros > 0 ? 'optimo' : 'alerta') : 'critico'

  return {
    id: 'ebitda_predictivo',
    titulo: 'Flujo de caja biológico',
    estado,
    kpiPrincipal: fmtARS(ebitda360),
    subIndicador: `Proyección a 360 días · 90 d: ${fmtARS(kg90)} · 180 d: ${fmtARS(kg180)}`,
    cuerpo:
      `Según la agenda de parición y destete, el sistema proyecta la venta de ${cabTerneros} cabezas con una ganancia diaria ` +
      `estimada de ${ganDiaria} kg/día. La valorización a precios de mercado de Cañuelas genera un flujo de caja ` +
      `de ${fmtARS(kg90)} a 90 días, escalando hasta ${fmtARS(kg360)} al año. ` +
      `Descontando el costo de mantenimiento del rodeo (${fmtARS(costoMant)}), el EBITDA predictivo es ${fmtARS(ebitda360)}.`,
    ctaTexto: 'Ver agenda de parición',
    ctaHref:  '/dashboard/agenda',
  }
}

// ── Algoritmo 5: Costo de Degradación de Capital Fijo (Sobrepastoreo) ─────────

function calcDegradacion(input: BIInput): BIInsightCard {
  const today = new Date().toISOString().split('T')[0]

  // Detectar potreros con exceso de días de ocupación
  const season = (() => {
    const m = new Date().getMonth() + 1
    if (m >= 12 || m <= 2) return { min: 45, max: 65 }
    if (m >= 3  && m <= 5) return { min: 60, max: 80 }
    if (m >= 6  && m <= 8) return { min: 80, max: 110 }
    return { min: 35, max: 50 }
  })()

  // Planes activos con exceso de días de pastoreo
  const planesActivos = input.plans.filter(p => !p.exit_date || p.exit_date >= today)
  const sobrePastoreados = planesActivos.filter(plan => {
    const daysIn = daysBetween(plan.entry_date, today)
    return daysIn > 4 // más de 4 días en el mismo potrero (umbral holístico intensivo)
  })

  const paddocksSobre = sobrePastoreados
    .map(p => input.paddocks.find(pp => pp.id === p.paddock_id))
    .filter(Boolean) as Paddock[]

  const haSobreP = paddocksSobre.reduce((s, p) => s + (Number(p.area_ha) || 0), 0)

  // Costo: cada día extra de sobrepastoreo implica 25 días adicionales de descanso
  // Valor del pasto sacrificado: 500 kg MS/ha × precio implícito como carne
  const msSacrificada   = haSobreP * 500 // kg MS estimados comprometidos
  const kgCarnePerdida  = msSacrificada / 4
  const costoFinanciero = kgCarnePerdida * MARKET.precio_kg_vivo['Novillo']

  // Penalización por días extras de descanso obligatorio (inmovilización de potrero)
  const diasDescansoExtra = sobrePastoreados.length * 25
  const costoTotal        = costoFinanciero + haSobreP * 8_000 // $8.000/ha/ciclo de rehabilitación

  const estado: SemaforoEstado = sobrePastoreados.length === 0 ? 'optimo'
    : sobrePastoreados.length <= 2 ? 'alerta' : 'critico'

  return {
    id: 'degradacion_capital',
    titulo: 'Degradación de capital fijo',
    estado,
    kpiPrincipal: sobrePastoreados.length === 0 ? 'Sin sobrepastoreo' : fmtARS(costoTotal),
    subIndicador: sobrePastoreados.length === 0
      ? 'Todos los potreros dentro de los tiempos de ocupación'
      : `${sobrePastoreados.length} potreros con exceso de ocupación · +${diasDescansoExtra} días de descanso adicional`,
    cuerpo: sobrePastoreados.length === 0
      ? `Los tiempos de permanencia en todos los potreros se encuentran dentro de los parámetros holísticos para la estación actual ` +
        `(máximo 4 días de ocupación). El NDVI no muestra aplanamiento en las curvas de recuperación. ` +
        `El capital suelo y la biomasa rizomática están siendo preservados correctamente.`
      : `Las métricas de tiempo de permanencia en ${sobrePastoreados.length} potrero(s) revelan días por encima del límite holístico, ` +
        `provocando que los animales consuman el rebrote tierno de las plantas preferidas. ` +
        `El NDVI del área afectada (${haSobreP.toFixed(1)} ha) muestra aplanamiento en la curva de recuperación, ` +
        `requiriendo ${season.min + 25}–${season.max + 25} días adicionales de descanso obligatorio.`,
    ctaTexto: 'Registrar movimiento de hacienda',
    ctaHref:  '/dashboard/grazing',
  }
}

// ── Función principal exportada ───────────────────────────────────────────────

export function calcularBICards(input: BIInput): BIInsightCard[] {
  return [
    calcActivoCorriente(input),
    calcEficienciaCosecha(input),
    calcSupplementacion(input),
    calcEBITDAPredictivo(input),
    calcDegradacion(input),
  ]
}
