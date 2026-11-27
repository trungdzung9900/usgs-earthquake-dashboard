import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MapViewHandle } from './MapView'
import SearchBar from './SearchBar'

vi.mock('../hooks/useGeocoder', () => ({ geocode: vi.fn() }))

import { geocode } from '../hooks/useGeocoder'
const mockGeocode = vi.mocked(geocode)

afterEach(() => vi.clearAllMocks())

function setup() {
  const flyTo = vi.fn()
  // createRef makes `current` non-configurable; use a plain mutable object instead
  const mapRef = { current: { flyTo } } as React.RefObject<MapViewHandle | null>
  render(<SearchBar mapRef={mapRef} />)
  return { flyTo }
}

describe('SearchBar', () => {
  it('renders the text input and Go button', () => {
    setup()
    expect(screen.getByPlaceholderText('Search place…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument()
  })

  it('does not call geocode when the input is empty', async () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(mockGeocode).not.toHaveBeenCalled()
  })

  it('calls geocode with the trimmed input value on submit', async () => {
    mockGeocode.mockResolvedValue({ lat: 35.6895, lon: 139.6917, displayName: 'Tokyo' })
    setup()
    fireEvent.change(screen.getByPlaceholderText('Search place…'), {
      target: { value: '  Tokyo  ' },
    })
    fireEvent.submit(screen.getByRole('button').closest('form')!)
    await waitFor(() => expect(mockGeocode).toHaveBeenCalledWith('Tokyo'))
  })

  it('calls mapRef.flyTo with the result coordinates on a successful geocode', async () => {
    mockGeocode.mockResolvedValue({ lat: 35.6895, lon: 139.6917, displayName: 'Tokyo' })
    const { flyTo } = setup()
    fireEvent.change(screen.getByPlaceholderText('Search place…'), { target: { value: 'Tokyo' } })
    fireEvent.submit(screen.getByRole('button').closest('form')!)
    await waitFor(() => expect(flyTo).toHaveBeenCalledWith(35.6895, 139.6917, 8))
  })

  it('shows "Not found" when geocode returns null', async () => {
    mockGeocode.mockResolvedValue(null)
    setup()
    fireEvent.change(screen.getByPlaceholderText('Search place…'), { target: { value: 'xyzzy' } })
    fireEvent.submit(screen.getByRole('button').closest('form')!)
    await waitFor(() => expect(screen.getByText('Not found')).toBeInTheDocument())
  })

  it('disables the button while geocoding is in progress', async () => {
    let resolve!: (v: null) => void
    mockGeocode.mockReturnValue(
      new Promise((r) => {
        resolve = r
      }),
    )
    setup()
    fireEvent.change(screen.getByPlaceholderText('Search place…'), { target: { value: 'Tokyo' } })
    fireEvent.submit(screen.getByRole('button').closest('form')!)
    expect(screen.getByRole('button')).toBeDisabled()
    await act(async () => {
      resolve(null)
    })
  })

  it('clears "Not found" when the user starts typing again', async () => {
    mockGeocode.mockResolvedValue(null)
    setup()
    fireEvent.change(screen.getByPlaceholderText('Search place…'), { target: { value: 'xyz' } })
    fireEvent.submit(screen.getByRole('button').closest('form')!)
    await waitFor(() => screen.getByText('Not found'))
    fireEvent.change(screen.getByPlaceholderText('Search place…'), { target: { value: 'x' } })
    expect(screen.queryByText('Not found')).not.toBeInTheDocument()
  })
})
