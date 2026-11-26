import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import type { EarthquakeFeature } from '../api/earthquakes'

interface Bounds {
  minLatitude: number
  maxLatitude: number
  minLongitude: number
  maxLongitude: number
}

interface Props {
  features: EarthquakeFeature[]
  onBoundsChange: (bounds: Bounds) => void
}

export interface MapViewHandle {
  flyTo: (lat: number, lon: number, zoom?: number) => void
}

function depthColor(depth: number): string {
  if (depth < 70) return '#22c55e'   // green — shallow
  if (depth < 300) return '#f59e0b'  // amber — intermediate
  return '#ef4444'                   // red — deep
}

function magRadius(mag: number): number {
  return Math.max(4, mag * 3)
}

function formatTime(epochMs: number): string {
  return new Date(epochMs).toUTCString()
}

const MapView = forwardRef<MapViewHandle, Props>(({ features, onBoundsChange }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)

  useImperativeHandle(ref, () => ({
    flyTo(lat, lon, zoom = 8) {
      mapRef.current?.flyTo([lat, lon], zoom)
    },
  }))

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      minZoom: 2,
      maxBounds: L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180)),
      maxBoundsViscosity: 1.0,
    }).setView([20, 0], 2)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
      noWrap: true,
    }).addTo(map)

    const layer = L.layerGroup().addTo(map)

    const emitBounds = () => {
      const b = map.getBounds()
      onBoundsChange({
        minLatitude: b.getSouth(),
        maxLatitude: b.getNorth(),
        minLongitude: b.getWest(),
        maxLongitude: b.getEast(),
      })
    }

    map.on('moveend', emitBounds)
    map.on('zoomend', emitBounds)
    // Emit initial bounds once the map is ready
    map.whenReady(emitBounds)

    mapRef.current = map
    layerRef.current = layer

    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

  // Redraw markers whenever features change
  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return

    layer.clearLayers()

    for (const f of features) {
      const [lon, lat, depth] = f.geometry.coordinates
      const { mag, place, time, alert, tsunami, url, magType } = f.properties

      const marker = L.circleMarker([lat, lon], {
        radius: magRadius(mag),
        color: depthColor(depth),
        fillColor: depthColor(depth),
        fillOpacity: 0.7,
        weight: 1,
      })

      const alertBadge = alert
        ? `<span style="background:${alert === 'red' ? '#ef4444' : alert === 'orange' ? '#f97316' : alert === 'yellow' ? '#eab308' : '#22c55e'};color:#fff;padding:1px 6px;border-radius:4px;font-size:11px">${alert.toUpperCase()}</span>`
        : ''
      const tsunamiTag = tsunami ? `<span style="color:#3b82f6;font-weight:600"> 🌊 Tsunami</span>` : ''

      marker.bindPopup(`
        <div style="min-width:200px;font-family:sans-serif;font-size:13px">
          <b style="font-size:14px">M${mag} ${magType}</b>${alertBadge}${tsunamiTag}<br/>
          <span style="color:#555">${place}</span><br/>
          <span>Depth: ${depth.toFixed(1)} km</span><br/>
          <span style="color:#888;font-size:11px">${formatTime(time)}</span><br/>
          <a href="${url}" target="_blank" rel="noopener" style="font-size:11px">USGS event page →</a>
        </div>
      `)

      layer.addLayer(marker)
    }
  }, [features])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    />
  )
})

MapView.displayName = 'MapView'
export default MapView
