/**
 * importPolygon.ts
 * ─────────────────
 * Universal polygon importer: converts KML, KMZ, Shapefile (.shp/.zip), and
 * GeoJSON files into a GeoJSON FeatureCollection.
 *
 * Supported formats:
 *   .geojson / .json  → parsed directly
 *   .kml              → @tmcw/togeojson
 *   .kmz              → jszip (unzip) + @tmcw/togeojson
 *   .shp / .zip       → shapefile package
 *
 * All returned geometries are assumed to be in WGS 84 (EPSG:4326).
 */

import { kml as kmlToGeoJSON } from '@tmcw/togeojson'
import JSZip from 'jszip'
import * as shapefile from 'shapefile'

// ─── Types ───────────────────────────────────────────────────────────────────

export type SupportedGeoFormat =
  | 'geojson'
  | 'kml'
  | 'kmz'
  | 'shapefile'
  | 'unknown'

// ─── detectFormat ─────────────────────────────────────────────────────────────

/**
 * Detects the geo format of a File by its extension.
 * Returns 'unknown' for unrecognized extensions.
 */
export function detectFormat(file: File): SupportedGeoFormat {
  const name = file.name.toLowerCase()
  if (name.endsWith('.geojson') || name.endsWith('.json')) return 'geojson'
  if (name.endsWith('.kml')) return 'kml'
  if (name.endsWith('.kmz')) return 'kmz'
  if (name.endsWith('.shp') || name.endsWith('.zip')) return 'shapefile'
  return 'unknown'
}

// ─── Z-strip helpers (PostgreSQL columns are 2D-only) ────────────────────────

function strip2DCoord(coord: number[]): number[] {
  return [coord[0], coord[1]]
}

function strip2DRing(ring: number[][]): number[][] {
  return ring.map(strip2DCoord)
}

function strip2DGeometry(geom: GeoJSON.Geometry | null): GeoJSON.Geometry | null {
  if (!geom) return geom
  if (geom.type === 'Polygon') {
    return { ...geom, coordinates: geom.coordinates.map(strip2DRing) }
  }
  if (geom.type === 'MultiPolygon') {
    return {
      ...geom,
      coordinates: geom.coordinates.map((poly) => poly.map(strip2DRing)),
    }
  }
  return geom
}

function strip2DFeatureCollection(
  fc: GeoJSON.FeatureCollection
): GeoJSON.FeatureCollection {
  return {
    ...fc,
    features: fc.features.map((f) => ({
      ...f,
      geometry: f.geometry ? strip2DGeometry(f.geometry)! : f.geometry,
    })),
  }
}

// ─── Format-specific importers ────────────────────────────────────────────────

async function importGeoJSON(file: File): Promise<GeoJSON.FeatureCollection> {
  const text = await file.text()
  let parsed: any
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('El archivo GeoJSON no es un JSON válido.')
  }

  if (parsed.type === 'FeatureCollection') {
    return strip2DFeatureCollection(parsed as GeoJSON.FeatureCollection)
  }
  if (parsed.type === 'Feature') {
    return strip2DFeatureCollection({
      type: 'FeatureCollection',
      features: [parsed as GeoJSON.Feature],
    })
  }
  if (parsed.coordinates) {
    return strip2DFeatureCollection({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: parsed, properties: {} }],
    })
  }
  throw new Error(
    'El archivo GeoJSON no contiene una FeatureCollection, Feature o geometría válida.'
  )
}

async function importKML(file: File): Promise<GeoJSON.FeatureCollection> {
  const text = await file.text()
  const parser = new DOMParser()
  const doc = parser.parseFromString(text, 'application/xml')

  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error(
      'El archivo KML tiene un formato XML inválido. Verificá que sea un KML correcto.'
    )
  }

  const fc = kmlToGeoJSON(doc) as GeoJSON.FeatureCollection
  if (!fc || !Array.isArray(fc.features) || fc.features.length === 0) {
    throw new Error('El archivo KML no contiene elementos válidos.')
  }

  return strip2DFeatureCollection(fc)
}

async function importKMZ(file: File): Promise<GeoJSON.FeatureCollection> {
  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)

  const kmlEntry = Object.values(zip.files).find(
    (f) => !f.dir && f.name.toLowerCase().endsWith('.kml')
  )
  if (!kmlEntry) {
    throw new Error(
      'El archivo KMZ no contiene ningún archivo .kml en su interior.'
    )
  }

  const kmlText = await kmlEntry.async('text')
  const parser = new DOMParser()
  const doc = parser.parseFromString(kmlText, 'application/xml')

  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error('El KML dentro del KMZ tiene un formato XML inválido.')
  }

  const fc = kmlToGeoJSON(doc) as GeoJSON.FeatureCollection
  if (!fc || !Array.isArray(fc.features) || fc.features.length === 0) {
    throw new Error('El KML dentro del KMZ no contiene elementos válidos.')
  }

  return strip2DFeatureCollection(fc)
}

async function importShapefile(file: File): Promise<GeoJSON.FeatureCollection> {
  const arrayBuffer = await file.arrayBuffer()

  if (file.name.toLowerCase().endsWith('.zip')) {
    const zip = await JSZip.loadAsync(arrayBuffer)

    const shpEntry = Object.values(zip.files).find(
      (f) => !f.dir && f.name.toLowerCase().endsWith('.shp')
    )
    if (!shpEntry) {
      throw new Error(
        'El archivo ZIP no contiene un archivo .shp. ' +
          'Incluí todos los archivos del shapefile (.shp, .dbf, .prj) en el ZIP.'
      )
    }

    const dbfEntry = Object.values(zip.files).find(
      (f) => !f.dir && f.name.toLowerCase().endsWith('.dbf')
    )

    const shpBuffer = await shpEntry.async('arraybuffer')
    const dbfBuffer = dbfEntry ? await dbfEntry.async('arraybuffer') : undefined

    const fc = await shapefile.read(shpBuffer, dbfBuffer)
    return strip2DFeatureCollection(fc as GeoJSON.FeatureCollection)
  }

  // Plain .shp file — no .dbf attributes available
  const fc = await shapefile.read(arrayBuffer)
  return strip2DFeatureCollection(fc as GeoJSON.FeatureCollection)
}

// ─── importFileToGeoJSON (public API) ────────────────────────────────────────

/**
 * Converts any supported geo file (KML, KMZ, Shapefile, GeoJSON) into a
 * GeoJSON FeatureCollection.
 *
 * @throws {Error} with a human-readable Spanish message on failure.
 */
export async function importFileToGeoJSON(
  file: File
): Promise<GeoJSON.FeatureCollection> {
  const format = detectFormat(file)

  switch (format) {
    case 'geojson':
      return importGeoJSON(file)
    case 'kml':
      return importKML(file)
    case 'kmz':
      return importKMZ(file)
    case 'shapefile':
      return importShapefile(file)
    case 'unknown':
    default:
      throw new Error(
        `Formato de archivo no soportado: "${file.name}". ` +
          'Los formatos aceptados son: .kml, .kmz, .shp, .zip (shapefile), .geojson, .json.'
      )
  }
}
