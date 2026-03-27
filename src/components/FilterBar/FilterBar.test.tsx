import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { FilterBar } from './FilterBar'
import { LogEvent, FacetFilter, EMPTY_FILTER } from '../../types/LogEvent'

function makeEvent (level: string): LogEvent {
  return { _time: 1000, level, message: 'test' }
}

const events: LogEvent[] = [
  makeEvent('error'),
  makeEvent('error'),
  makeEvent('info'),
  makeEvent('info'),
  makeEvent('info'),
  makeEvent('warn')
]

const defaultProps = {
  events,
  filter: EMPTY_FILTER,
  onFilterChange: jest.fn()
}

beforeEach(() => {
  defaultProps.onFilterChange.mockClear()
})

describe('FilterBar', () => {
  it('renders a pill for each level with correct counts', () => {
    render(<FilterBar {...defaultProps} />)
    expect(screen.getByText('error')).toBeInTheDocument()
    expect(screen.getByText('info')).toBeInTheDocument()
    expect(screen.getByText('warn')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // error count
    expect(screen.getByText('3')).toBeInTheDocument() // info count
    expect(screen.getByText('1')).toBeInTheDocument() // warn count
  })

  it('orders pills: error, warn, info, then others', () => {
    const mixedEvents = [
      makeEvent('debug'),
      makeEvent('error'),
      makeEvent('info'),
      makeEvent('warn')
    ]
    render(<FilterBar {...defaultProps} events={mixedEvents} />)
    const buttons = screen.getAllByRole('button')
    // First 4 buttons are the level pills (last may be "Clear filters")
    expect(buttons[0]).toHaveTextContent('error')
    expect(buttons[1]).toHaveTextContent('warn')
    expect(buttons[2]).toHaveTextContent('info')
    expect(buttons[3]).toHaveTextContent('debug')
  })

  it('calls onFilterChange with level added when pill is clicked', () => {
    render(<FilterBar {...defaultProps} />)
    fireEvent.click(screen.getByText('error'))
    expect(defaultProps.onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({
        levels: new Set(['error'])
      })
    )
  })

  it('calls onFilterChange with level removed when active pill is clicked', () => {
    const filter: FacetFilter = { levels: new Set(['error', 'info']) }
    render(<FilterBar {...defaultProps} filter={filter} />)
    fireEvent.click(screen.getByText('error'))
    const call = defaultProps.onFilterChange.mock.calls[0][0]
    expect(call.levels.has('error')).toBe(false)
    expect(call.levels.has('info')).toBe(true)
  })

  it('sets aria-pressed on active pills', () => {
    const filter: FacetFilter = { levels: new Set(['error']) }
    render(<FilterBar {...defaultProps} filter={filter} />)
    expect(screen.getByLabelText(/Filter by error/)).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText(/Filter by info/)).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows Clear filters button only when filters are active', () => {
    const { rerender } = render(<FilterBar {...defaultProps} />)
    expect(screen.queryByText('Clear filters')).not.toBeInTheDocument()

    rerender(
      <FilterBar {...defaultProps} filter={{ levels: new Set(['error']) }} />
    )
    expect(screen.getByText('Clear filters')).toBeInTheDocument()
  })

  it('clears all filters when Clear filters is clicked', () => {
    const filter: FacetFilter = { levels: new Set(['error', 'warn']) }
    render(<FilterBar {...defaultProps} filter={filter} />)
    fireEvent.click(screen.getByText('Clear filters'))
    const call = defaultProps.onFilterChange.mock.calls[0][0]
    expect(call.levels.size).toBe(0)
  })

  it('renders nothing for empty events', () => {
    const { container } = render(<FilterBar {...defaultProps} events={[]} />)
    const pills = container.querySelectorAll('button')
    expect(pills.length).toBe(0)
  })

  it('has toolbar role for accessibility', () => {
    render(<FilterBar {...defaultProps} />)
    expect(screen.getByRole('toolbar')).toBeInTheDocument()
  })
})
