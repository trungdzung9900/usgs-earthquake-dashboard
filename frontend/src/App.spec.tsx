import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

// Avoid Leaflet and real network calls in App-level tests
vi.mock('./components/MapView', () => ({
  default: vi.fn((_props: unknown, _ref: unknown) => <div data-testid="map-view" />),
}))

vi.mock('./hooks/useEarthquakes', () => ({
  useEarthquakes: vi.fn(() => ({
    data: null,
    loading: false,
    error: null,
    tooMany: false,
    tooManyCount: null,
  })),
}))

vi.mock('./hooks/useGeocoder', () => ({ geocode: vi.fn() }))

describe('App', () => {
  it('renders the app title', () => {
    render(<App />)
    expect(screen.getByText('Earthquake Dashboard')).toBeInTheDocument()
  })

  it('renders the USGS subtitle', () => {
    render(<App />)
    expect(screen.getByText(/USGS/)).toBeInTheDocument()
  })

  it('renders the sidebar with the Filters section', () => {
    render(<App />)
    expect(screen.getByText('Filters')).toBeInTheDocument()
  })

  it('renders the place search input', () => {
    render(<App />)
    expect(screen.getByPlaceholderText('Search place…')).toBeInTheDocument()
  })

  it('renders the MapView', () => {
    render(<App />)
    expect(screen.getByTestId('map-view')).toBeInTheDocument()
  })

  it('renders the depth legend', () => {
    render(<App />)
    expect(screen.getByText(/shallow/i)).toBeInTheDocument()
  })

  describe('sidebar toggle', () => {
    it('sidebar starts open (has sidebar--open class)', () => {
      render(<App />)
      expect(screen.getByRole('complementary')).toHaveClass('sidebar--open')
    })

    it('close button removes sidebar--open class', () => {
      render(<App />)
      fireEvent.click(screen.getByLabelText('Close panel'))
      expect(screen.getByRole('complementary')).not.toHaveClass('sidebar--open')
    })

    it('hamburger button appears after sidebar is closed', () => {
      render(<App />)
      fireEvent.click(screen.getByLabelText('Close panel'))
      expect(screen.getByLabelText('Open panel')).toBeInTheDocument()
    })

    it('hamburger button re-opens sidebar', () => {
      render(<App />)
      fireEvent.click(screen.getByLabelText('Close panel'))
      fireEvent.click(screen.getByLabelText('Open panel'))
      expect(screen.getByRole('complementary')).toHaveClass('sidebar--open')
    })

    it('clicking the backdrop closes the sidebar', () => {
      render(<App />)
      const backdrop = document.querySelector('.sidebar-backdrop') as HTMLElement
      fireEvent.click(backdrop)
      expect(screen.getByRole('complementary')).not.toHaveClass('sidebar--open')
    })
  })
})
