import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Timeline, TimeRange } from './Timeline'
import { LogEvent } from '../../types/LogEvent'

function makeEvent (time: number, level = 'info'): LogEvent {
  return { _time: time, level, message: 'test' }
}

const defaultProps = {
  events: [] as LogEvent[],
  selectedRange: null as TimeRange | null,
  onRangeChange: jest.fn()
}

beforeEach(() => {
  defaultProps.onRangeChange.mockClear()
})

describe('Timeline', () => {
  it('shows placeholder when no events', () => {
    render(<Timeline {...defaultProps} />)
    expect(screen.getByText(/timeline will appear/i)).toBeInTheDocument()
  })

  it('renders SVG rect elements for events', () => {
    const events = [makeEvent(1000), makeEvent(2000), makeEvent(3000)]
    const { container } = render(
      <Timeline {...defaultProps} events={events} />
    )
    const rects = container.querySelectorAll('rect')
    expect(rects.length).toBeGreaterThan(0)
  })

  it('handles single event (all same timestamp)', () => {
    const events = [makeEvent(1000)]
    const { container } = render(
      <Timeline {...defaultProps} events={events} />
    )
    // 1 bucket → at least 1 rect with a fill color
    const rects = container.querySelectorAll('rect[fill]')
    expect(rects.length).toBeGreaterThanOrEqual(1)
  })

  it('handles all events at the same timestamp', () => {
    const events = [makeEvent(1000), makeEvent(1000), makeEvent(1000)]
    const { container } = render(
      <Timeline {...defaultProps} events={events} />
    )
    const rects = container.querySelectorAll('rect[fill]')
    expect(rects.length).toBeGreaterThanOrEqual(1)
  })

  it('renders time labels on x-axis', () => {
    const events = Array.from({ length: 20 }, (_, i) =>
      makeEvent(1724323612592 + i * 60000)
    )
    const { container } = render(
      <Timeline {...defaultProps} events={events} />
    )
    const labels = container.querySelectorAll('text')
    expect(labels.length).toBeGreaterThan(0)
  })

  it('renders bars with heights proportional to event counts', () => {
    // 5 events clustered early, 1 event late
    const events = [
      makeEvent(1000),
      makeEvent(1001),
      makeEvent(1002),
      makeEvent(1003),
      makeEvent(1004),
      makeEvent(9000)
    ]
    const { container } = render(
      <Timeline {...defaultProps} events={events} />
    )
    const rects = container.querySelectorAll('rect[fill]')
    const heights = Array.from(rects).map(b =>
      parseFloat(b.getAttribute('height') ?? '0')
    ).filter(h => h > 0)
    const maxHeight = Math.max(...heights)
    const minHeight = Math.min(...heights)
    expect(maxHeight).toBeGreaterThan(minHeight)
  })

  it('renders different colors for different log levels', () => {
    const events = [
      makeEvent(1000, 'error'),
      makeEvent(1001, 'info'),
      makeEvent(1002, 'warn')
    ]
    const { container } = render(
      <Timeline {...defaultProps} events={events} />
    )
    const fills = new Set(
      Array.from(container.querySelectorAll('rect[fill]'))
        .map(r => r.getAttribute('fill'))
    )
    // Should have at least 2 distinct colors (error and info/warn may be in same bucket)
    expect(fills.size).toBeGreaterThanOrEqual(2)
  })

  it('shows error segments in error color (#ff6b6b)', () => {
    const events = [makeEvent(1000, 'error'), makeEvent(5000, 'info')]
    const { container } = render(
      <Timeline {...defaultProps} events={events} />
    )
    const errorRects = container.querySelectorAll('rect[fill="#ff6b6b"]')
    expect(errorRects.length).toBeGreaterThan(0)
  })

  it('shows range inputs', () => {
    const events = [makeEvent(1000), makeEvent(3000), makeEvent(5000)]
    render(
      <Timeline {...defaultProps} events={events} />
    )
    expect(screen.getByLabelText('Range start time')).toBeInTheDocument()
    expect(screen.getByLabelText('Range end time')).toBeInTheDocument()
  })

  it('shows Reset button only when range is selected', () => {
    const events = [makeEvent(1000), makeEvent(3000), makeEvent(5000)]
    const { rerender } = render(
      <Timeline {...defaultProps} events={events} />
    )
    expect(screen.queryByText('Reset')).not.toBeInTheDocument()

    rerender(
      <Timeline {...defaultProps} events={events} selectedRange={{ start: 1000, end: 3000 }} />
    )
    expect(screen.getByText('Reset')).toBeInTheDocument()
  })

  it('calls onRangeChange(null) when Reset is clicked', () => {
    const range = { start: 1000, end: 5000 }
    const events = [makeEvent(1000), makeEvent(3000), makeEvent(5000)]
    render(
      <Timeline {...defaultProps} events={events} selectedRange={range} />
    )
    fireEvent.click(screen.getByText('Reset'))
    expect(defaultProps.onRangeChange).toHaveBeenCalledWith(null)
  })

  it('re-buckets to show only events within the selected range', () => {
    // 3 events spread across time; selecting middle range should show fewer filled bars
    const events = [makeEvent(1000), makeEvent(5000, 'error'), makeEvent(9000)]
    const range = { start: 4000, end: 6000 }
    const { container } = render(
      <Timeline {...defaultProps} events={events} selectedRange={range} />
    )
    // Only 1 event is in range → should have exactly 1 colored rect (the error bar)
    const coloredRects = container.querySelectorAll('rect[fill="#ff6b6b"]')
    expect(coloredRects.length).toBe(1)
  })

  it('does not render brush overlay when range is set (histogram zooms instead)', () => {
    const events = [makeEvent(1000), makeEvent(5000), makeEvent(9000)]
    const range = { start: 2000, end: 7000 }
    const { container } = render(
      <Timeline {...defaultProps} events={events} selectedRange={range} />
    )
    const overlays = container.querySelectorAll('[class*="brushOverlay"]')
    expect(overlays.length).toBe(0)
  })

  it('has accessible aria-label on the SVG', () => {
    const events = [makeEvent(1000), makeEvent(2000)]
    render(<Timeline {...defaultProps} events={events} />)
    const svg = screen.getByRole('img')
    expect(svg).toHaveAttribute('aria-label', expect.stringContaining('2 events'))
  })
})
