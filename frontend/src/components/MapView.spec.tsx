import { render } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EarthquakeFeature } from '../api/earthquakes'
import MapView from './MapView'
import type { MapViewHandle } from './MapView'

// Leaflet requires a real browser layout engine — mock it entirely for unit tests.
const {
  mockFlyTo,
  mockGetBounds,
  mockLayerClearLayers,
  mockLayerAddLayer,
  mockCircleMarker,
  mockWhenReady,
} = vi.hoisted(() => ({
  mockFlyTo: vi.fn(),
  mockGetBounds: vi.fn(() => ({
    getSouth: () => -10,
    getNorth: () => 10,
    getWest: () => -20,
    getEast: () => 20,
  })),
  mockLayerClearLayers: vi.fn(),
  mockLayerAddLayer: vi.fn(),
  mockCircleMarker: vi.fn(() => ({ bindPopup: vi.fn().mockReturnThis() })),
  mockWhenReady: vi.fn((cb: () => void) => {
    cb()
  }),
}))

vi.mock('leaflet', () => ({
  default: {
    map: vi.fn(() => ({
      setView: vi.fn().mockReturnThis(),
      on: vi.fn(),
      whenReady: mockWhenReady,
      getBounds: mockGetBounds,
      flyTo: mockFlyTo,
      remove: vi.fn(),
    })),
    tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
    layerGroup: vi.fn(() => ({
      addTo: vi.fn().mockReturnThis(),
      clearLayers: mockLayerClearLayers,
      addLayer: mockLayerAddLayer,
    })),
    circleMarker: mockCircleMarker,
    latLngBounds: vi.fn(() => ({})),
    latLng: vi.fn(() => ({})),
  },
}))

afterEach(() => vi.clearAllMocks())

function makeFeature(overrides: Partial<EarthquakeFeature['properties']> = {}): EarthquakeFeature {
  return {
    type: 'Feature',
    id: 'eq1',
    geometry: { type: 'Point', coordinates: [139.69, 35.69, 10] },
    properties: {
      mag: 4.5,
      place: 'Tokyo',
      time: 1700000000000,
      updated: 1700000000000,
      felt: null,
      cdi: null,
      mmi: null,
      alert: null,
      status: 'reviewed',
      tsunami: 0,
      sig: 300,
      magType: 'mw',
      type: 'earthquake',
      title: 'M 4.5 - Tokyo',
      url: 'https://earthquake.usgs.gov/eq1',
      ...overrides,
    },
  }
}

describe('MapView', () => {
  it('renders a container div', () => {
    const { container } = render(<MapView features={[]} onBoundsChange={vi.fn()} />)
    expect(container.querySelector('div')).toBeInTheDocument()
  })

  it('calls onBoundsChange with the initial map bounds on mount', () => {
    const onBoundsChange = vi.fn()
    render(<MapView features={[]} onBoundsChange={onBoundsChange} />)
    expect(onBoundsChange).toHaveBeenCalledWith({
      minLatitude: -10,
      maxLatitude: 10,
      minLongitude: -20,
      maxLongitude: 20,
    })
  })

  it('exposes flyTo via ref, forwarding to L.map.flyTo', () => {
    const ref = createRef<MapViewHandle>()
    render(<MapView ref={ref} features={[]} onBoundsChange={vi.fn()} />)
    ref.current!.flyTo(35.69, 139.69, 8)
    expect(mockFlyTo).toHaveBeenCalledWith([35.69, 139.69], 8)
  })

  it('defaults flyTo zoom to 8 when not specified', () => {
    const ref = createRef<MapViewHandle>()
    render(<MapView ref={ref} features={[]} onBoundsChange={vi.fn()} />)
    ref.current!.flyTo(35.69, 139.69)
    expect(mockFlyTo).toHaveBeenCalledWith([35.69, 139.69], 8)
  })

  it('clears the layer and adds one marker per feature', () => {
    render(<MapView features={[makeFeature(), makeFeature()]} onBoundsChange={vi.fn()} />)
    expect(mockLayerClearLayers).toHaveBeenCalled()
    expect(mockCircleMarker).toHaveBeenCalledTimes(2)
    expect(mockLayerAddLayer).toHaveBeenCalledTimes(2)
  })

  it('renders no markers when features array is empty', () => {
    render(<MapView features={[]} onBoundsChange={vi.fn()} />)
    expect(mockCircleMarker).not.toHaveBeenCalled()
  })

  it('positions each marker at [lat, lon] from GeoJSON coordinates [lon, lat, depth]', () => {
    render(<MapView features={[makeFeature()]} onBoundsChange={vi.fn()} />)
    // GeoJSON coords are [lon=139.69, lat=35.69, depth=10]
    expect(mockCircleMarker).toHaveBeenCalledWith([35.69, 139.69], expect.any(Object))
  })

  it('re-draws markers when features prop changes', () => {
    const { rerender } = render(<MapView features={[makeFeature()]} onBoundsChange={vi.fn()} />)
    rerender(<MapView features={[makeFeature(), makeFeature()]} onBoundsChange={vi.fn()} />)
    expect(mockLayerClearLayers).toHaveBeenCalledTimes(2)
    expect(mockCircleMarker).toHaveBeenCalledTimes(3) // 1 + 2
  })
})
