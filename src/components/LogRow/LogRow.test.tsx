import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LogRow } from './LogRow'
import { LogEvent } from '../../types/LogEvent'

const mockEvent: LogEvent = {
  _time: 1724323612592,
  level: 'info',
  channel: 'server',
  message: 'Application started'
}

const errorEvent: LogEvent = {
  _time: 1724323612593,
  level: 'error',
  channel: 'server',
  message: 'Connection failed',
  error: { code: 'ECONNREFUSED' }
}

const defaultProps = {
  event: mockEvent,
  timeFormat: 'utc' as const,
  index: 0,
  expanded: false,
  onToggle: jest.fn()
}

beforeEach(() => {
  defaultProps.onToggle.mockClear()
})

describe('LogRow', () => {
  it('renders formatted ISO 8601 time in UTC mode', () => {
    render(<LogRow {...defaultProps} />)
    expect(screen.getByText('2024-08-22T10:46:52.592Z')).toBeInTheDocument()
  })

  it('renders single-line JSON when collapsed', () => {
    render(<LogRow {...defaultProps} />)
    const json = JSON.stringify(mockEvent)
    expect(screen.getByText(json)).toBeInTheDocument()
  })

  it('shows multiline JSON when expanded', () => {
    render(<LogRow {...defaultProps} expanded={true} />)
    const pre = document.querySelector('pre')
    expect(pre).toBeInTheDocument()
    expect(pre?.textContent).toBe(JSON.stringify(mockEvent, null, 2))
  })

  it('hides multiline JSON when collapsed', () => {
    render(<LogRow {...defaultProps} expanded={false} />)
    const pre = document.querySelector('pre')
    expect(pre).not.toBeInTheDocument()
  })

  it('calls onToggle with index when clicked', () => {
    render(<LogRow {...defaultProps} index={7} />)
    fireEvent.click(screen.getByRole('row'))
    expect(defaultProps.onToggle).toHaveBeenCalledWith(7)
  })

  it('calls onToggle on Enter key', () => {
    render(<LogRow {...defaultProps} index={3} />)
    fireEvent.keyDown(screen.getByRole('row'), { key: 'Enter' })
    expect(defaultProps.onToggle).toHaveBeenCalledWith(3)
  })

  it('calls onToggle on Space key', () => {
    render(<LogRow {...defaultProps} index={5} />)
    fireEvent.keyDown(screen.getByRole('row'), { key: ' ' })
    expect(defaultProps.onToggle).toHaveBeenCalledWith(5)
  })

  it('sets aria-expanded based on expanded prop', () => {
    const { rerender } = render(<LogRow {...defaultProps} expanded={false} />)
    expect(screen.getByRole('row')).toHaveAttribute('aria-expanded', 'false')

    rerender(<LogRow {...defaultProps} expanded={true} />)
    expect(screen.getByRole('row')).toHaveAttribute('aria-expanded', 'true')
  })

  it('applies even row styling for even indices', () => {
    const { container } = render(<LogRow {...defaultProps} index={2} />)
    const row = container.firstChild as HTMLElement
    expect(row.className).toMatch(/even/i)
  })

  it('applies error level styling for error events', () => {
    const { container } = render(<LogRow {...defaultProps} event={errorEvent} />)
    const row = container.firstChild as HTMLElement
    expect(row.className).toMatch(/error/i)
  })

  it('applies info level styling for info events', () => {
    const { container } = render(<LogRow {...defaultProps} />)
    const row = container.firstChild as HTMLElement
    expect(row.className).toMatch(/info/i)
  })

  it('renders time in local format when timeFormat is local', () => {
    render(<LogRow {...defaultProps} timeFormat="local" />)
    const timeCell = screen.getByText(/2024/)
    expect(timeCell.textContent).not.toMatch(/Z$/)
  })
})
