import { useEffect, useRef, useState } from 'react'
import type { EarthquakeCollection, EarthquakeFeature, EarthquakeFilters } from '../api/earthquakes'
import { fetchEarthquakes } from '../api/earthquakes'

interface Bounds {
  minLatitude: number
  maxLatitude: number
  minLongitude: number
  maxLongitude: number
}

interface UseEarthquakesResult {
  data: EarthquakeCollection | null
  loading: boolean
  error: string | null
  tooMany: boolean
  tooManyCount: number | null
}

// ─── Superset containment cache ──────────────────────────────────────────────
// If the new viewport is fully contained within a previously fetched bbox and
// the non-spatial filters are identical, we filter the cached features
// client-side and skip the network round-trip entirely.

const CACHE_TTL_MS = 3 * 60 * 1000 // 3 minutes — matches USGS near-realtime update cadence
const MAX_CACHE_ENTRIES = 10
const MAX_TOTAL_FEATURES = 50_000 // ~20 MB of feature JSON across all entries

interface BboxBounds {
  minLat: number
  maxLat: number
  minLon: number
  maxLon: number
}

interface CacheEntry {
  bbox: BboxBounds | null // null = global query (no spatial bounds sent)
  starttime: string
  endtime: string
  minmagnitude: number
  maxmagnitude: number | undefined
  data: EarthquakeCollection
  fetchedAt: number
}

// Module-level so the cache survives component re-renders; newest entry first
const _cache: CacheEntry[] = []

/** Wipe all cache entries. Exported for use in tests only. */
export function clearEarthquakeCache(): void {
  _cache.length = 0
}

function totalCachedFeatures(): number {
  return _cache.reduce((sum, e) => sum + e.data.features.length, 0)
}

// Returns true when outer bbox fully encloses inner bbox.
// A null outer means "global" and contains any inner.
// A null inner means "global" and cannot be inside a finite outer.
function bboxContains(outer: BboxBounds | null, inner: BboxBounds | null): boolean {
  if (outer === null) return true
  if (inner === null) return false
  return (
    outer.minLat <= inner.minLat &&
    outer.maxLat >= inner.maxLat &&
    outer.minLon <= inner.minLon &&
    outer.maxLon >= inner.maxLon
  )
}

function filterToBbox(features: EarthquakeFeature[], bbox: BboxBounds | null): EarthquakeFeature[] {
  if (bbox === null) return features
  return features.filter((f) => {
    const [lon, lat] = f.geometry.coordinates
    return lat >= bbox.minLat && lat <= bbox.maxLat && lon >= bbox.minLon && lon <= bbox.maxLon
  })
}

function findCacheHit(
  bbox: BboxBounds | null,
  starttime: string,
  endtime: string,
  minmagnitude: number,
  maxmagnitude: number | undefined,
): CacheEntry | null {
  const now = Date.now()
  return (
    _cache.find(
      (e) =>
        now - e.fetchedAt < CACHE_TTL_MS &&
        e.starttime === starttime &&
        e.endtime === endtime &&
        e.minmagnitude === minmagnitude &&
        e.maxmagnitude === maxmagnitude &&
        bboxContains(e.bbox, bbox),
    ) ?? null
  )
}

function addToCache(entry: CacheEntry): void {
  // Never cache near-limit results — they may be incomplete and are too large to be useful
  if (entry.data.features.length >= 20_000) return

  // Evict oldest entries until we're within memory and count limits
  while (
    _cache.length >= MAX_CACHE_ENTRIES ||
    totalCachedFeatures() + entry.data.features.length > MAX_TOTAL_FEATURES
  ) {
    if (_cache.length === 0) return
    _cache.pop()
  }

  _cache.unshift(entry)
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useEarthquakes(
  bounds: Bounds | null,
  filters: Omit<EarthquakeFilters, 'minlatitude' | 'maxlatitude' | 'minlongitude' | 'maxlongitude'>,
): UseEarthquakesResult {
  const [data, setData] = useState<EarthquakeCollection | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tooMany, setTooMany] = useState(false)
  const [tooManyCount, setTooManyCount] = useState<number | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!bounds) return

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort()
      abortRef.current = new AbortController()

      const currentBbox: BboxBounds = {
        minLat: bounds.minLatitude,
        maxLat: bounds.maxLatitude,
        minLon: bounds.minLongitude,
        maxLon: bounds.maxLongitude,
      }

      const minmag = filters.minmagnitude ?? 0

      // ── Cache hit path ──────────────────────────────────────────────────
      const hit = findCacheHit(
        currentBbox,
        filters.starttime,
        filters.endtime,
        minmag,
        filters.maxmagnitude,
      )
      if (hit) {
        const features = filterToBbox(hit.data.features, currentBbox)
        setData({
          ...hit.data,
          features,
          metadata: { ...hit.data.metadata, count: features.length },
        })
        setLoading(false)
        setError(null)
        setTooMany(false)
        setTooManyCount(null)
        return
      }

      // ── Network fetch path ──────────────────────────────────────────────
      setLoading(true)
      setError(null)
      setTooMany(false)
      setTooManyCount(null)

      try {
        const params: EarthquakeFilters = {
          ...filters,
          minlatitude: bounds.minLatitude,
          maxlatitude: bounds.maxLatitude,
          minlongitude: bounds.minLongitude,
          maxlongitude: bounds.maxLongitude,
        }
        const result = await fetchEarthquakes(params)
        addToCache({
          bbox: currentBbox,
          starttime: filters.starttime,
          endtime: filters.endtime,
          minmagnitude: minmag,
          maxmagnitude: filters.maxmagnitude,
          data: result,
          fetchedAt: Date.now(),
        })
        setData(result)
      } catch (err: unknown) {
        if (err instanceof Error && err.message === 'too_many_events') {
          const e = err as Error & { count?: number }
          setTooMany(true)
          setTooManyCount(e.count ?? null)
        } else if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message)
        }
      } finally {
        setLoading(false)
      }
    }, 500)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [
    bounds?.minLatitude,
    bounds?.maxLatitude,
    bounds?.minLongitude,
    bounds?.maxLongitude,
    filters.starttime,
    filters.endtime,
    filters.minmagnitude,
    filters.maxmagnitude,
  ])

  return { data, loading, error, tooMany, tooManyCount }
}
