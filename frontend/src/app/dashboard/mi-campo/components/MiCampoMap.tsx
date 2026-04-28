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
  onDeletePaddock?: (paddockId: string) => void
  // Field boundary drawing
  fieldBoundaryDrawMode?: boolean
  onFieldBoundaryDrawn?: (geojson: any) => void
  onFieldBoundaryDrawModeChange?: (active: boolean) => void
  // Initial map center (org location from onboarding step 1)
  initialCenter?: [number, number]
}

function MapController({
  paddocks, fieldBoundary, selectedPaddockId,
  onSelectPaddock, onPaddockGeomUpdated, onNewPaddockDrawn, activeGrazingPlans = [],
  drawModeActive = false, onDrawModeChange, onDeletePaddock,
  fieldBoundaryDrawMode = false, onFieldBoundaryDrawn, onFieldBoundaryDrawModeChange,
  initialCenter,
}: Props) {
  const map = useMap()
  const layerGroupRef = useRef<L.LayerGroup | null>(null)
  const fieldLayerRef = useRef<L.Layer | null>(null)
  const badgeGroupRef = useRef<L.LayerGroup | null>(null)
  const hasInitialFitRef = useRef(false)
  const prevInitialCenter = useRef<[number, number] | undefined>(undefined)

  // -- Fly-to when user picks a location (e.g. from setup modal) ───────────────
  useEffect(() => {
    if (!initialCenter) return
    const prev = prevInitialCenter.current
    // Skip on first mount (prev is undefined) or if same coords
    if (
      prev &&
      Math.abs(prev[0] - initialCenter[0]) < 0.0001 &&
      Math.abs(prev[1] - initialCenter[1]) < 0.0001
    ) return
    prevInitialCenter.current = initialCenter
    if (!prev) return // first mount — let the normal fit logic handle it
    map.flyTo(initialCenter, 13, { animate: true, duration: 1.5 })
  }, [initialCenter, map])

  // -- Geoman init + pm:create handler --------------------------------------
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
      removalMode: true,
      cutPolygon: false,
    })

    // Handle new polygon creation — distinguishes paddock vs field boundary mode
    const onCreate = (e: any) => {
      const layer = e.layer
      const geojsonFeature = layer.toGeoJSON()
      const areaHa = area(geojsonFeature) / 10000

      map.removeLayer(layer)
      map.pm.disableDraw()

      if (fieldBoundaryDrawMode) {
        // Save as field boundary
        onFieldBoundaryDrawn?.(geojsonFeature.geometry || geojsonFeature)
        onFieldBoundaryDrawModeChange?.(false)
      } else {
        // Save as new paddock
        onNewPaddockDrawn(
          geojsonFeature.geometry || geojsonFeature,
          parseFloat(areaHa.toFixed(2)),
          layer
        )
      }
    }

    map.on('pm:create', onCreate)

    const onDrawStart = () => { onDrawModeChange?.(true); onFieldBoundaryDrawModeChange?.(fieldBoundaryDrawMode) }
    const onDrawEnd   = () => { onDrawModeChange?.(false) }
    map.on('pm:drawstart', onDrawStart)
    map.on('pm:drawend',   onDrawEnd)

    return () => {
      map.off('pm:create', onCreate)
      map.off('pm:drawstart', onDrawStart)
      map.off('pm:drawend', onDrawEnd)
      map.pm.removeControls()
    }
  }, [map, onNewPaddockDrawn, onDrawModeChange, fieldBoundaryDrawMode, onFieldBoundaryDrawn, onFieldBoundaryDrawModeChange])

  // -- Programmatic draw mode toggle (paddock or field boundary) -------------------
  useEffect(() => {
    if (drawModeActive || fieldBoundaryDrawMode) {
      map.pm.enableDraw('Polygon', {
        snappable: true,
        snapDistance: 15,
        allowSelfIntersection: false,
      })
    } else {
      map.pm.disableDraw()
    }
  }, [drawModeActive, fieldBoundaryDrawMode, map])

  // -- Field boundary --------------------------------------------------------
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

  // -- Paddock polygons ------------------------------------------------------
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

      layer.bindTooltip(
        `<strong>${paddock.name}</strong><br/>${Number(paddock.area_ha || 0).toFixed(1)} ha`,
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

      layer.on('pm:remove', () => {
        if (onDeletePaddock) onDeletePaddock(paddock.id)
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
    } else if (!hasInitialFitRef.current && validBounds.length === 0 && initialCenter) {
      // No paddocks drawn yet — fly to the org's saved location from onboarding
      map.setView(initialCenter, 14, { animate: false })
      hasInitialFitRef.current = true
    }
  }, [paddocks, selectedPaddockId, map])

  // -- Herd badges on GRAZING paddocks ─────────────────────────────────────
  useEffect(() => {
    // Usamos clearLayers() (no .remove()) para no desconectar el layerGroup del mapa
    if (!badgeGroupRef.current) {
      badgeGroupRef.current = L.layerGroup().addTo(map)
    } else {
      badgeGroupRef.current.clearLayers()
      // Volver a agregar al mapa para asegurar z-order por encima de polígonos
      try {
        badgeGroupRef.current.remove()
        badgeGroupRef.current.addTo(map)
      } catch {}
    }
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

        const headStr = plan.head_count > 0 ? `${plan.head_count} cab.` : ''
        const badgeHtml = `
          <div style="
            background: linear-gradient(135deg, #14532d 0%, #166534 100%);
            color: white;
            border-radius: 10px;
            padding: 5px 9px;
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 10px;
            font-weight: 800;
            white-space: nowrap;
            display: flex;
            align-items: center;
            gap: 5px;
            box-shadow: 0 3px 10px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.1);
            border: 1.5px solid #16a34a;
            pointer-events: none;
            letter-spacing: 0.01em;
          ">
            <span style="font-size:13px;line-height:1">🐄</span>
            <span style="max-width:80px;overflow:hidden;text-overflow:ellipsis">${plan.herd_name}</span>
            ${headStr ? `<span style="
              background: rgba(255,255,255,0.22);
              border-radius: 5px;
              padding: 1px 5px;
              font-size:10px;
              font-weight:900;
              letter-spacing:0.02em;
            ">${headStr}</span>` : ''}
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

  // -- Fly-to on selection --------------------------------------------------─
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
  // Use org location as initial center, fall back to Pampa argentina
  const center: [number, number] = props.initialCenter ?? [-34.6, -63.0]
  return (
    <MapContainer
      center={center}
      zoom={props.initialCenter ? 13 : 5}
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
