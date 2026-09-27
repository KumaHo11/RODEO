/**
 * SandboxMap.tsx — Mapa de Potreros de la Mesa de Planificación
 * ────────────────────────────────────────────────────────────────
 * Business logic:
 *  • Temporada Abierta:   polígonos seleccionados en verde (#008234) fill-opacity 0.5
 *                         + marcador numérico en el centroide indicando secuencia (1,2,3…)
 *                         que se actualiza en tiempo real al reordenar.
 *  • Temporada Cerrada:   solo polígonos resaltados, SIN marcadores numéricos.
 *  • No seleccionados:    gris translúcido, borde punteado.
 *  • Polyline de ruta:    entre centroides activos (solo temporada abierta).
 */
'use client'

import React, { useMemo, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useSandboxStore } from '@/lib/grazing/sandboxStore'
import type { PaddockSimResult } from '@/lib/grazing/types'

// Fix Leaflet default marker icon (needed when bundled with webpack/Next.js)
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ── Brand colors ──────────────────────────────────────────────────────────────

const COLOR_ACTIVE   = '#008234'  // Brand green — selected paddocks
const COLOR_HOVER    = '#005c25'  // Darker green on hover/selected highlight
const COLOR_INACTIVE = '#9ca3af'  // Gray — unselected paddocks

// ── Inner controller (needs useMap() inside MapContainer) ─────────────────────

interface ControllerProps {
  rows:          PaddockSimResult[]
  orderMap:      Map<string, number>  // paddockId → sequence number (only enabled, open season)
  activeCenters: [number, number][]
  allRings:      [number, number][][]
  hoveredId:     string | null
  selectedId:    string | null
  mode:          'open' | 'closed'
  onHover:       (id: string | null) => void
  onSelect:      (id: string | null) => void
}

