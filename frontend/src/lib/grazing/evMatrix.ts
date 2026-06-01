/**
 * evMatrix.ts — Matriz de Equivalente Vaca (Cocimano et al., 1975)
 * ─────────────────────────────────────────────────────────────────
 * Implementa las tablas oficiales de Equivalencias Ganaderas de Cocimano,
 * Latimori y Garriz (1975), las tablas de referencia más adoptadas en
 * la ganadería argentina extensiva.
 *
 * EV de referencia: Vaca de 400 kg, gestando y criando un ternero
 * hasta los 6 meses = 1 EV. Las tablas expresan cuántos "estómagos
 * estándar" representa cada categoría según su peso y estado fisiológico.
 *
 * Fuente: Cocimano, Latimori y Garriz, 1975 — IPCVA / INTA.
 *
 * ─── Interpolación bilineal ───────────────────────────────────────
 * Para pesos o ADPV intermedios que no están exactamente en la tabla,
 * la función `calcularEV()` interpola linealmente entre las dos entradas
 * más cercanas, garantizando continuidad y precisión.
 *
 * ─── Ración sugerida por categoría ──────────────────────────────
 * La ración diaria de MS varía con la categoría fisiológica ya que la
 * energía metabolizable requerida por día es distinta.
 * Se expresa en kg MS/día por cabeza (base: ración para 1 EV × factor).
 */

// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTES GLOBALES
// ══════════════════════════════════════════════════════════════════════════════

/** Ración base sugerida en kg MS/EV/día */
export const RATION_BASE_KG_PER_EV = 12

/**
 * Ración sugerida en kg MS/día por cabeza según categoría fisiológica.
 * Varía porque la energía metabolizable requerida difiere entre estados.
 * Todos son editables por el usuario.
 */
export const RATION_SUGERIDA_POR_CATEGORIA: Record<string, number> = {
  VACA_CON_TERNERO:  14,   // Mayor demanda energética por lactancia
  VACA_PRENADA:      13,   // Demanda creciente según estadio de gestación
  VACA_VACIA:        11,   // Mantenimiento basal
  VACA_SECA:         11,   // Alias de vacía
  TORO_DESCANSO:     12,   // Mantenimiento en reposo
  TORO_SERVICIO:     15,   // Alta demanda energética en servicio
  TERNERO:           10,   // Menor masa, menor demanda absoluta
  NOVILLITO:         11,   // Recría liviana (< 300 kg)
  RECRIA_NOVILLO:    12,   // Crecimiento activo (300-450 kg)
  RECRIA_VAQUILLONA: 11,   // Crecimiento moderado
}

// ══════════════════════════════════════════════════════════════════════════════
// TABLA 1: VACAS Y VAQUILLONAS DE CRÍA — ADPV = 0 (mantenimiento)
// ══════════════════════════════════════════════════════════════════════════════
// Cocimano et al. 1975, Tabla 1.
// Eje Y: Peso vivo de la madre en kg.
// Columnas: Estado fisiológico.

/** Pesos de referencia de la tabla (kg) */
const VACA_PESOS = [300, 350, 400, 450, 500, 550]

/**
 * Tabla Cocimano — Vacas Cría.
 * Cada fila = [peso]: { lactancia_1_2, lactancia_3_4, lactancia_5_6, lactancia_7_8, seca_vacia, gest_6, gest_7, gest_8, gest_9 }
 */
const VACA_TABLA: Record<number, {
  lac12: number; lac34: number; lac56: number; lac78: number
  seca: number
  gest6: number; gest7: number; gest8: number; gest9: number
}> = {
  300: { lac12: 0.93, lac34: 1.11, lac56: 1.29, lac78: 1.35, seca: 0.66, gest6: 0.70, gest7: 0.74, gest8: 0.84, gest9: 0.90 },
  350: { lac12: 0.96, lac34: 1.14, lac56: 1.32, lac78: 1.38, seca: 0.69, gest6: 0.73, gest7: 0.77, gest8: 0.87, gest9: 0.93 },
  400: { lac12: 1.00, lac34: 1.18, lac56: 1.36, lac78: 1.42, seca: 0.73, gest6: 0.77, gest7: 0.81, gest8: 0.91, gest9: 0.97 },
  450: { lac12: 1.07, lac34: 1.25, lac56: 1.43, lac78: 1.49, seca: 0.80, gest6: 0.84, gest7: 0.88, gest8: 0.98, gest9: 1.04 },
  500: { lac12: 1.13, lac34: 1.31, lac56: 1.48, lac78: 1.55, seca: 0.86, gest6: 0.90, gest7: 0.92, gest8: 1.04, gest9: 1.10 },
  550: { lac12: 1.22, lac34: 1.39, lac56: 1.56, lac78: 1.63, seca: 0.94, gest6: 0.98, gest7: 1.00, gest8: 1.12, gest9: 1.18 },
}

