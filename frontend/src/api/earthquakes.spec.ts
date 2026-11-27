import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchCount, fetchEarthquakes } from './earthquakes'

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

function response(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as Response
}

const filters = { starttime: '2024-01-01', endtime: '2024-01-07' }
const collection = { type: 'FeatureCollection', features: [] }

describe('fetchEarthquakes', () => {
  it('calls /api/earthquakes with serialised filters', async () => {
    mockFetch.mockResolvedValue(response(collection))
    await fetchEarthquakes(filters)
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/earthquakes?'))
  })

  it('includes each filter as a query param', async () => {
    mockFetch.mockResolvedValue(response(collection))
    await fetchEarthquakes({ ...filters, minmagnitude: 2.5, minlatitude: -10, maxlatitude: 10 })
    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('starttime=2024-01-01')
    expect(url).toContain('minmagnitude=2.5')
    expect(url).toContain('minlatitude=-10')
    expect(url).toContain('maxlatitude=10')
  })

  it('omits undefined optional filters', async () => {
    mockFetch.mockResolvedValue(response(collection))
    await fetchEarthquakes(filters)
    const url = mockFetch.mock.calls[0][0] as string
    expect(url).not.toContain('minmagnitude')
    expect(url).not.toContain('minlatitude')
  })

  it('returns the parsed GeoJSON collection on 200', async () => {
    mockFetch.mockResolvedValue(response(collection))
    expect(await fetchEarthquakes(filters)).toEqual(collection)
  })

  it('throws an error with message "too_many_events" and the count on 422', async () => {
    mockFetch.mockResolvedValue(response({ error: 'too_many_events', count: 25000 }, 422))
    await expect(fetchEarthquakes(filters)).rejects.toMatchObject({
      message: 'too_many_events',
      error: 'too_many_events',
      count: 25000,
    })
  })

  it('throws a generic error message on other non-ok responses', async () => {
    mockFetch.mockResolvedValue(response({}, 500))
    await expect(fetchEarthquakes(filters)).rejects.toThrow('Could not load earthquake data.')
  })
})

describe('fetchCount', () => {
  it('calls /api/earthquakes/count', async () => {
    mockFetch.mockResolvedValue(response({ count: 42, maxAllowed: 20000 }))
    await fetchCount(filters)
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/earthquakes/count?'))
  })

  it('returns count and maxAllowed on 200', async () => {
    mockFetch.mockResolvedValue(response({ count: 42, maxAllowed: 20000 }))
    expect(await fetchCount(filters)).toEqual({ count: 42, maxAllowed: 20000 })
  })

  it('throws on a non-ok response', async () => {
    mockFetch.mockResolvedValue(response({}, 503))
    await expect(fetchCount(filters)).rejects.toThrow()
  })
})
