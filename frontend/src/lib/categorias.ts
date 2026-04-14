/**
 * Categorías comerciales de hacienda bovina.
 * Compartidas entre Onboarding (Step3Herds), Rebaños (Dashboard) y Valuación Ganadera.
 */

export const CATEGORIAS_COMERCIALES = [
  'TERNEROS',
  'TERNERAS',
  'NOVILLITOS',
  'NOVILLOS',
  'TOROS',
  'VAQUILLONAS',
  'VACAS',
  'MEJ',         // Mestizos / de inferior calidad genética
  'BUBALINOS',   // Búfalos
] as const

export type CategoriaComercial = typeof CATEGORIAS_COMERCIALES[number]

/** Pesos promedio típicos por categoría (kg) */
export const CATEGORIA_PESO_DEFAULT: Record<CategoriaComercial, number> = {
  NOVILLOS:    380,
  NOVILLITOS:  280,
  VAQUILLONAS: 300,
  TERNEROS:    150,
  TERNERAS:    130,
  VACAS:       420,
  TOROS:       600,
  MEJ:         350,
  BUBALINOS:   500,
}

/** Factor de demanda forrajera (EV) por categoría */
export const CATEGORIA_DEMAND_FACTOR: Record<CategoriaComercial, number> = {
  NOVILLOS:    1.00,
  NOVILLITOS:  0.90,
  VAQUILLONAS: 0.90,
  TERNEROS:    0.60,
  TERNERAS:    0.55,
  VACAS:       1.00,
  TOROS:       1.25,
  MEJ:         0.90,
  BUBALINOS:   1.10,
}

/** Razas por categoría para el selector en formularios */
export const RAZAS_POR_CATEGORIA: Record<CategoriaComercial | string, string[]> = {
  NOVILLOS:    ['Angus', 'Hereford', 'Braford', 'Brangus', 'Aberdeen', 'Otra'],
  NOVILLITOS:  ['Angus', 'Hereford', 'Braford', 'Brangus', 'Aberdeen', 'Otra'],
  VAQUILLONAS: ['Angus', 'Hereford', 'Braford', 'Brangus', 'Holando', 'Jersey', 'Criolla', 'Otra'],
  TERNEROS:    ['Angus', 'Hereford', 'Braford', 'Brangus', 'Holando', 'Jersey', 'Criolla', 'Otra'],
  TERNERAS:    ['Angus', 'Hereford', 'Braford', 'Brangus', 'Holando', 'Jersey', 'Criolla', 'Otra'],
  VACAS:       ['Angus', 'Hereford', 'Braford', 'Brangus', 'Holando', 'Jersey', 'Criolla', 'Otra'],
  TOROS:       ['Angus', 'Hereford', 'Braford', 'Brangus', 'Criolla', 'Otra'],
  MEJ:         ['Mestizo', 'Criolla', 'Otra'],
  BUBALINOS:   ['Murrah', 'Jafarabadi', 'Mediterráneo', 'Otra'],
  // Compat con especies legacy (ovejas, caballos, etc.)
  ovejas:      ['Merino', 'Corriedale', 'Texel', 'Hampshire Down', 'Dorper', 'Otra'],
  cabras:      ['Boer', 'Anglo-Nubian', 'Saanen', 'Criolla', 'Otra'],
  caballos:    ['Criollo', 'Cuarto de Milla', 'Polo Argentino', 'Árabe', 'Percherón', 'Otra'],
}

/** Colores de badge por categoría para la UI */
export const CATEGORIA_COLORS: Record<CategoriaComercial, { text: string; bg: string; dot: string }> = {
  NOVILLOS:    { text: 'text-green-700',   bg: 'bg-green-50 border-green-200',   dot: 'bg-green-500' },
  NOVILLITOS:  { text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  VAQUILLONAS: { text: 'text-teal-700',    bg: 'bg-teal-50 border-teal-200',     dot: 'bg-teal-500' },
  TERNEROS:    { text: 'text-lime-700',    bg: 'bg-lime-50 border-lime-200',     dot: 'bg-lime-500' },
  TERNERAS:    { text: 'text-yellow-700',  bg: 'bg-yellow-50 border-yellow-200', dot: 'bg-yellow-500' },
  VACAS:       { text: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',   dot: 'bg-amber-500' },
  TOROS:       { text: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200', dot: 'bg-orange-500' },
  MEJ:         { text: 'text-red-700',     bg: 'bg-red-50 border-red-200',       dot: 'bg-red-400' },
  BUBALINOS:   { text: 'text-purple-700',  bg: 'bg-purple-50 border-purple-200', dot: 'bg-purple-500' },
}

// ── Etiquetas en formato oración singular (RAE) ───────────────────────────────

/**
 * Mapa de clave interna → etiqueta visual en formato oración, singular (RAE).
 * Ej: NOVILLOS → "Novillo"
 */
export const CATEGORIA_LABEL_RAE: Record<CategoriaComercial, string> = {
  TERNEROS:    'Ternero',
  TERNERAS:    'Ternera',
  NOVILLITOS:  'Novillito',
  NOVILLOS:    'Novillo',
  TOROS:       'Toro',
  VAQUILLONAS: 'Vaquillona',
  VACAS:       'Vaca',
  MEJ:         'Mestizo',
  BUBALINOS:   'Bubalino',
}

/**
 * Mapa inverso: etiqueta RAE → clave interna.
 * Ej: "Novillo" → "NOVILLOS"
 */
export const CATEGORIA_KEY_FROM_LABEL: Record<string, CategoriaComercial> = Object.fromEntries(
  (Object.entries(CATEGORIA_LABEL_RAE) as [CategoriaComercial, string][])
    .map(([k, v]) => [v, k])
) as Record<string, CategoriaComercial>

// ── Rangos de referencia para hints de peso/edad en el formulario ─────────────

export interface CategoriaRef {
  hintPeso: string   // Ej: "160–200 kg"
  hintEdad: string   // Ej: "6–12 meses"
}

export const CATEGORIA_REF: Partial<Record<CategoriaComercial, CategoriaRef>> = {
  TERNEROS:    { hintPeso: '160–200 kg',      hintEdad: '6–12 meses' },
  TERNERAS:    { hintPeso: '160–200 kg',      hintEdad: '6–12 meses' },
  NOVILLITOS:  { hintPeso: '200–390 kg',      hintEdad: '12–24 meses' },
  NOVILLOS:    { hintPeso: 'desde 400 kg',    hintEdad: 'más de 24 meses' },
  TOROS:       { hintPeso: '600–800 kg',      hintEdad: 'más de 2 años' },
  VAQUILLONAS: { hintPeso: 'desde 190 kg',    hintEdad: '12–24 meses' },
  VACAS:       { hintPeso: '420–550 kg',      hintEdad: 'más de 2 años' },
}