// ══════════════════════════════════════════════════════════════════════════════
// TABLA 2: VAQUILLONAS EN CRECIMIENTO / RECRÍA
// ══════════════════════════════════════════════════════════════════════════════
// Cocimano et al. 1975, Tabla 2.
// Eje Y: Peso vivo (kg). Eje X: ADPV en gramos/día.

const VAQUILLONA_PESOS = [150, 200, 250]

/** ADPV en g/día para la tabla de vaquillonas */
const VAQUILLONA_ADPV_G = [-200, -100, 0, 250, 500, 750, 1000, 1250]

const VAQUILLONA_TABLA: Record<number, Record<number, number>> = {
  150: { '-200': 0.46, '-100': 0.48, '0': 0.50, '250': 0.56, '500': 0.63, '750': 0.71, '1000': 0.80, '1250': 0.90 },
  200: { '-200': 0.50, '-100': 0.52, '0': 0.54, '250': 0.62, '500': 0.71, '750': 0.80, '1000': 0.91, '1250': 1.03 },
  250: { '-200': 0.56, '-100': 0.58, '0': 0.60, '250': 0.69, '500': 0.80, '750': 0.91, '1000': 1.04, '1250': 1.18 },
}

// ══════════════════════════════════════════════════════════════════════════════
// TABLA 3: TOROS
// ══════════════════════════════════════════════════════════════════════════════
// Cocimano et al. 1975, Tabla 3.

const TORO_PESOS = [600, 700, 800]

const TORO_ADPV_G = [0, 250, 500, 750, 1000]

const TORO_TABLA: Record<number, Record<number, number>> = {
  600: { '0': 0.98, '250': 1.15, '500': 1.32, '750': 1.51, '1000': 1.71 },
  700: { '0': 1.10, '250': 1.28, '500': 1.48, '750': 1.69, '1000': 1.92 },
  800: { '0': 1.21, '250': 1.41, '500': 1.63, '750': 1.86, '1000': 2.11 },
}

// ══════════════════════════════════════════════════════════════════════════════
// TABLA 4: NOVILLOS (INVERNADA / TERMINACIÓN)
// ══════════════════════════════════════════════════════════════════════════════
// Cocimano et al. 1975, Tabla 4.

const NOVILLO_PESOS = [150, 200, 250, 300, 350, 400, 450, 500, 550]

const NOVILLO_ADPV_G = [-200, -100, 0, 250, 500, 750, 1000, 1250]

const NOVILLO_TABLA: Record<number, Record<number, number>> = {
  150: { '-200': 0.46, '-100': 0.48, '0': 0.50, '250': 0.55, '500': 0.61, '750': 0.68, '1000': 0.76, '1250': 0.84 },
  200: { '-200': 0.50, '-100': 0.52, '0': 0.54, '250': 0.61, '500': 0.69, '750': 0.77, '1000': 0.86, '1250': 0.96 },
  250: { '-200': 0.56, '-100': 0.58, '0': 0.60, '250': 0.68, '500': 0.78, '750': 0.87, '1000': 0.98, '1250': 1.09 },
  300: { '-200': 0.61, '-100': 0.63, '0': 0.66, '250': 0.75, '500': 0.86, '750': 0.97, '1000': 1.10, '1250': 1.23 },
  350: { '-200': 0.64, '-100': 0.66, '0': 0.69, '250': 0.80, '500': 0.92, '750': 1.04, '1000': 1.19, '1250': 1.34 },
  400: { '-200': 0.67, '-100': 0.70, '0': 0.73, '250': 0.85, '500': 0.98, '750': 1.12, '1000': 1.28, '1250': 1.44 },
  450: { '-200': 0.73, '-100': 0.76, '0': 0.80, '250': 0.93, '500': 1.07, '750': 1.22, '1000': 1.39, '1250': 1.57 },
  500: { '-200': 0.79, '-100': 0.82, '0': 0.86, '250': 1.00, '500': 1.15, '750': 1.32, '1000': 1.50, '1250': 1.69 },
  550: { '-200': 0.85, '-100': 0.88, '0': 0.92, '250': 1.07, '500': 1.24, '750': 1.42, '1000': 1.61, '1250': 1.81 },
}

