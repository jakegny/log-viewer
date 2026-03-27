import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ErrorBanner } from './ErrorBanner'

describe('ErrorBanner', () => {
  const mockRetry = jest.fn()
  const testError = new Error('HTTP 500 Internal Server Error')

  beforeEach(() => {
    mockRetry.mockClear()
  })

  it('displays the error message', () => {
    render(<ErrorBanner error={testError} onRetry={mockRetry} />)
    expect(screen.getByText('HTTP 500 Internal Server Error')).toBeInTheDocument()
  })

  it('calls onRetry when retry button is clicked', () => {
    render(<ErrorBanner error={testError} onRetry={mockRetry} />)
    fireEvent.click(screen.getByText('Retry'))
    expect(mockRetry).toHaveBeenCalledTimes(1)
  })

  it('dismisses when dismiss button is clicked', () => {
    render(<ErrorBanner error={testError} onRetry={mockRetry} />)
    fireEvent.click(screen.getByLabelText('Dismiss error'))
    expect(screen.queryByText('HTTP 500 Internal Server Error')).not.toBeInTheDocument()
  })

  it('has alert role for accessibility', () => {
    render(<ErrorBanner error={testError} onRetry={mockRetry} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('resets dismissed state when error prop changes', () => {
    const { rerender } = render(<ErrorBanner error={testError} onRetry={mockRetry} />)

    // Dismiss the banner
    fireEvent.click(screen.getByLabelText('Dismiss error'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    // Rerender with a new error — banner should reappear
    const newError = new Error('HTTP 503 Service Unavailable')
    rerender(<ErrorBanner error={newError} onRetry={mockRetry} />)
    expect(screen.getByText('HTTP 503 Service Unavailable')).toBeInTheDocument()
  })
})
