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
  /** GeoJSON Geometry (Polygon or MultiPolygon) — always 2D, Z stripped */
  geojson: any
  /** Calculated area in hectares */
  area_ha: number
}

export interface KmlParseResult {
  features: ParsedKmlFeature[]
  error?: string
}

// ─── Z-coordinate stripping ─────────────────────────────────────────────────
// KML files often include altitude as the 3rd coordinate [lon, lat, alt].
// PostgreSQL's geometry column is 2D-only, so we must drop the Z before saving.
// Error without this: "Geometry has Z dimension but column does not"

function strip2DCoord(coord: number[]): number[] {
  return [coord[0], coord[1]]
}

function strip2DRing(ring: number[][]): number[][] {
  return ring.map(strip2DCoord)
}

function strip2DGeometry(geom: any): any {
  if (!geom) return geom
  if (geom.type === 'Polygon') {
    return { ...geom, coordinates: geom.coordinates.map(strip2DRing) }
  }
  if (geom.type === 'MultiPolygon') {
    return {
      ...geom,
      coordinates: geom.coordinates.map((poly: number[][][]) =>
        poly.map(strip2DRing)
      ),
    }
  }
  return geom
}

// ─── parseKmlText ────────────────────────────────────────────────────────────

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

      // Strip Z dimension before storing — PostgreSQL column is 2D only
      const geom2D = strip2DGeometry(geom)
      const area_ha = parseFloat(
        (turfArea({ type: 'Feature', geometry: geom2D, properties: {} }) / 10000).toFixed(2)
      )
      const name: string =
        feature.properties?.name ||
        feature.properties?.Name ||
        `Polígono ${features.length + 1}`

      // Store plain 2D Geometry (not the full Feature) so callers can pass it
      // directly to the backend as `geojson` or `boundary`.
      features.push({ name, geojson: geom2D, area_ha })
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

// ─── parseKmlFile ────────────────────────────────────────────────────────────

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
