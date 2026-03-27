import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LogTable } from './LogTable'
import { LogEvent } from '../../types/LogEvent'

// Mock ResizeObserver for VirtualList
beforeAll(() => {
  global.ResizeObserver = class {
    observe () {}
    unobserve () {}
    disconnect () {}
  }
})

const makeEvent = (time: number, level: string): LogEvent => ({
  _time: time,
  level,
  message: `event at ${time}`
})

describe('LogTable', () => {
  it('renders column headers', () => {
    render(<LogTable events={[]} timeFormat="utc" loading={false} />)
    expect(screen.getByText('Time')).toBeInTheDocument()
    expect(screen.getByText('Event')).toBeInTheDocument()
  })

  it('renders "No log events" when events is empty and not loading', () => {
    render(<LogTable events={[]} timeFormat="utc" loading={false} />)
    expect(screen.getByText('No log events to display')).toBeInTheDocument()
  })

  it('does not render empty message when loading', () => {
    render(<LogTable events={[]} timeFormat="utc" loading={true} />)
    expect(screen.queryByText('No log events to display')).not.toBeInTheDocument()
  })

  it('has table role for accessibility', () => {
    render(<LogTable events={[]} timeFormat="utc" loading={false} />)
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('renders VirtualList when events are provided', () => {
    const events = [
      makeEvent(1724323612592, 'info'),
      makeEvent(1724323612593, 'error')
    ]
    render(<LogTable events={events} timeFormat="utc" loading={false} />)
    // VirtualList renders a scrollable container — table should not show empty message
    expect(screen.queryByText('No log events to display')).not.toBeInTheDocument()
  })
})
