import { useRef, useState } from 'react'
import type { EarthquakeFeature } from './api/earthquakes'
import FilterPanel from './components/FilterPanel'
import MapView from './components/MapView'
import type { MapViewHandle } from './components/MapView'
import SearchBar from './components/SearchBar'
import { useEarthquakes } from './hooks/useEarthquakes'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function daysAgoISO(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

interface Bounds {
  minLatitude: number
  maxLatitude: number
  minLongitude: number
  maxLongitude: number
}

export default function App() {
  const mapRef = useRef<MapViewHandle>(null)

  const [bounds, setBounds] = useState<Bounds | null>(null)
  const [starttime, setStarttime] = useState(daysAgoISO(7))
  const [endtime, setEndtime] = useState(todayISO())
  const [minmagnitude, setMinmagnitude] = useState(2.5)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const { data, loading, error, tooMany, tooManyCount } = useEarthquakes(bounds, {
    starttime,
    endtime,
    minmagnitude,
  })

  const features: EarthquakeFeature[] = data?.features ?? []

  return (
    <div className="app-layout">
      {/* Overlay backdrop — mobile only, closes sidebar on tap */}
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`sidebar${sidebarOpen ? ' sidebar--open' : ''}`}>
        <div className="sidebar-header">
          <div>
            <h1 className="app-title">Earthquake Dashboard</h1>
            <p className="app-subtitle">USGS · Live data</p>
          </div>
          {/* Close button — mobile only */}
          <button
            className="sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close panel"
          >✕</button>
        </div>

        <SearchBar mapRef={mapRef} />

        <FilterPanel
          starttime={starttime}
          endtime={endtime}
          minmagnitude={minmagnitude}
          onStarttimeChange={setStarttime}
          onEndtimeChange={setEndtime}
          onMinmagnitudeChange={setMinmagnitude}
          count={features.length}
          loading={loading}
          tooMany={tooMany}
          tooManyCount={tooManyCount}
          error={error}
        />

        <div className="legend">
          <p className="legend-title">Depth</p>
          <div className="legend-item">
            <span className="dot" style={{ background: '#22c55e' }} />
            &lt; 70 km (shallow)
          </div>
          <div className="legend-item">
            <span className="dot" style={{ background: '#f59e0b' }} />
            70–300 km
          </div>
          <div className="legend-item">
            <span className="dot" style={{ background: '#ef4444' }} />
            &gt; 300 km (deep)
          </div>
          <p className="legend-title" style={{ marginTop: 12 }}>Circle size = magnitude</p>
        </div>
      </aside>

      <main className="map-container">
        {/* Hamburger — always visible on mobile, hidden on desktop */}
        {!sidebarOpen && (
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open panel"
          >☰</button>
        )}
        <MapView
          ref={mapRef}
          features={features}
          onBoundsChange={setBounds}
        />
      </main>
    </div>
  )
}
