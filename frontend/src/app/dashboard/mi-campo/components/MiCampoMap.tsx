'use client'

import React, { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import L from 'leaflet'
import { apiFetch } from '@/lib/apiFetch'
import { area } from '@turf/area'

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Pastel colors per-paddock (by index, cycling)
const PASTEL_COLORS = [
  '#a7f3d0', // emerald pastel
  '#bfdbfe', // blue pastel
  '#fde68a', // amber pastel
  '#ddd6fe', // violet pastel
  '#fca5a5', // red pastel
  '#a5f3fc', // cyan pastel
  '#fbcfe8', // pink pastel
  '#d9f99d', // lime pastel
  '#fed7aa', // orange pastel
  '#c4b5fd', // purple pastel
]
const ACTIVE_STROKE = '#f97316'  // orange
const RESTING_STROKE = '#15803d' // dark green

const getNdviColor = (ndvi: number): string => {
  if (ndvi >= 0.6) return '#15803d'
  if (ndvi >= 0.4) return '#84cc16'
  if (ndvi >= 0.2) return '#eab308'
  return '#ef4444'
}

interface Props {
  paddocks: any[]
  org: any
  fieldBoundary: any
  selectedPaddockId: string | null
  onSelectPaddock: (id: string) => void
  onPaddockGeomUpdated: (paddockId: string, geojson: any, areaHa: number) => void
  onNewPaddockDrawn: (geojson: any, areaHa: number, tempLayer: L.Layer) => void
  activeGrazingPlans?: { paddock_id: string; herd_name: string; head_count: number }[]
  drawModeActive?: boolean
  onDrawModeChange?: (active: boolean) => void
}

function MapController({
  paddocks, fieldBoundary, selectedPaddockId,
  onSelectPaddock, onPaddockGeomUpdated, onNewPaddockDrawn, activeGrazingPlans = [],
  drawModeActive = false, onDrawModeChange
}: Props) {
  const map = useMap()
  const layerGroupRef = useRef<L.LayerGroup | null>(null)
  const fieldLayerRef = useRef<L.Layer | null>(null)
  const badgeGroupRef = useRef<L.LayerGroup | null>(null)
  const hasInitialFitRef = useRef(false)

  // ── Geoman init + pm:create handler ──────────────────────────────────────
  useEffect(() => {
    map.pm.setLang('es')
    map.pm.addControls({
      position: 'topleft',
      drawCircle: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawRectangle: false,
      drawMarker: false,
      drawText: false,
      editControls: true,
      removalMode: false,
      cutPolygon: false,
    })

    // Handle new polygon creation
    const onCreate = (e: any) => {
      const layer = e.layer
      const geojsonFeature = layer.toGeoJSON()
      const areaHa = area(geojsonFeature) / 10000

      // Remove the temporary layer from map — we'll re-render via paddocks state
      map.removeLayer(layer)

      // Fire callback so parent can open the creation modal
      onNewPaddockDrawn(
        geojsonFeature.geometry || geojsonFeature,
        parseFloat(areaHa.toFixed(2)),
        layer
      )

      // Exit draw mode
      map.pm.disableDraw()
    }

    map.on('pm:create', onCreate)

    // Handle drawstart/drawend to sync state with parent
    const onDrawStart = () => onDrawModeChange?.(true)
    const onDrawEnd   = () => onDrawModeChange?.(false)
    map.on('pm:drawstart', onDrawStart)
    map.on('pm:drawend',   onDrawEnd)

    return () => {
      map.off('pm:create', onCreate)
      map.off('pm:drawstart', onDrawStart)
      map.off('pm:drawend', onDrawEnd)
      map.pm.removeControls()
    }
  }, [map, onNewPaddockDrawn, onDrawModeChange])

  // ── Programmatic draw mode toggle from parent FAB ──────────────────────
  useEffect(() => {
    if (drawModeActive) {
      map.pm.enableDraw('Polygon', {
        snappable: true,
        snapDistance: 15,
        allowSelfIntersection: false,
      })
    } else {
      map.pm.disableDraw()
    }
  }, [drawModeActive, map])

  // ── Field boundary ────────────────────────────────────────────────────────
  useEffect(() => {
    if (fieldLayerRef.current) {
      map.removeLayer(fieldLayerRef.current)
      fieldLayerRef.current = null
    }
    if (!fieldBoundary) return
    try {
      // Leaflet needs a Feature or FeatureCollection — wrap raw Geometry if needed
      const featureOrCollection =
        fieldBoundary.type === 'Feature' || fieldBoundary.type === 'FeatureCollection'
          ? fieldBoundary
          : { type: 'Feature', geometry: fieldBoundary, properties: {} }

      const layer = L.geoJSON(featureOrCollection, {
        style: { color: '#3b82f6', weight: 2.5, opacity: 0.8, fillOpacity: 0.04, dashArray: '8 4' },
      })
      layer.addTo(map)
      fieldLayerRef.current = layer

      // Fit map to field boundary on first load if no paddocks have been fit yet
      if (!hasInitialFitRef.current) {
        const bounds = layer.getBounds()
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [40, 40] })
          hasInitialFitRef.current = true
        }
      }
    } catch (err) {
      console.warn('Could not render field boundary:', err)
    }
  }, [fieldBoundary, map])

  // ── Paddock polygons ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!layerGroupRef.current) {
      layerGroupRef.current = L.layerGroup().addTo(map)
    }
    layerGroupRef.current.clearLayers()
    if (!paddocks || paddocks.length === 0) return

    const validBounds: L.LatLngBounds[] = []

    paddocks.forEach((paddock) => {
      if (!paddock.boundary) return
      let geojson = paddock.boundary
      if (typeof geojson === 'string') {
        try { geojson = JSON.parse(geojson) } catch { return }
      }

      const pastelidx = paddocks.indexOf(paddock)
      const fillColor = PASTEL_COLORS[pastelidx % PASTEL_COLORS.length]
      const strokeColor = paddock.current_status === 'GRAZING' ? ACTIVE_STROKE : RESTING_STROKE
      const isSelected = paddock.id === selectedPaddockId
      const ndvi = paddock.current_ndvi

      const layer = L.geoJSON(geojson, {
        style: {
          color: isSelected ? '#1d4ed8' : strokeColor,
          weight: isSelected ? 3.5 : 2,
          opacity: 1,
          fillColor: fillColor,
          fillOpacity: isSelected ? 0.65 : 0.4,
        },
      })

      const ndviLabel = ndvi != null ? ` · NDVI ${Number(ndvi).toFixed(2)}` : ''
      layer.bindTooltip(
        `<strong>${paddock.name}</strong>${ndviLabel}<br/>${Number(paddock.area_ha || 0).toFixed(1)} ha`,
        { permanent: false, className: 'text-xs font-bold rounded-lg' }
      )

      layer.on('click', () => onSelectPaddock(paddock.id))

      layer.on('pm:edit', async (e: any) => {
        const editedLayer = e.layer || e.target
        const updatedGeoJSON = editedLayer.toGeoJSON()
        const areaHa = area(updatedGeoJSON) / 10000
        try {
          await apiFetch(`/api/paddocks/${paddock.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ area_ha: parseFloat(areaHa.toFixed(2)) }),
          })
        } catch {}
        onPaddockGeomUpdated(paddock.id, updatedGeoJSON.geometry || updatedGeoJSON, areaHa)
      })

      layerGroupRef.current!.addLayer(layer)
      try {
        const gLayer = L.geoJSON(geojson)
        if (gLayer.getBounds().isValid()) validBounds.push(gLayer.getBounds())
      } catch {}
    })

    if (!hasInitialFitRef.current && validBounds.length > 0) {
      const combined = validBounds.reduce((acc, b) => acc.extend(b))
      if (combined.isValid()) {
        map.fitBounds(combined, { padding: [40, 40] })
        hasInitialFitRef.current = true
      }
    }
  }, [paddocks, selectedPaddockId, map])

  // ── Herd badges on GRAZING paddocks ─────────────────────────────────────────
  useEffect(() => {
    if (!badgeGroupRef.current) {
      badgeGroupRef.current = L.layerGroup().addTo(map)
    }
    badgeGroupRef.current.clearLayers()
    if (activeGrazingPlans.length === 0) return

    activeGrazingPlans.forEach(plan => {
      const paddock = paddocks.find(p => p.id === plan.paddock_id)
      if (!paddock?.boundary) return
      let geojson = paddock.boundary
      if (typeof geojson === 'string') {
        try { geojson = JSON.parse(geojson) } catch { return }
      }
      try {
        const gLayer = L.geoJSON(geojson)
        const bounds = gLayer.getBounds()
        if (!bounds.isValid()) return
        const center = bounds.getCenter()

        const badgeHtml = `
          <div style="
            background: #14532d;
            color: white;
            border-radius: 8px;
            padding: 4px 8px;
            font-family: system-ui, sans-serif;
            font-size: 10px;
            font-weight: 800;
            white-space: nowrap;
            display: flex;
            align-items: center;
            gap: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.35);
            border: 2px solid #16a34a;
            pointer-events: none;
          ">
            <span style="font-size:12px">\uD83D\uDC04</span>
            <span>${plan.herd_name}</span>
            <span style="background:rgba(255,255,255,0.15);border-radius:4px;padding:1px 4px;">${plan.head_count}</span>
          </div>
        `

        const icon = L.divIcon({
          html: badgeHtml,
          className: '',
          iconAnchor: [0, 0],
        })

        const marker = L.marker(center, { icon, interactive: false })
        badgeGroupRef.current!.addLayer(marker)
      } catch {}
    })
  }, [activeGrazingPlans, paddocks, map])

  // ── Fly-to on selection ───────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedPaddockId) return
    const selected = paddocks.find(p => p.id === selectedPaddockId)
    if (!selected?.boundary) return
    let geojson = selected.boundary
    if (typeof geojson === 'string') {
      try { geojson = JSON.parse(geojson) } catch { return }
    }
    try {
      const gLayer = L.geoJSON(geojson)
      const bounds = gLayer.getBounds()
      if (bounds.isValid()) map.flyToBounds(bounds, { padding: [80, 80], duration: 1.2 })
    } catch {}
  }, [selectedPaddockId, paddocks, map])

  return null
}

export default function MiCampoMap(props: Props) {
  return (
    <MapContainer
      center={[-34.6, -58.4]}
      zoom={12}
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
    >
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution="Tiles &copy; Esri"
        maxZoom={19}
      />
      <MapController {...props} />
    </MapContainer>
  )
}
