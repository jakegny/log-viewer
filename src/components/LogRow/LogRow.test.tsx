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

describe('LogRow', () => {
  it('renders formatted ISO 8601 time in UTC mode', () => {
    render(<LogRow event={mockEvent} timeFormat="utc" index={0} />)
    expect(screen.getByText('2024-08-22T10:46:52.592Z')).toBeInTheDocument()
  })

  it('renders single-line JSON when collapsed', () => {
    render(<LogRow event={mockEvent} timeFormat="utc" index={0} />)
    const json = JSON.stringify(mockEvent)
    expect(screen.getByText(json)).toBeInTheDocument()
  })

  it('expands to show multiline JSON on click', () => {
    render(<LogRow event={mockEvent} timeFormat="utc" index={0} />)

    const row = screen.getByRole('row')
    fireEvent.click(row)

    // Multiline JSON renders in a <pre> tag — use container query
    const pre = document.querySelector('pre')
    expect(pre).toBeInTheDocument()
    expect(pre?.textContent).toBe(JSON.stringify(mockEvent, null, 2))
  })

  it('collapses again on second click', () => {
    render(<LogRow event={mockEvent} timeFormat="utc" index={0} />)

    const row = screen.getByRole('row')
    fireEvent.click(row)
    fireEvent.click(row)

    const pre = document.querySelector('pre')
    expect(pre).not.toBeInTheDocument()
  })

  it('toggles aria-expanded attribute', () => {
    render(<LogRow event={mockEvent} timeFormat="utc" index={0} />)

    const row = screen.getByRole('row')
    expect(row).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(row)
    expect(row).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(row)
    expect(row).toHaveAttribute('aria-expanded', 'false')
  })

  it('expands on Enter key', () => {
    render(<LogRow event={mockEvent} timeFormat="utc" index={0} />)

    const row = screen.getByRole('row')
    fireEvent.keyDown(row, { key: 'Enter' })

    expect(row).toHaveAttribute('aria-expanded', 'true')
  })

  it('expands on Space key', () => {
    render(<LogRow event={mockEvent} timeFormat="utc" index={0} />)

    const row = screen.getByRole('row')
    fireEvent.keyDown(row, { key: ' ' })

    expect(row).toHaveAttribute('aria-expanded', 'true')
  })

  it('applies even row styling for even indices', () => {
    const { container } = render(<LogRow event={mockEvent} timeFormat="utc" index={2} />)
    const row = container.firstChild as HTMLElement
    expect(row.className).toMatch(/even/i)
  })

  it('applies error level styling for error events', () => {
    const { container } = render(<LogRow event={errorEvent} timeFormat="utc" index={0} />)
    const row = container.firstChild as HTMLElement
    expect(row.className).toMatch(/error/i)
  })

  it('applies info level styling for info events', () => {
    const { container } = render(<LogRow event={mockEvent} timeFormat="utc" index={0} />)
    const row = container.firstChild as HTMLElement
    expect(row.className).toMatch(/info/i)
  })

  it('renders time in local format when timeFormat is local', () => {
    render(<LogRow event={mockEvent} timeFormat="local" index={0} />)
    // Should not contain the UTC 'Z' suffix
    const timeCell = screen.getByText(/2024/)
    expect(timeCell.textContent).not.toMatch(/Z$/)
  })
})
