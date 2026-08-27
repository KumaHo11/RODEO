/**
 * kmlParser.ts
 * ─────────────
 * Shared utility to parse a KML text string into an array of GeoJSON polygon
 * features. Uses @tmcw/togeojson (already a project dep) + @turf/area.
 */
import { kml as kmlToGeoJSON } from '@tmcw/togeojson'
import { area as turfArea } from '@turf/area'
import JSZip from 'jszip'
import shp from 'shpjs'

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

// ─── processGeoJSONFeatures ──────────────────────────────────────────────────

function processGeoJSONFeatures(geojsonFeatures: any[]): KmlParseResult {
  const features: ParsedKmlFeature[] = []

  if (!Array.isArray(geojsonFeatures) || geojsonFeatures.length === 0) {
    return {
      features: [],
      error: 'El archivo no contiene elementos válidos.',
    }
  }

  for (const feature of geojsonFeatures) {
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
      feature.properties?.NOM_OBJ ||
      `Polígono ${features.length + 1}`

    // Store plain 2D Geometry (not the full Feature) so callers can pass it
    // directly to the backend as `geojson` or `boundary`.
    features.push({ name, geojson: geom2D, area_ha })
  }

  if (features.length === 0) {
    return {
      features: [],
      error:
        'El archivo no contiene polígonos. ' +
        'Solo se soportan geometrías de tipo Polygon / MultiPolygon.',
    }
  }

  return { features }
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

    return processGeoJSONFeatures(geojson.features || [])
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
 * Handles .kml, .kmz, .zip (shapefile), and .geojson/.json
 */
export async function parseKmlFile(file: File): Promise<KmlParseResult> {
  const name = file.name.toLowerCase()
  if (!name.endsWith('.kml') && !name.endsWith('.kmz') && !name.endsWith('.zip') && !name.endsWith('.geojson') && !name.endsWith('.json')) {
    return { features: [], error: 'El archivo debe tener extensión .kml, .kmz, .zip o .geojson' }
  }

  try {
    if (name.endsWith('.kmz')) {
      const arrayBuffer = await file.arrayBuffer()
      const zip = await JSZip.loadAsync(arrayBuffer)
      const kmlFile = Object.values(zip.files).find(f => f.name.toLowerCase().endsWith('.kml'))
      if (!kmlFile) {
        return { features: [], error: 'El archivo KMZ no contiene ningún archivo KML válido.' }
      }
      const text = await kmlFile.async('text')
      return parseKmlText(text)
    }

    if (name.endsWith('.zip')) {
      const arrayBuffer = await file.arrayBuffer()
      const geojson: any = await shp(arrayBuffer)
      let features: any[] = []
      if (Array.isArray(geojson)) {
        geojson.forEach(g => { if (g.features) features = features.concat(g.features) })
      } else if (geojson.features) {
        features = geojson.features
      }
      return processGeoJSONFeatures(features)
    }

    if (name.endsWith('.geojson') || name.endsWith('.json')) {
      const text = await file.text()
      const geojson = JSON.parse(text)
      const features = geojson.features || (geojson.type === 'Feature' ? [geojson] : [])
      return processGeoJSONFeatures(features)
    }

    // Default: KML
    const text = await file.text()
    return parseKmlText(text)
  } catch (err: any) {
    return { features: [], error: `Error al procesar el archivo: ${err?.message ?? 'Error desconocido'}` }
  }
}
