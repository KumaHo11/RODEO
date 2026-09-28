'use client'

/**
 * PaddockSidePanel — Lista Master del patrón 25/75.
 *
 * Replicación milimétrica del diseño de HerdsSidebar:
 *  - bg-white, border-r border-gray-200
 *  - Items: rounded-2xl, px-3 py-3.5, active = borde verde + bg-green-50
 *  - Footer: botón dividido "Nuevo potrero" → "Digitalizar" / "Manualmente"
 *  - Empty state con invitación a crear o subir KML (sin iconos)
 *  - Tarjetas: solo Nombre, ha, MS/ha y Total MS. Sin animales ni rodeos.
 */

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import clsx from 'clsx'
import { Search, X, ChevronDown, AlertTriangle } from 'lucide-react'
import { parseKmlFile, type ParsedKmlFeature } from '@/lib/kmlParser'
import type { SatelliteData } from '@/lib/services/satellite'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Paddock {
  id: string
  name: string
  area_ha: number
  dry_matter_kg_ha?: number
  current_status?: string
  boundary?: any
  geom?: any
}

interface Props {
  paddocks:             Paddock[]
  org:                  any
  loading:              boolean
  selectedPaddockId:    string | null
  onSelectPaddock:      (id: string) => void
  ndviData:             Record<string, SatelliteData>
  avgNdvi:              number | null
  onSetupField?:        () => void
  /** Abre el mapa con herramientas de dibujo activadas */
  onDigitize?:          () => void
  /** Omite el mapa y abre vista detalle vacía (modo manual) */
  onManualCreate?:      () => void
  onKmlFeaturesLoaded:  (features: ParsedKmlFeature[]) => void
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PaddockSidePanel({
  paddocks, org, loading, selectedPaddockId, onSelectPaddock,
  ndviData, avgNdvi, onSetupField, onDigitize, onManualCreate,
  onKmlFeaturesLoaded,
}: Props) {
  const [search, setSearch]           = useState('')
  const [menuOpen, setMenuOpen]       = useState(false)
  const menuRef                       = useRef<HTMLDivElement>(null)
  const kmlRef                        = useRef<HTMLInputElement>(null)
  const [kmlImporting, setKmlImporting] = useState(false)
  const [kmlMsg, setKmlMsg]           = useState<string | null>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const filtered = useMemo(() => {
    if (!search.trim()) return paddocks
    const q = search.toLowerCase()
    return paddocks.filter(p => p.name?.toLowerCase().includes(q))
  }, [paddocks, search])

  const totalArea = paddocks.reduce((s, p) => s + (Number(p.area_ha) || 0), 0)

  const handleKml = useCallback(async (file: File) => {
    setKmlImporting(true)
    setKmlMsg(null)
    const result = await parseKmlFile(file)
    setKmlImporting(false)
    if (result.error)              { setKmlMsg(result.error); return }
    if (result.features.length === 0) { setKmlMsg('No se encontraron polígonos.'); return }
    setKmlMsg(`${result.features.length} polígono${result.features.length !== 1 ? 's' : ''} importado${result.features.length !== 1 ? 's' : ''}.`)
    onKmlFeaturesLoaded(result.features)
  }, [onKmlFeaturesLoaded])

  return (
    <div className="flex flex-col h-full w-full bg-white">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 pt-5 pb-4 border-b border-gray-100">

        {/* Título + info plana inline — SIN recuadro gris */}
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xs font-black text-gray-700 tracking-widest uppercase">Potreros</h2>
          {onSetupField && (
            <button
              onClick={onSetupField}
              className="text-[10px] font-semibold text-gray-400 hover:text-gray-600 transition-colors"
            >
              Editar
            </button>
          )}
        </div>

        {/* Resumen inline: nombre · ha · potreros — completamente plano */}
        <div className="flex items-center gap-2.5 mb-3">
          {org?.name && (
            <span className="text-[11px] text-gray-500 font-medium truncate max-w-[110px]">{org.name}</span>
          )}
          {(org?.total_area_ha > 0 || totalArea > 0) && (
            <>
              {org?.name && <span className="text-[9px] text-gray-300">·</span>}
              <span className="text-[11px] font-bold text-gray-700 tabular-nums">
                {Number(org?.total_area_ha || totalArea).toFixed(0)}
                <span className="text-[9px] font-normal text-gray-400 ml-0.5">ha</span>
              </span>
            </>
          )}
          {paddocks.length > 0 && (
            <>
              <span className="text-[9px] text-gray-300">·</span>
              <span className="text-[11px] text-gray-400 tabular-nums">{paddocks.length} potreros</span>
            </>
          )}
          {avgNdvi != null && (
            <>
              <span className="text-[9px] text-gray-300">·</span>
              <span className="text-[11px] font-bold text-lime-600 tabular-nums">NDVI {avgNdvi.toFixed(2)}</span>
            </>
          )}
        </div>

        {/* Buscador */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar potrero..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-8 py-2.5 text-xs font-medium text-gray-700 placeholder:text-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {search && (
          <p className="text-[10px] text-gray-400 font-bold mt-2">
            {filtered.length > 0 ? `${filtered.length} resultado${filtered.length !== 1 ? 's' : ''}` : 'Sin resultados'}
          </p>
        )}

        {/* KML feedback */}
        {kmlMsg && (
          <div className="mt-2 flex items-center justify-between gap-2 px-2.5 py-1.5 bg-blue-50 border border-blue-100 rounded-xl">
            <span className="text-[10px] text-blue-700 font-bold truncate">{kmlMsg}</span>
            <button onClick={() => setKmlMsg(null)} className="text-blue-300 hover:text-blue-600 shrink-0">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* ── Lista scrollable ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">

        {/* Skeletons */}
        {loading && (
          <div className="flex flex-col gap-2 pt-1">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-[66px] bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state — sin iconos, solo texto limpio */}
        {!loading && paddocks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <p className="text-sm font-bold text-gray-500">Sin potreros aún</p>
            <p className="text-[11px] text-gray-300 mt-1 leading-relaxed">
              Creá tu primer potrero o subí un archivo con los polígonos
            </p>
            <div className="mt-4 w-full space-y-2">
              <div className="relative" ref={undefined}>
                <CreationDropdown
                  onDigitize={() => { setMenuOpen(false); onDigitize?.() }}
                  onManual={() => { setMenuOpen(false); onManualCreate?.() }}
                />
              </div>
              <button
                onClick={() => kmlRef.current?.click()}
                disabled={kmlImporting}
                className="w-full py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all disabled:opacity-50"
              >
                {kmlImporting ? 'Importando...' : 'Importar KML / KMZ'}
              </button>
            </div>
          </div>
        )}

        {/* Items — solo Nombre, ha, MS/ha y Total MS. Sin animales. */}
        {!loading && filtered.map(paddock => {
          const isSelected = paddock.id === selectedPaddockId
          const ms    = Number(paddock.dry_matter_kg_ha) || 0
          const area  = Number(paddock.area_ha) || 0
          const totalMs = ms > 0 && area > 0 ? Math.round(ms * area) : 0
          const sat   = ndviData[paddock.id]

          return (
            <button
              key={paddock.id}
              type="button"
              onClick={() => onSelectPaddock(paddock.id)}
              className={clsx(
                'w-full flex items-center gap-3 rounded-2xl px-3 py-3 transition-all group mb-0.5 text-left',
                isSelected
                  ? 'bg-green-50 border border-green-200/80 shadow-sm'
                  : 'hover:bg-gray-50 border border-transparent hover:border-gray-100'
              )}
            >
              {/* Dot indicador */}
              <div className={clsx(
                'w-2 h-2 rounded-full shrink-0',
                isSelected ? 'bg-green-500' : 'bg-gray-300'
              )} />

              {/* Contenido */}
              <div className="flex-1 min-w-0">
                <p className={clsx(
                  'text-sm font-bold truncate leading-tight',
                  isSelected ? 'text-green-800' : 'text-gray-800'
                )}>
                  {paddock.name}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className="text-[11px] text-gray-400 font-medium tabular-nums">
                    {area.toFixed(1)} ha
                  </span>
                  {ms > 0 && (
                    <>
                      <span className="text-[9px] text-gray-300">·</span>
                      <span className="text-[11px] font-semibold text-gray-500 tabular-nums">
                        {ms.toLocaleString('es')} kg/ha
                      </span>
                    </>
                  )}
                  {ms === 0 && (
                    <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                  )}
                  {/* NDVI inline — subtle lime pill */}
                  {sat?.averageNdvi != null && (
                    <>
                      <span className="text-[9px] text-gray-300">·</span>
                      <span className="text-[9px] font-black text-lime-600 bg-lime-50 px-1.5 py-0.5 rounded-full tabular-nums">
                        NDVI {sat.averageNdvi.toFixed(2)}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Badge derecho: Total MS */}
              {totalMs > 0 && (
                <div className={clsx(
                  'shrink-0 text-right transition-opacity',
                  isSelected ? 'opacity-100' : 'opacity-40 group-hover:opacity-80'
                )}>
                  <p className={clsx(
                    'text-xs font-black tabular-nums',
                    isSelected ? 'text-green-700' : 'text-gray-500'
                  )}>
                    {totalMs.toLocaleString('es')}
                  </p>
                  <p className="text-[8px] text-gray-400 uppercase tracking-wider font-bold">kg MS</p>
                </div>
              )}
            </button>
          )
        })}

        {/* Sin resultados de búsqueda */}
        {!loading && paddocks.length > 0 && filtered.length === 0 && (
          <div className="text-center py-10">
            <p className="text-sm font-bold text-gray-300">Sin resultados</p>
            <button onClick={() => setSearch('')} className="text-[11px] text-green-600 hover:text-green-700 font-bold mt-1">
              Limpiar búsqueda
            </button>
          </div>
        )}
      </div>

      {/* ── Footer: split button + KML inline ─────────────────────────────── */}
      <div className="shrink-0 px-4 py-4 border-t border-gray-100 bg-white">
        <div className="flex items-center gap-2">
          {/* Split button takes remaining space */}
          <div className="flex-1 min-w-0">
            <CreationDropdown
              onDigitize={onDigitize}
              onManual={onManualCreate}
            />
          </div>
          {/* KML import — compact button to the right */}
          <button
            onClick={() => kmlRef.current?.click()}
            disabled={kmlImporting}
            title="Importar KML / KMZ / GeoJSON / QGIS"
            className="shrink-0 px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-all disabled:opacity-50 whitespace-nowrap"
          >
            {kmlImporting ? 'Importando…' : 'KML / KMZ'}
          </button>
        </div>
        <input
          ref={kmlRef}
          type="file"
          accept=".kml,.kmz,.zip,.geojson,.json"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (file) await handleKml(file)
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}

// ── Split creation dropdown ───────────────────────────────────────────────────
function CreationDropdown({
  onDigitize,
  onManual,
}: {
  onDigitize?: () => void
  onManual?:   () => void
}) {
  const [open, setOpen]   = useState(false)
  const containerRef      = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Split button row — both halves open the dropdown */}
      <div className="flex w-full rounded-xl overflow-hidden border border-green-600">
        {/* Primary text — opens dropdown (user picks Digitalizar or Manualmente) */}
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="flex-1 py-1.5 text-sm font-bold text-white bg-green-600 hover:bg-green-700 active:bg-green-800 transition-all text-center"
        >
          Nuevo potrero
        </button>
        {/* Chevron divider — also toggles */}
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="px-2.5 py-1.5 text-white bg-green-600 hover:bg-green-700 active:bg-green-800 border-l border-green-500 transition-all"
          aria-label="Más opciones de creación"
        >
          <ChevronDown className={clsx(
            'w-3.5 h-3.5 transition-transform',
            open ? 'rotate-180' : ''
          )} />
        </button>
      </div>

      {/* Dropdown menu */}
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1.5 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden z-50">
          <button
            type="button"
            onClick={() => { setOpen(false); onDigitize?.() }}
            className="w-full text-left px-4 py-3 hover:bg-green-50 transition-colors"
          >
            <p className="text-sm font-bold text-gray-900">Digitalizar potrero</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Dibujá el límite en el mapa satelital</p>
          </button>
          <div className="border-t border-gray-100" />
          <button
            type="button"
            onClick={() => { setOpen(false); onManual?.() }}
            className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <p className="text-sm font-bold text-gray-900">Manualmente</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Cargá solo los datos, sin polígono</p>
          </button>
        </div>
      )}
    </div>
  )
}