function MapController({
  rows, orderMap, activeCenters, allRings,
  hoveredId, selectedId, mode, onHover, onSelect,
}: ControllerProps) {
  const map       = useMap()
  const layerRef  = useRef<L.LayerGroup | null>(null)
  const routeRef  = useRef<L.Polyline | null>(null)
  const hasFitRef = useRef(false)

  // FitBounds once when polygons first load
  useEffect(() => {
    if (hasFitRef.current || allRings.length === 0) return
    const all  = allRings.flat()
    const lats = all.map(c => c[0])
    const lngs = all.map(c => c[1])
    try {
      map.fitBounds(
        [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
        { padding: [40, 40] },
      )
      hasFitRef.current = true
    } catch { /* no-op */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRings.length > 0])

  // ── Render polygons + tooltips ──────────────────────────────────────────────
  useEffect(() => {
    if (!layerRef.current) {
      layerRef.current = L.layerGroup().addTo(map)
    }
    layerRef.current.clearLayers()

    rows.forEach(row => {
      if (!row.polygon || row.polygon.length < 3) return

      const positions  = row.polygon as [number, number][]
      const isHovered  = row.id === hoveredId
      const isSelected = row.id === selectedId
      const active     = row.enabled
      const orderN     = orderMap.get(row.id)  // undefined when not active or closed season

      // ── Colors ──────────────────────────────────────────────────────────────
      const strokeColor = active
        ? (isHovered || isSelected) ? COLOR_HOVER : COLOR_ACTIVE
        : COLOR_INACTIVE

      const polygon = L.polygon(positions, {
        color:       strokeColor,
        weight:      active ? (isHovered || isSelected ? 3 : 2) : 1,
        fillColor:   active ? COLOR_ACTIVE : COLOR_INACTIVE,
        // Business logic: selected → 0.5 opacity; inactive → very subtle
        fillOpacity: active ? 0.5 : 0.08,
        dashArray:   active ? undefined : '5 4',
      })

      // ── Tooltip label ────────────────────────────────────────────────────────
      // Map labels: strip the prefix word "Lote " to reduce visual noise.
      // (Full names are preserved in the sidebar lists.)
      const shortName = row.name.replace(/^Lote\s+/i, '')

      // Open season: show sequence number badge + shortName + dpSugerido
      // Closed season: show name only (no sequence number)
      const badgeHtml = (mode === 'open' && orderN != null)
        ? `<span style="
            width:18px;height:18px;
            background:${active ? COLOR_ACTIVE : COLOR_INACTIVE};
            color:white;border-radius:50%;
            font-size:10px;font-weight:900;
            display:flex;align-items:center;justify-content:center;
            flex-shrink:0;
          ">${orderN}</span>`
        : active
          ? `<span style="
              width:7px;height:7px;
              background:${COLOR_ACTIVE};
              border-radius:50%;
              display:inline-block;
              flex-shrink:0;
            "></span>`
          : `<span style="
              width:7px;height:7px;
              background:${COLOR_INACTIVE};
              border-radius:50%;
              display:inline-block;
              flex-shrink:0;
            "></span>`

      const dpBadge = (mode === 'open' && active && row.dpSugerido > 0)
        ? `<span style="font-size:10px;font-weight:700;color:#15803d;background:rgba(240,253,244,0.9);padding:1px 4px;border-radius:4px;">${row.dpSugerido}d</span>`
        : ''

      const tooltipHtml = `<div style="
        display:flex;align-items:center;gap:4px;
        font-family:system-ui,sans-serif;
        pointer-events:none;
      ">${badgeHtml}<span style="font-size:11px;font-weight:${active ? 700 : 500};">${shortName}</span>${dpBadge}</div>`

      // CSS class drives the visual state: translucent by default,
      // solid white + shadow when active or hovered.
      const tooltipClass = (isSelected)
        ? 'leaflet-tooltip-plain leaflet-tooltip-plain--active'
        : (isHovered)
          ? 'leaflet-tooltip-plain leaflet-tooltip-plain--hover'
          : 'leaflet-tooltip-plain'

      polygon.bindTooltip(tooltipHtml, {
        permanent:  true,
        direction:  'center',
        className:  tooltipClass,
      })

      polygon.on('mouseover', () => onHover(row.id))
      polygon.on('mouseout',  () => onHover(null))
      polygon.on('click',     () => onSelect(row.id === selectedId ? null : row.id))

      layerRef.current!.addLayer(polygon)
    })
  }, [rows, orderMap, hoveredId, selectedId, mode, map, onHover, onSelect])

  // ── Route polyline (open season only) ───────────────────────────────────────
  useEffect(() => {
    if (routeRef.current) {
      routeRef.current.remove()
      routeRef.current = null
    }
    // Only draw the grazing route in open season
    if (mode === 'open' && activeCenters.length >= 2) {
      routeRef.current = L.polyline(activeCenters, {
        color:     COLOR_ACTIVE,
        weight:    2,
        dashArray: '8 5',
        opacity:   0.6,
      }).addTo(map)
    }
  }, [activeCenters, mode, map])

  return null
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function SandboxMap() {
  const result             = useSandboxStore(s => s.result)
  const mode               = useSandboxStore(s => s.mode)
  const hoveredPaddockId   = useSandboxStore(s => s.hoveredPaddockId)
  const selectedPaddockId  = useSandboxStore(s => s.selectedPaddockId)
  const setHoveredPaddock  = useSandboxStore(s => s.setHoveredPaddock)
  const setSelectedPaddock = useSandboxStore(s => s.setSelectedPaddock)
  const rawRows            = useSandboxStore(s => s.paddockRows)

  // Respect user drag-order (order field from reorderPaddocks action)
  const paddockRows = useMemo(
    () => [...rawRows].sort((a, b) => a.order - b.order),
    [rawRows],
  )

  // Merge simulation results into paddock rows
  const resultMap = useMemo(() => {
    const m = new Map<string, PaddockSimResult>()
    result?.rows.forEach(r => m.set(r.id, r))
    return m
  }, [result])

  const rows = useMemo(() =>
    paddockRows.map(p => resultMap.get(p.id) ?? {
      ...p, coeficiente: 0, dpPrimavera: 0, dpVerano: 0,
      dpSugerido: 0, descansoResultante: 0, needsBoyero: false,
      aforoDisponibleKgMs: 0, status: 'ok' as const, statusMsg: '',
    }),
    [paddockRows, resultMap],
  )

  // Only rows that have a valid polygon (≥3 vertices)
  const withPolygon = useMemo(
    () => rows.filter(r => Array.isArray(r.polygon) && r.polygon.length >= 3),
    [rows],
  )

  /**
   * Sequence map: paddockId → sequence number (1, 2, 3…)
   * Built from the sorted, enabled paddocks so drag-reorder is reflected live.
   * For closed season, the map is populated but the map controller ignores it.
   */
  const orderMap = useMemo(() => {
    const m = new Map<string, number>()
    let n = 1
    for (const r of withPolygon) {
      if (r.enabled) m.set(r.id, n++)
    }
    return m
  }, [withPolygon])

  // Centroid of each active paddock (for route polyline)
  const activeCenters = useMemo((): [number, number][] =>
    withPolygon.filter(r => r.enabled).map(r => {
      if (r.lat != null && r.lng != null) return [r.lat, r.lng]
      const ring = r.polygon as [number, number][]
      return [
        ring.reduce((s, c) => s + c[0], 0) / ring.length,
        ring.reduce((s, c) => s + c[1], 0) / ring.length,
      ]
    }),
    [withPolygon],
  )

  const allRings = useMemo(
    () => withPolygon.map(r => r.polygon as [number, number][]),
    [withPolygon],
  )

  // Default center for MapContainer (used on first mount before fitBounds)
  const mapCenter = useMemo<[number, number]>(() => {
    if (activeCenters.length) {
      return [
        activeCenters.reduce((s, c) => s + c[0], 0) / activeCenters.length,
        activeCenters.reduce((s, c) => s + c[1], 0) / activeCenters.length,
      ]
    }
    if (allRings.length) {
      const ring = allRings[0]
      return [
        ring.reduce((s, c) => s + c[0], 0) / ring.length,
        ring.reduce((s, c) => s + c[1], 0) / ring.length,
      ]
    }
    return [-34.6, -63.0]
  }, [activeCenters, allRings])

  // ── Empty state — only shown when zero paddocks have geometry ───────────────
  if (withPolygon.length === 0) {
    const hasAnyPaddocks = rawRows.length > 0
    return (
      <div className="sandbox-map-empty">
        <div className="sandbox-map-empty-content">
          <span className="sandbox-map-empty-icon">🗺️</span>
          {hasAnyPaddocks ? (
            <>
              <p>Los potreros no tienen geometría</p>
              <p className="text-xs" style={{ color: '#9ca3af' }}>
                Dibujá o importá polígonos en <strong>Mi Campo</strong> para verlos aquí.
              </p>
            </>
          ) : (
            <>
              <p>Sin potreros cargados</p>
              <p className="text-xs" style={{ color: '#9ca3af' }}>
                Cargá potreros en Mi Campo para ver el mapa.
              </p>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      <MapContainer
        center={mapCenter}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri"
          maxZoom={19}
        />
        <MapController
          rows={withPolygon}
          orderMap={orderMap}
          activeCenters={activeCenters}
          allRings={allRings}
          hoveredId={hoveredPaddockId}
          selectedId={selectedPaddockId}
          mode={mode}
          onHover={setHoveredPaddock}
          onSelect={setSelectedPaddock}
        />
      </MapContainer>

      {/* Legend */}
      <div className="sandbox-map-legend">
        <span className="legend-item" style={{ color: COLOR_ACTIVE }}>● Activo</span>
        <span className="legend-item legend-item--off">◌ Excluido</span>
        {mode === 'open' && (
          <span className="legend-item" style={{ color: COLOR_ACTIVE, opacity: 0.7 }}>— Ruta</span>
        )}
        <span
          className="legend-item"
          style={{
            marginLeft: 'auto',
            fontSize: '9px',
            fontWeight: 700,
            color: mode === 'open' ? '#15803d' : '#6b7280',
            background: mode === 'open' ? '#f0fdf4' : '#f3f4f6',
            padding: '1px 6px',
            borderRadius: 999,
          }}
        >
          {mode === 'open' ? '🌱 Abierta' : '❄️ Cerrada'}
        </span>
      </div>
    </div>
  )
}
