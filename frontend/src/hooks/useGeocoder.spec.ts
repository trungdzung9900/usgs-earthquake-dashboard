import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { geocode } from './useGeocoder'

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

function nominatim(results: Array<{ lat: string; lon: string; display_name: string }>) {
  return { ok: true, status: 200, json: async () => results } as Response
}

describe('geocode', () => {
  it('returns parsed lat/lon and displayName on a successful match', async () => {
    mockFetch.mockResolvedValue(
      nominatim([{ lat: '35.6895', lon: '139.6917', display_name: 'Tokyo, Japan' }]),
    )
    expect(await geocode('Tokyo')).toEqual({
      lat: 35.6895,
      lon: 139.6917,
      displayName: 'Tokyo, Japan',
    })
  })

  it('sends the User-Agent header required by Nominatim', async () => {
    mockFetch.mockResolvedValue(nominatim([{ lat: '0', lon: '0', display_name: 'x' }]))
    await geocode('x')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': expect.stringContaining('usgs-earthquake-dashboard'),
        }),
      }),
    )
  })

  it('includes the place name in the query string', async () => {
    mockFetch.mockResolvedValue(nominatim([{ lat: '0', lon: '0', display_name: 'x' }]))
    await geocode('New York')
    // URLSearchParams encodes spaces as '+'; use get() which decodes them back
    const url = new URL(mockFetch.mock.calls[0][0] as string)
    expect(url.searchParams.get('q')).toBe('New York')
  })

  it('requests only one result via limit=1', async () => {
    mockFetch.mockResolvedValue(nominatim([{ lat: '0', lon: '0', display_name: 'x' }]))
    await geocode('x')
    expect(mockFetch.mock.calls[0][0]).toContain('limit=1')
  })

  it('returns null when Nominatim returns no results', async () => {
    mockFetch.mockResolvedValue(nominatim([]))
    expect(await geocode('xyzzy-nonexistent')).toBeNull()
  })

  it('returns null on a non-ok HTTP response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503 } as Response)
    expect(await geocode('Tokyo')).toBeNull()
  })
})
