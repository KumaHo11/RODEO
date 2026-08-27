/**
 * validatePolygon.ts
 * ───────────────────
 * Validates that a GeoJSON FeatureCollection contains at least one Polygon or
 * MultiPolygon feature with a sensible area (0.1 ha – 500,000 ha).
 *
 * Returns { valid: true, feature } on success or { valid: false, error } on
 * failure. All error messages are in Spanish for the RODEO UI.
 */

import { area as turfArea } from '@turf/area'

const MIN_HA = 0.1
const MAX_HA = 500_000

export interface ValidateResult {
  valid: boolean
  error?: string
  feature?: GeoJSON.Feature
}

/**
 * Validates the first polygon/multipolygon feature inside a FeatureCollection.
 *
 * Checks:
 *  1. At least one feature exists in the collection.
 *  2. The first feature has a Polygon or MultiPolygon geometry.
 *  3. The calculated area is within [0.1 ha, 500 000 ha].
 */
export function validateGeoJSONPolygon(
  geojson: GeoJSON.FeatureCollection
): ValidateResult {
  if (!geojson || !Array.isArray(geojson.features) || geojson.features.length === 0) {
    return {
      valid: false,
      error: 'El archivo no contiene ningún polígono.',
    }
  }

  // Find the first Polygon or MultiPolygon feature
  const feature = geojson.features.find(
    (f) =>
      f.geometry &&
      (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
  )

  if (!feature) {
    return {
      valid: false,
      error:
        'El archivo no contiene geometrías de tipo Polygon o MultiPolygon. ' +
        'Asegurate de exportar un polígono cerrado.',
    }
  }

  // Calculate area in hectares
  const areaHa = turfArea(feature) / 10_000

  if (areaHa < MIN_HA) {
    return {
      valid: false,
      error: `El polígono es demasiado pequeño (${areaHa.toFixed(4)} ha). El mínimo permitido es ${MIN_HA} ha.`,
    }
  }

  if (areaHa > MAX_HA) {
    return {
      valid: false,
      error: `El polígono es demasiado grande (${Math.round(areaHa).toLocaleString('es-AR')} ha). El máximo permitido es ${MAX_HA.toLocaleString('es-AR')} ha.`,
    }
  }

  return { valid: true, feature }
}