// ══════════════════════════════════════════════════════════════════════════════
// UTILIDADES DE INTERPOLACIÓN
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Interpola linealmente entre dos valores.
 * @param x  Valor a interpolar
 * @param x0 Límite inferior del intervalo
 * @param x1 Límite superior del intervalo
 * @param y0 EV en x0
 * @param y1 EV en x1
 */
function lerp(x: number, x0: number, x1: number, y0: number, y1: number): number {
  if (x0 === x1) return y0
  return y0 + (y1 - y0) * ((x - x0) / (x1 - x0))
}

/**
 * Encuentra los dos índices más cercanos al valor dado dentro del array ordenado.
 * Clampea a los extremos si el valor está fuera de rango.
 */
function bracket(arr: number[], val: number): [number, number] {
  const clamped = Math.max(arr[0], Math.min(arr[arr.length - 1], val))
  let lo = arr[0], hi = arr[arr.length - 1]
  for (let i = 0; i < arr.length - 1; i++) {
    if (clamped >= arr[i] && clamped <= arr[i + 1]) {
      lo = arr[i]; hi = arr[i + 1]; break
    }
  }
  return [lo, hi]
}

/**
 * Interpola en la tabla de vacas para un campo dado según el peso.
 */
function interpolarVaca(pesoKg: number, campo: keyof typeof VACA_TABLA[number]): number {
  const [p0, p1] = bracket(VACA_PESOS, pesoKg)
  const v0 = VACA_TABLA[p0][campo]
  const v1 = VACA_TABLA[p1][campo]
  return lerp(pesoKg, p0, p1, v0, v1)
}

/**
 * Interpola en una tabla de crecimiento (novillo/vaquillona/toro) para
 * peso × ADPV, con interpolación bilineal.
 *
 * @param tabla   Tabla de referencia (NOVILLO_TABLA, VAQUILLONA_TABLA, etc.)
 * @param pesos   Array de pesos en la tabla
 * @param adpvArr Array de ADPV en g/día de la tabla
 * @param pesoKg  Peso actual del animal en kg
 * @param adpvKgDay ADPV del animal en kg/día
 */
function interpolarCrecimiento(
  tabla: Record<number, Record<number, number>>,
  pesos: number[],
  adpvArr: number[],
  pesoKg: number,
  adpvKgDay: number,
): number {
  // ADPV viene en kg/día → convertir a g/día para usar la tabla
  const adpvG = adpvKgDay * 1000

  const [p0, p1] = bracket(pesos, pesoKg)
  const [a0, a1] = bracket(adpvArr, adpvG)

  const v00 = tabla[p0]?.[a0] ?? 0
  const v01 = tabla[p0]?.[a1] ?? 0
  const v10 = tabla[p1]?.[a0] ?? 0
  const v11 = tabla[p1]?.[a1] ?? 0

  // Interpolación bilineal:
  // 1. Interpolar en ADPV para cada peso
  const vp0 = lerp(adpvG, a0, a1, v00, v01)
  const vp1 = lerp(adpvG, a0, a1, v10, v11)
  // 2. Interpolar en peso
  return lerp(pesoKg, p0, p1, vp0, vp1)
}

// ══════════════════════════════════════════════════════════════════════════════
// TIPOS DE PARÁMETROS
// ══════════════════════════════════════════════════════════════════════════════

export type LactanciaRange = '1-2' | '3-4' | '5-6' | '7-8'
export type EstadioGestacion = '6' | '7' | '8' | '9'

export const LACTANCIA_RANGES: { value: LactanciaRange; label: string }[] = [
  { value: '1-2', label: '1º y 2º mes (pico de lactancia)' },
  { value: '3-4', label: '3º y 4º mes' },
  { value: '5-6', label: '5º y 6º mes (destete próximo)' },
  { value: '7-8', label: '7º y 8º mes (lactancia tardía)' },
]

export const ESTADIOS_GESTACION: { value: EstadioGestacion; label: string }[] = [
  { value: '6', label: '6º mes de gestación' },
  { value: '7', label: '7º mes de gestación' },
  { value: '8', label: '8º mes de gestación' },
  { value: '9', label: '9º mes de gestación (próxima al parto)' },
]

