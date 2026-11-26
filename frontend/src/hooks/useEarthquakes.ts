import { useEffect, useRef, useState } from 'react'
import type { EarthquakeCollection, EarthquakeFilters } from '../api/earthquakes'
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
