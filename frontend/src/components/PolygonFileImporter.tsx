'use client'

/**
 * PolygonFileImporter.tsx
 * ────────────────────────
 * Drag-and-drop / click-to-browse component for importing polygon files.
 *
 * Supported formats: .kml, .kmz, .shp, .zip (shapefile bundle), .geojson, .json
 *
 * On success, calls `onImport` with the first valid GeoJSON Feature.
 * Shows spinner while processing, green checkmark on success, red error on failure.
 */

import React, { useCallback, useRef, useState } from 'react'
import { Upload, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { importFileToGeoJSON } from '@/lib/geo/importPolygon'
import { validateGeoJSONPolygon } from '@/lib/geo/validatePolygon'
import { area as turfArea } from '@turf/area'

// ─── Props ────────────────────────────────────────────────────────────────────

interface PolygonFileImporterProps {
  onImport: (geojson: GeoJSON.Feature) => void
  className?: string
}

// ─── Accepted MIME types / extensions ────────────────────────────────────────

const ACCEPTED = '.kml,.kmz,.shp,.zip,.geojson,.json'

// ─── Component ────────────────────────────────────────────────────────────────

export default function PolygonFileImporter({
  onImport,
  className = '',
}: PolygonFileImporterProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const [fileName, setFileName]     = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [areaHa, setAreaHa]         = useState<number | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [dragging, setDragging]     = useState(false)

  // ─── Core processing ───────────────────────────────────────────────────────

  const processFile = useCallback(
    async (file: File) => {
      setFileName(file.name)
      setError(null)
      setAreaHa(null)
      setProcessing(true)

      try {
        const fc = await importFileToGeoJSON(file)
        const result = validateGeoJSONPolygon(fc)

        if (!result.valid || !result.feature) {
          setError(result.error ?? 'Polígono inválido.')
          return
        }

        const ha = turfArea(result.feature) / 10_000
        setAreaHa(ha)
        onImport(result.feature)
      } catch (err: any) {
        setError(err?.message ?? 'Error al procesar el archivo.')
      } finally {
        setProcessing(false)
        // Reset input so the same file can be re-selected if needed
        if (inputRef.current) inputRef.current.value = ''
      }
    },
    [onImport]
  )

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(true)
  }

  const handleDragLeave = () => setDragging(false)

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={className}>
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !processing && inputRef.current?.click()}
        className={[
          'flex flex-col items-center justify-center gap-2',
          'border-2 border-dashed rounded-lg px-4 py-5 cursor-pointer',
          'transition-all select-none',
          dragging
            ? 'border-cyan-400 bg-cyan-50'
            : 'border-gray-200 bg-gray-50 hover:border-cyan-300 hover:bg-cyan-50/40',
          processing ? 'cursor-wait opacity-70' : '',
        ].join(' ')}
      >
        {/* Icon / spinner */}
        {processing ? (
          <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
        ) : areaHa !== null && !error ? (
          <CheckCircle className="w-6 h-6 text-green-500" />
        ) : error ? (
          <XCircle className="w-6 h-6 text-red-500" />
        ) : (
          <Upload className="w-6 h-6 text-gray-400" />
        )}

        {/* Status text */}
        {processing && (
          <p className="text-xs font-bold text-cyan-600">Procesando archivo...</p>
        )}

        {!processing && areaHa !== null && !error && (
          <p className="text-xs font-bold text-green-700 text-center">
            Polígono importado: {areaHa.toFixed(2)} ha
          </p>
        )}

        {!processing && error && (
          <p className="text-xs font-bold text-red-600 text-center leading-snug">
            {error}
          </p>
        )}

        {!processing && areaHa === null && !error && (
          <>
            <p className="text-xs font-bold text-gray-600 text-center">
              Arrastrá un archivo o hacé click para seleccionar
            </p>
            <p className="text-[10px] text-gray-400 text-center">
              KML · KMZ · Shapefile (.shp / .zip) · GeoJSON
            </p>
          </>
        )}

        {/* File name badge */}
        {fileName && (
          <span className="mt-1 text-[10px] text-gray-400 font-medium truncate max-w-[200px]">
            {fileName}
          </span>
        )}

        {/* Re-import link when in success/error state */}
        {!processing && (areaHa !== null || error) && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setFileName(null)
              setAreaHa(null)
              setError(null)
              inputRef.current?.click()
            }}
            className="text-[10px] font-bold text-gray-400 hover:text-cyan-600 transition-colors mt-0.5"
          >
            Cargar otro archivo
          </button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={handleChange}
      />
    </div>
  )
}
