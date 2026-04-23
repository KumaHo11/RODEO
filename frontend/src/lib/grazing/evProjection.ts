/**
 * evProjection.ts — Motor de Equivalente Vaca dinámico
 * ─────────────────────────────────────────────────────
 * Calcula la demanda real mensual de un rodeo considerando:
 *  - Categoría animal (novillos, terneros, vacas, toros…)
 *  - Estado fenológico mes a mes (gestación, lactancia, seca)
 *  - Mes de parición configurado por el usuario
 *
 * Basado en estándares INTA / Ovis 21 para Hemisferio Sur.
 */

/** Factores base de EV por categoría (respecto a vaca de 450 kg a mantenimiento) */
export const EV_BASE: Record<string, number> = {
  VACAS:       1.00,
  NOVILLOS:    1.00,
  NOVILLITOS:  0.75,
  VAQUILLONAS: 0.80,
  TERNEROS:    0.45,
  TERNERAS:    0.40,
  TOROS:       1.25,
  MEJ:         0.90,
  BUBALINOS:   1.10,
}

/** Temporadas de parición disponibles en el selector */
export type ParitionSeason = 'otono' | 'primavera' | 'todo_el_año'

/** Retorna el mes de parición (0-based: 0=enero) según la temporada seleccionada */
function paritionMonth(season: ParitionSeason): number {
  if (season === 'otono')     return 3  // Abril
  if (season === 'primavera') return 8  // Septiembre
  return -1  // todo el año: sin pico
}

/**
 * Factor de demanda energética mensual para vacas cría según estado fenológico.
 *
 * Escala sobre 1.0 = vaca seca a mantenimiento.
 * Lactancia temprana (0-3 meses): +40% energía
 * Lactancia tardía (3-6 meses): +20%
 * Gestación tardía (último trimestre): +15%
 * Seca/gestación temprana: base 1.0
 */
function vacaFenologiaFactor(monthOffset: number, paritionSeason: ParitionSeason): number {
  if (paritionSeason === 'todo_el_año') return 1.10  // promedio constante

  const parMonth = paritionMonth(paritionSeason)
  const currentMonth = (new Date().getMonth() + monthOffset) % 12

  // Meses relativos al parto (positivos = post-parto, negativos = pre-parto)
  const dif = ((currentMonth - parMonth) + 12) % 12

  if (dif <= 2)  return 1.40  // Lactancia temprana (0-2 meses posparto)
  if (dif <= 5)  return 1.20  // Lactancia tardía (3-5 meses)
  if (dif <= 8)  return 1.05  // Gestación media
  if (dif <= 11) return 1.18  // Gestación tardía (último trimestre)
  return 1.00
}

/** Tasa de crecimiento mensual de peso vivo para categorías jóvenes (kg/mes) */
const GROWTH_RATE_KG_MONTH: Record<string, number> = {
  TERNEROS:    25,
  TERNERAS:    20,
  NOVILLITOS:  18,
  VAQUILLONAS: 15,
}

interface Herd {
  id: string
  name: string
  head_count: number | string
  avg_weight_kg: number | string | null
  categoria: string | null
  total_ev: number | string | null
}

export interface EVProjection {
  month: number        // 0 = mes actual, 1 = próximo, etc.
  monthLabel: string
  totalEV: number
  dailyDemandKg: number
  breakdown: { herdName: string; ev: number; headCount: number }[]
}

/**
 * Proyecta la demanda de EV para los próximos `months` meses.
 *
 * @param herds          Lista de rodeos actuales
 * @param dailyAlloc     kg MS por EV por día (configurado por el usuario)
 * @param paritionSeason Temporada de parición seleccionada por el usuario
 * @param months         Cantidad de meses a proyectar (default 6)
 */
export function projectEVDemand(
  herds: Herd[],
  dailyAlloc: number,
  paritionSeason: ParitionSeason,
  months = 6,
): EVProjection[] {
  const today = new Date()

  return Array.from({ length: months }, (_, i) => {
    const dt = new Date(today.getFullYear(), today.getMonth() + i, 1)
    const monthLabel = dt.toLocaleString('es', { month: 'short', year: '2-digit' })

    const breakdown = herds.map(h => {
      const categoria = (h.categoria ?? 'VACAS').toUpperCase()
      const headCount = Number(h.head_count) || 0
      const baseWeight = Number(h.avg_weight_kg) || 450

      // Crecer el peso vivo para categorías jóvenes
      const growthKgMonth = GROWTH_RATE_KG_MONTH[categoria] ?? 0
      const projectedWeight = Math.min(baseWeight + growthKgMonth * i, 600)

      // EV base ajustado por peso proyectado
      const evBase = EV_BASE[categoria] ?? 1.0
      const weightFactor = Math.pow(projectedWeight / 450, 0.75)
      let ev = evBase * weightFactor * headCount

      // Ajuste fenológico para vacas cría
      if (['VACAS', 'VAQUILLONAS'].includes(categoria)) {
        ev *= vacaFenologiaFactor(i, paritionSeason)
      }

      return { herdName: h.name, ev: parseFloat(ev.toFixed(2)), headCount }
    })

    const totalEV = parseFloat(breakdown.reduce((s, b) => s + b.ev, 0).toFixed(2))
    const dailyDemandKg = parseFloat((totalEV * dailyAlloc).toFixed(1))

    return { month: i, monthLabel, totalEV, dailyDemandKg, breakdown }
  })
}
