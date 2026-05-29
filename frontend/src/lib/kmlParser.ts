/**
 * kmlParser.ts
 * ─────────────
 * Shared utility to parse a KML text string into an array of GeoJSON polygon
 * features. Uses @tmcw/togeojson (already a project dep) + @turf/area.
 */
import { kml as kmlToGeoJSON } from '@tmcw/togeojson'
import { area as turfArea } from '@turf/area'

export interface ParsedKmlFeature {
  /** Name from the KML <name> tag of the Placemark */
  name: string
  /** GeoJSON Feature with Polygon or MultiPolygon geometry */
  geojson: any
  /** Calculated area in hectares */
  area_ha: number
}

export interface KmlParseResult {
  features: ParsedKmlFeature[]
  error?: string
}

/**
 * Parses a raw KML string and extracts all polygon features.
 * Returns an error string if the file is invalid or contains no polygons.
 */
export function parseKmlText(text: string): KmlParseResult {
  try {
    // Parse XML using the browser's native DOMParser
    const parser = new DOMParser()
    const doc = parser.parseFromString(text, 'application/xml')

    // Detect XML parse errors (browser puts a <parsererror> element in the doc)
    const parseError = doc.querySelector('parsererror')
    if (parseError) {
      return {
        features: [],
        error: 'El archivo KML tiene un formato XML inválido. Verificá que sea un KML correcto.',
      }
    }

    // Convert KML Document → GeoJSON FeatureCollection
    const geojson = kmlToGeoJSON(doc)

    if (!geojson || !Array.isArray(geojson.features) || geojson.features.length === 0) {
      return {
        features: [],
        error: 'El archivo KML no contiene elementos válidos.',
      }
    }

    const features: ParsedKmlFeature[] = []

    for (const feature of geojson.features) {
      const geom = feature.geometry
      if (!geom) continue
      if (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon') continue

      const area_ha = parseFloat((turfArea(feature) / 10000).toFixed(2))
      const name: string =
        feature.properties?.name ||
        feature.properties?.Name ||
        `Polígono ${features.length + 1}`

      features.push({ name, geojson: feature, area_ha })
    }

    if (features.length === 0) {
      return {
        features: [],
        error:
          'El archivo KML no contiene polígonos. ' +
          'Solo se soportan geometrías de tipo Polygon / MultiPolygon.',
      }
    }

    return { features }
  } catch (err: any) {
    return {
      features: [],
      error: `Error al procesar el KML: ${err?.message ?? 'Error desconocido'}`,
    }
  }
}

/**
 * Reads a File object and resolves with a KmlParseResult.
 * Handles file-reading errors separately.
 */
export function parseKmlFile(file: File): Promise<KmlParseResult> {
  return new Promise((resolve) => {
    if (!file.name.toLowerCase().endsWith('.kml')) {
      resolve({ features: [], error: 'El archivo debe tener extensión .kml' })
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      resolve(parseKmlText(text))
    }
    reader.onerror = () => {
      resolve({ features: [], error: 'No se pudo leer el archivo.' })
    }
    reader.readAsText(file)
  })
}
