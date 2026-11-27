import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../api/earthquakes'
import { clearEarthquakeCache, useEarthquakes } from './useEarthquakes'

vi.mock('../api/earthquakes', () => ({
  fetchEarthquakes: vi.fn(),
}))

const mockFetch = vi.mocked(api.fetchEarthquakes)

const BOUNDS = { minLatitude: -10, maxLatitude: 10, minLongitude: -20, maxLongitude: 20 }
const FILTERS = { starttime: '2024-01-01', endtime: '2024-01-07', minmagnitude: 2.5 }
const COLLECTION = {
  type: 'FeatureCollection' as const,
  metadata: { count: 2, generated: 0, title: '' },
  features: [],
}

beforeEach(() => {
  vi.useFakeTimers()
  mockFetch.mockResolvedValue(COLLECTION)
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  clearEarthquakeCache()
})

async function tick() {
  await act(() => vi.runAllTimersAsync())
}

describe('useEarthquakes', () => {
  it('starts with null data, not loading, no error', () => {
    const { result } = renderHook(() => useEarthquakes(BOUNDS, FILTERS))
    expect(result.current).toMatchObject({
      data: null,
      loading: false,
      error: null,
      tooMany: false,
    })
  })

  it('does not fetch when bounds is null', async () => {
    renderHook(() => useEarthquakes(null, FILTERS))
    await tick()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('fetches after the 500ms debounce fires', async () => {
    const { result } = renderHook(() => useEarthquakes(BOUNDS, FILTERS))
    await act(() => vi.advanceTimersByTimeAsync(499))
    expect(mockFetch).not.toHaveBeenCalled()
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(result.current.data).toEqual(COLLECTION)
  })

  it('passes bounds as lat/lon params', async () => {
    renderHook(() => useEarthquakes(BOUNDS, FILTERS))
    await tick()
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        minlatitude: BOUNDS.minLatitude,
        maxlatitude: BOUNDS.maxLatitude,
        minlongitude: BOUNDS.minLongitude,
        maxlongitude: BOUNDS.maxLongitude,
      }),
    )
  })

  it('passes filter values alongside the bounds', async () => {
    renderHook(() => useEarthquakes(BOUNDS, FILTERS))
    await tick()
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        starttime: '2024-01-01',
        endtime: '2024-01-07',
        minmagnitude: 2.5,
      }),
    )
  })

  it('debounces: fires only once when bounds change rapidly', async () => {
    const { rerender } = renderHook(({ b }) => useEarthquakes(b, FILTERS), {
      initialProps: { b: BOUNDS },
    })
    rerender({ b: { ...BOUNDS, minLongitude: -50 } })
    rerender({ b: { ...BOUNDS, minLongitude: -100 } })
    await tick()
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('sets tooMany=true and tooManyCount on a 422 too_many_events error', async () => {
    const err = Object.assign(new Error('too_many_events'), {
      error: 'too_many_events',
      count: 30000,
    })
    mockFetch.mockRejectedValue(err)
    const { result } = renderHook(() => useEarthquakes(BOUNDS, FILTERS))
    await tick()
    expect(result.current.tooMany).toBe(true)
    expect(result.current.tooManyCount).toBe(30000)
    expect(result.current.error).toBeNull()
  })

  it('sets error on a generic fetch failure', async () => {
    mockFetch.mockRejectedValue(new Error('Could not load earthquake data. Please try again.'))
    const { result } = renderHook(() => useEarthquakes(BOUNDS, FILTERS))
    await tick()
    expect(result.current.error).toBe('Could not load earthquake data. Please try again.')
    expect(result.current.tooMany).toBe(false)
  })

  it('clears tooMany when a subsequent fetch succeeds', async () => {
    const err = Object.assign(new Error('too_many_events'), {
      error: 'too_many_events',
      count: 30000,
    })
    mockFetch.mockRejectedValueOnce(err).mockResolvedValueOnce(COLLECTION)
    const { result, rerender } = renderHook(({ b }) => useEarthquakes(b, FILTERS), {
      initialProps: { b: BOUNDS },
    })
    await tick()
    expect(result.current.tooMany).toBe(true)
    rerender({ b: { ...BOUNDS, minLongitude: -50 } })
    await tick()
    expect(result.current.tooMany).toBe(false)
    expect(result.current.data).toEqual(COLLECTION)
  })
})