// ══════════════════════════════════════════════════════════════════════════════
// FUNCIÓN CENTRAL: calcularEV
// ══════════════════════════════════════════════════════════════════════════════

export interface CalcEVParams {
  /** Categoría fisiológica del animal */
  categoria: string
  /** Peso vivo promedio en kg */
  pesoKg: number
  /** ADPV en kg/día (requerido para recría/novillos/toros, ignorado para vacas) */
  adpvKgDay?: number
  /** Rango de meses de lactancia (solo para VACA_CON_TERNERO) */
  lactanciaRange?: LactanciaRange | null
  /** Estadio de gestación — número de mes (solo para VACA_PRENADA) */
  estadioGestacion?: EstadioGestacion | null
}

export interface CalcEVResult {
  /** EV por cabeza (unitario) extraído de la tabla */
  evUnitario: number
  /** Ración sugerida en kg MS/día por cabeza */
  racionSugeridaKgDia: number
  /** Fuente del cálculo (para debugging y UI) */
  fuente: 'cocimano' | 'fallback'
  /** Descripción legible de la lógica aplicada */
  descripcion: string
}

/**
 * Calcula el Equivalente Vaca unitario según las tablas Cocimano (1975).
 *
 * @param params  Parámetros del cálculo
 * @returns       EV unitario + ración sugerida + metadatos
 *
 * @example
 * // Vaca con ternero al pie de 400 kg en 3-4 mes de lactancia
 * calcularEV({ categoria: 'VACA_CON_TERNERO', pesoKg: 400, lactanciaRange: '3-4' })
 * // → { evUnitario: 1.18, ... }
 *
 * @example
 * // Novillo de 350 kg con ADPV de 0.5 kg/día
 * calcularEV({ categoria: 'RECRIA_NOVILLO', pesoKg: 350, adpvKgDay: 0.5 })
 * // → { evUnitario: 0.92, ... }
 */
