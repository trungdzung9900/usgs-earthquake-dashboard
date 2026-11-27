export interface EarthquakeFilters {
  starttime: string
  endtime: string
  minmagnitude?: number
  maxmagnitude?: number
  minlatitude?: number
  maxlatitude?: number
  minlongitude?: number
  maxlongitude?: number
}

export interface EarthquakeFeature {
  type: 'Feature'
  id: string
  geometry: {
    type: 'Point'
    coordinates: [number, number, number] // [lon, lat, depth_km]
  }
  properties: {
    mag: number
    place: string
    time: number
    updated: number
    felt: number | null
    cdi: number | null
    mmi: number | null
    alert: 'green' | 'yellow' | 'orange' | 'red' | null
    status: 'reviewed' | 'automatic'
    tsunami: 0 | 1
    sig: number
    magType: string
    type: string
    title: string
    url: string
  }
}

export interface EarthquakeCollection {
  type: 'FeatureCollection'
  metadata: { count: number; generated: number; title: string }
  features: EarthquakeFeature[]
}

export interface CountResult {
  count: number
  maxAllowed: number
}

export interface TooManyError {
  error: 'too_many_events'
  count: number
}

// In development the Vite proxy rewrites /api → http://localhost:3000.
// In production set VITE_API_BASE_URL to the full backend origin (no trailing slash).
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api'

function toQueryString(filters: EarthquakeFilters): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) params.set(key, String(value))
  }
  return params.toString()
}

export async function fetchEarthquakes(filters: EarthquakeFilters): Promise<EarthquakeCollection> {
  const res = await fetch(`${API_BASE}/earthquakes?${toQueryString(filters)}`)
  if (res.status === 422) {
    const body = (await res.json()) as TooManyError
    throw Object.assign(new Error('too_many_events'), body)
  }
  if (!res.ok) throw new Error('Could not load earthquake data. Please try again.')
  return res.json() as Promise<EarthquakeCollection>
}

export async function fetchCount(filters: EarthquakeFilters): Promise<CountResult> {
  const res = await fetch(`${API_BASE}/earthquakes/count?${toQueryString(filters)}`)
  if (!res.ok) throw new Error('Could not load earthquake data. Please try again.')
  return res.json() as Promise<CountResult>
}
