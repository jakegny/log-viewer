import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Header } from './Header'

const defaultProps = {
  url: 'https://example.com/log',
  onUrlChange: jest.fn(),
  onUrlSubmit: jest.fn(),
  loading: false,
  eventCount: 42,
  malformedCount: 0,
  bytesReceived: 1048576,
  timeFormat: 'utc' as const,
  onTimeFormatToggle: jest.fn(),
  autoRetryAttempt: 0
}

beforeEach(() => {
  defaultProps.onUrlChange.mockClear()
  defaultProps.onUrlSubmit.mockClear()
  defaultProps.onTimeFormatToggle.mockClear()
})

describe('Header', () => {
  it('renders the title', () => {
    render(<Header {...defaultProps} />)
    expect(screen.getByText('Log Viewer')).toBeInTheDocument()
  })

  it('displays event count', () => {
    render(<Header {...defaultProps} />)
    expect(screen.getByText('42 events')).toBeInTheDocument()
  })

  it('displays formatted bytes received', () => {
    render(<Header {...defaultProps} />)
    expect(screen.getByText('1.0 MB')).toBeInTheDocument()
  })

  it('shows spinner when loading', () => {
    render(<Header {...defaultProps} loading={true} />)
    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
  })

  it('hides spinner when not loading', () => {
    render(<Header {...defaultProps} loading={false} />)
    expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument()
  })

  it('shows malformed count when > 0', () => {
    render(<Header {...defaultProps} malformedCount={3} />)
    expect(screen.getByText('3 malformed')).toBeInTheDocument()
  })

  it('hides malformed count when 0', () => {
    render(<Header {...defaultProps} malformedCount={0} />)
    expect(screen.queryByText(/malformed/)).not.toBeInTheDocument()
  })

  it('calls onUrlSubmit when Enter is pressed in URL input', () => {
    render(<Header {...defaultProps} />)
    const input = screen.getByLabelText('Log file URL')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(defaultProps.onUrlSubmit).toHaveBeenCalledTimes(1)
  })

  it('does not call onUrlSubmit on other keys', () => {
    render(<Header {...defaultProps} />)
    const input = screen.getByLabelText('Log file URL')
    fireEvent.keyDown(input, { key: 'a' })
    expect(defaultProps.onUrlSubmit).not.toHaveBeenCalled()
  })

  it('toggles time format label between UTC and Local', () => {
    const { rerender } = render(<Header {...defaultProps} timeFormat="utc" />)
    expect(screen.getByText('UTC')).toBeInTheDocument()

    rerender(<Header {...defaultProps} timeFormat="local" />)
    expect(screen.getByText('Local')).toBeInTheDocument()
  })

  it('calls onTimeFormatToggle when toggle button is clicked', () => {
    render(<Header {...defaultProps} />)
    fireEvent.click(screen.getByText('UTC'))
    expect(defaultProps.onTimeFormatToggle).toHaveBeenCalledTimes(1)
  })

  it('shows retry attempt indicator', () => {
    render(<Header {...defaultProps} autoRetryAttempt={2} />)
    expect(screen.getByText('Retry 2/3...')).toBeInTheDocument()
  })
})