export function calcularEV(params: CalcEVParams): CalcEVResult {
  const { categoria, pesoKg, adpvKgDay = 0, lactanciaRange, estadioGestacion } = params

  const cat = categoria.toUpperCase()
  const racionSugeridaKgDia = RATION_SUGERIDA_POR_CATEGORIA[cat] ?? RATION_BASE_KG_PER_EV

  // ── VACA CON TERNERO AL PIE ─────────────────────────────────────────────────
  if (cat === 'VACA_CON_TERNERO') {
    const campo: keyof typeof VACA_TABLA[number] =
      lactanciaRange === '1-2' ? 'lac12'
      : lactanciaRange === '3-4' ? 'lac34'
      : lactanciaRange === '5-6' ? 'lac56'
      : lactanciaRange === '7-8' ? 'lac78'
      : 'lac34' // default: 3-4 mes

    const ev = interpolarVaca(pesoKg, campo)
    const mesLabel = lactanciaRange ?? '3-4'
    return {
      evUnitario: parseFloat(ev.toFixed(3)),
      racionSugeridaKgDia,
      fuente: 'cocimano',
      descripcion: `Vaca con ternero · ${mesLabel}º mes · ${pesoKg} kg`,
    }
  }

  // ── VACA PREÑADA ────────────────────────────────────────────────────────────
  if (cat === 'VACA_PRENADA') {
    const campo: keyof typeof VACA_TABLA[number] =
      estadioGestacion === '6' ? 'gest6'
      : estadioGestacion === '7' ? 'gest7'
      : estadioGestacion === '8' ? 'gest8'
      : estadioGestacion === '9' ? 'gest9'
      : 'gest8' // default: 8vo mes

    const ev = interpolarVaca(pesoKg, campo)
    const mesLabel = estadioGestacion ?? '8'
    return {
      evUnitario: parseFloat(ev.toFixed(3)),
      racionSugeridaKgDia,
      fuente: 'cocimano',
      descripcion: `Vaca preñada · ${mesLabel}º mes de gestación · ${pesoKg} kg`,
    }
  }

  // ── VACA VACÍA / SECA ───────────────────────────────────────────────────────
  if (cat === 'VACA_VACIA' || cat === 'VACA_SECA') {
    const ev = interpolarVaca(pesoKg, 'seca')
    return {
      evUnitario: parseFloat(ev.toFixed(3)),
      racionSugeridaKgDia,
      fuente: 'cocimano',
      descripcion: `Vaca vacía/seca · ${pesoKg} kg · mantenimiento`,
    }
  }

  // ── TORO ────────────────────────────────────────────────────────────────────
  if (cat === 'TORO_DESCANSO' || cat === 'TORO_SERVICIO' || cat === 'TOROS') {
    const adpvEfectivo = cat === 'TORO_SERVICIO' ? Math.max(adpvKgDay, 0) : adpvKgDay
    const ev = interpolarCrecimiento(TORO_TABLA, TORO_PESOS, TORO_ADPV_G, pesoKg, adpvEfectivo)
    return {
      evUnitario: parseFloat(ev.toFixed(3)),
      racionSugeridaKgDia,
      fuente: 'cocimano',
      descripcion: `Toro · ${pesoKg} kg · ADPV ${(adpvEfectivo * 1000).toFixed(0)} g/día`,
    }
  }

  // ── RECRÍA / NOVILLOS / NOVILLITO (tabla Novillos) ──────────────────────────────────────────
  if (
    cat === 'RECRIA_NOVILLO' || cat === 'NOVILLOS' || cat === 'NOVILLITOS' ||
    cat === 'NOVILLITO' ||
    cat === 'TERNERO' || cat === 'TERNEROS' || cat === 'TERNERAS'
  ) {
    const ev = interpolarCrecimiento(NOVILLO_TABLA, NOVILLO_PESOS, NOVILLO_ADPV_G, pesoKg, adpvKgDay)
    return {
      evUnitario: parseFloat(ev.toFixed(3)),
      racionSugeridaKgDia,
      fuente: 'cocimano',
      descripcion: `Novillo/Novillito/Ternero · ${pesoKg} kg · ADPV ${(adpvKgDay * 1000).toFixed(0)} g/día`,
    }
  }

  // ── VAQUILLONA EN RECRÍA ────────────────────────────────────────────────────
  if (cat === 'RECRIA_VAQUILLONA' || cat === 'VAQUILLONAS') {
    // Para pesos > 250 kg, extender con tabla novillos (comportamiento similar)
    const tabla = pesoKg <= 250 ? VAQUILLONA_TABLA : NOVILLO_TABLA
    const pesos = pesoKg <= 250 ? VAQUILLONA_PESOS : NOVILLO_PESOS
    const ev = interpolarCrecimiento(tabla, pesos, NOVILLO_ADPV_G, pesoKg, adpvKgDay)
    return {
      evUnitario: parseFloat(ev.toFixed(3)),
      racionSugeridaKgDia,
      fuente: 'cocimano',
      descripcion: `Vaquillona · ${pesoKg} kg · ADPV ${(adpvKgDay * 1000).toFixed(0)} g/día`,
    }
  }

  // ── FALLBACK: fórmula INTA genérica ─────────────────────────────────────────
  // Para categorías no cubiertas por las tablas Cocimano
  const evFallback = parseFloat(Math.pow((pesoKg || 400) / 400, 0.75).toFixed(3))
  return {
    evUnitario: evFallback,
    racionSugeridaKgDia,
    fuente: 'fallback',
    descripcion: `${categoria} · ${pesoKg} kg · fórmula INTA genérica`,
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPER: calcularEVRodeo — EV total + consumo del lote completo
// ══════════════════════════════════════════════════════════════════════════════

export interface CalcEVRodeoResult extends CalcEVResult {
  /** EV total del lote (evUnitario × cabezas) */
  evTotal: number
  /** Ración total del rodeo en kg MS/día (racionSugerida × cabezas) */
  consumoTotalKgDia: number
  /** Número de cabezas utilizado */
  cabezas: number
}

/**
 * Calcula EV unitario, total y consumo diario total para un rodeo completo.
 *
 * @param params   Parámetros del animal
 * @param cabezas  Número de cabezas del rodeo
 * @param racionCustomKgDia Ración personalizada si el usuario la editó (opcional)
 */
export function calcularEVRodeo(
  params: CalcEVParams,
  cabezas: number,
  racionCustomKgDia?: number | null,
): CalcEVRodeoResult {
  const base = calcularEV(params)
  const racion = racionCustomKgDia ?? base.racionSugeridaKgDia
  const evTotal = parseFloat((base.evUnitario * cabezas).toFixed(2))
  const consumoTotalKgDia = parseFloat((racion * cabezas).toFixed(1))

  return {
    ...base,
    racionSugeridaKgDia: racion,
    evTotal,
    consumoTotalKgDia,
    cabezas,
  }
}
