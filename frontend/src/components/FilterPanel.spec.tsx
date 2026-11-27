import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import FilterPanel from './FilterPanel'

const noop = vi.fn()

function renderPanel(overrides: Partial<Parameters<typeof FilterPanel>[0]> = {}) {
  const props = {
    starttime: '2024-01-01',
    endtime: '2024-01-07',
    minmagnitude: 2.5,
    onStarttimeChange: noop,
    onEndtimeChange: noop,
    onMinmagnitudeChange: noop,
    count: null,
    loading: false,
    tooMany: false,
    tooManyCount: null,
    error: null,
    ...overrides,
  }
  return render(<FilterPanel {...props} />)
}

afterEach(() => vi.clearAllMocks())

describe('FilterPanel', () => {
  describe('inputs', () => {
    it('renders the start date input with the given value', () => {
      renderPanel()
      expect(screen.getByDisplayValue('2024-01-01')).toBeInTheDocument()
    })

    it('renders the end date input with the given value', () => {
      renderPanel()
      expect(screen.getByDisplayValue('2024-01-07')).toBeInTheDocument()
    })

    it('renders the magnitude label showing the current value', () => {
      renderPanel({ minmagnitude: 4.5 })
      expect(screen.getByText(/M4\.5/)).toBeInTheDocument()
    })

    it('calls onStarttimeChange with the new value when start date changes', () => {
      const handler = vi.fn()
      renderPanel({ onStarttimeChange: handler })
      fireEvent.change(screen.getByDisplayValue('2024-01-01'), { target: { value: '2024-02-01' } })
      expect(handler).toHaveBeenCalledWith('2024-02-01')
    })

    it('calls onEndtimeChange with the new value when end date changes', () => {
      const handler = vi.fn()
      renderPanel({ onEndtimeChange: handler })
      fireEvent.change(screen.getByDisplayValue('2024-01-07'), { target: { value: '2024-02-07' } })
      expect(handler).toHaveBeenCalledWith('2024-02-07')
    })

    it('calls onMinmagnitudeChange with a parsed float when the slider changes', () => {
      const handler = vi.fn()
      renderPanel({ onMinmagnitudeChange: handler })
      fireEvent.change(screen.getByRole('slider'), { target: { value: '5' } })
      expect(handler).toHaveBeenCalledWith(5)
    })
  })

  describe('status area', () => {
    it('shows "Loading…" when loading=true', () => {
      renderPanel({ loading: true })
      expect(screen.getByText('Loading…')).toBeInTheDocument()
    })

    it('shows the event count when not loading', () => {
      renderPanel({ count: 42 })
      expect(screen.getByText('42 events')).toBeInTheDocument()
    })

    it('uses singular "event" when count is 1', () => {
      renderPanel({ count: 1 })
      expect(screen.getByText('1 event')).toBeInTheDocument()
    })

    it('shows the too-many-events message with a formatted count', () => {
      renderPanel({ tooMany: true, tooManyCount: 25000 })
      expect(screen.getByText(/Too many events/)).toBeInTheDocument()
      expect(screen.getByText(/25,000/)).toBeInTheDocument()
    })

    it('does not show too-many message while loading', () => {
      renderPanel({ loading: true, tooMany: true, tooManyCount: 25000 })
      expect(screen.queryByText(/Too many events/)).not.toBeInTheDocument()
    })

    it('shows the error message', () => {
      renderPanel({ error: 'Network error' })
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })

    it('does not show count when tooMany is true', () => {
      renderPanel({ tooMany: true, tooManyCount: 25000, count: 0 })
      expect(screen.queryByText(/events$/)).not.toBeInTheDocument()
    })
  })
})
