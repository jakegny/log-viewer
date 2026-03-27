import { renderHook, waitFor, act } from '@testing-library/react'
import { useLogStream } from './useLogStream'

// Polyfill TextEncoder/TextDecoder for jsdom
import { TextEncoder, TextDecoder } from 'util'
Object.assign(global, { TextEncoder, TextDecoder })

// Polyfill ReadableStream for jsdom
import { ReadableStream as NodeReadableStream } from 'stream/web'
if (typeof global.ReadableStream === 'undefined') {
  Object.assign(global, { ReadableStream: NodeReadableStream })
}

// Suppress the known act() warning for async streaming hooks.
// The useLogStream hook's finally block fires state updates after the
// ReadableStream closes — this is inherent to streaming and cannot be
// wrapped in act() from test code. The behavior is correct in production.
const originalConsoleError = console.error
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : ''
    if (msg.includes('not wrapped in act')) return
    originalConsoleError(...args)
  }
})
afterAll(() => {
  console.error = originalConsoleError
})

// Helper to create a mock ReadableStream from chunks.
// Each chunk is delivered asynchronously so React can wrap state updates in act().
function createMockStream (chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let index = 0

  return new ReadableStream({
    async pull (controller) {
      await new Promise(resolve => setTimeout(resolve, 0))
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]))
        index++
      } else {
        controller.close()
      }
    }
  })
}

// Helper to create a mock fetch response
function mockFetch (chunks: string[], status = 200): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Server Error',
    body: createMockStream(chunks)
  })
}

// Helper to create a mock fetch that fails N times then succeeds
function mockFetchFailThenSucceed (
  failCount: number,
  successChunks: string[],
  errorFactory: () => Error | Response = () => new Error('Network error')
): void {
  let callCount = 0
  global.fetch = jest.fn().mockImplementation(() => {
    callCount++
    if (callCount <= failCount) {
      const err = errorFactory()
      if (err instanceof Error) {
        return Promise.reject(err)
      }
      return Promise.resolve(err)
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: createMockStream(successChunks)
    })
  })
}

afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('useLogStream', () => {
  it('parses complete NDJSON lines and sets events', async () => {
    mockFetch([
      '{"_time":1724323612592,"level":"info","message":"hello"}\n',
      '{"_time":1724323612593,"level":"error","message":"world"}\n'
    ])

    const { result } = renderHook(() => useLogStream('https://example.com/log'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.events).toHaveLength(2)
    expect(result.current.events[0]._time).toBe(1724323612592)
    expect(result.current.events[1]._time).toBe(1724323612593)
    expect(result.current.error).toBeNull()
  })

  it('handles chunk boundaries that split a JSON line', async () => {
    mockFetch([
      '{"_time":1}\n{"_time":2,"mess',
      'age":"split"}\n{"_time":3}\n'
    ])

    const { result } = renderHook(() => useLogStream('https://example.com/log'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.events).toHaveLength(3)
    expect(result.current.events[0]._time).toBe(1)
    expect(result.current.events[1]._time).toBe(2)
    expect(result.current.events[1].message).toBe('split')
    expect(result.current.events[2]._time).toBe(3)
  })

  it('drains the final buffer when stream completes (no trailing newline)', async () => {
    mockFetch([
      '{"_time":1}\n{"_time":2}'
    ])

    const { result } = renderHook(() => useLogStream('https://example.com/log'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.events).toHaveLength(2)
    expect(result.current.events[1]._time).toBe(2)
  })

  it('skips malformed JSON lines and tracks count', async () => {
    mockFetch([
      '{"_time":1}\nnot valid json\n{"_time":2}\n'
    ])

    const { result } = renderHook(() => useLogStream('https://example.com/log'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.events).toHaveLength(2)
    expect(result.current.malformedCount).toBe(1)
  })

  it('sets error immediately on 4xx (no auto-retry)', async () => {
    mockFetch([], 404)

    const { result } = renderHook(() => useLogStream('https://example.com/log'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toContain('404')
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('sets error immediately when response body is null (no auto-retry)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: null
    })

    const { result } = renderHook(() => useLogStream('https://example.com/log'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toContain('body')
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('sets loading to true while streaming', async () => {
    let resolveClose: (() => void) | undefined
    const closePromise = new Promise<void>(resolve => { resolveClose = resolve })

    const encoder = new TextEncoder()
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: new ReadableStream({
        async start (controller) {
          controller.enqueue(encoder.encode('{"_time":1}\n'))
          await closePromise
          controller.close()
        }
      })
    })

    const { result } = renderHook(() => useLogStream('https://example.com/log'))

    await waitFor(() => {
      expect(result.current.events.length).toBeGreaterThan(0)
    })
    expect(result.current.loading).toBe(true)

    await act(async () => { resolveClose?.() })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
  })

  it('handles empty stream', async () => {
    mockFetch([''])

    const { result } = renderHook(() => useLogStream('https://example.com/log'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.events).toHaveLength(0)
    expect(result.current.error).toBeNull()
  })

  describe('auto-retry with exponential backoff', () => {
    it('auto-retries network errors up to 3 times with backoff', async () => {
      jest.useFakeTimers()

      mockFetchFailThenSucceed(2, ['{"_time":1}\n'])

      const { result } = renderHook(() => useLogStream('https://example.com/log'))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1)
      })

      await act(async () => { jest.advanceTimersByTime(1000) })
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2)
      })

      await act(async () => { jest.advanceTimersByTime(2000) })
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(3)
      })

      await waitFor(() => {
        expect(result.current.events).toHaveLength(1)
        expect(result.current.error).toBeNull()
      })
    })

    it('surfaces error after exhausting all auto-retry attempts', async () => {
      jest.useFakeTimers()

      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useLogStream('https://example.com/log'))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1)
      })

      await act(async () => { jest.advanceTimersByTime(1000) })
      await waitFor(() => { expect(global.fetch).toHaveBeenCalledTimes(2) })

      await act(async () => { jest.advanceTimersByTime(2000) })
      await waitFor(() => { expect(global.fetch).toHaveBeenCalledTimes(3) })

      await act(async () => { jest.advanceTimersByTime(4000) })
      await waitFor(() => { expect(global.fetch).toHaveBeenCalledTimes(4) })

      await waitFor(() => {
        expect(result.current.error).toBeInstanceOf(Error)
        expect(result.current.error?.message).toBe('Network error')
      })
    })

    it('auto-retries 5xx errors', async () => {
      jest.useFakeTimers()

      let callCount = 0
      global.fetch = jest.fn().mockImplementation(() => {
        callCount++
        if (callCount <= 1) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            body: createMockStream([])
          })
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          body: createMockStream(['{"_time":1}\n'])
        })
      })

      const { result } = renderHook(() => useLogStream('https://example.com/log'))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1)
      })

      await act(async () => { jest.advanceTimersByTime(1000) })

      await waitFor(() => {
        expect(result.current.events).toHaveLength(1)
        expect(result.current.error).toBeNull()
      })
    })

    it('exposes autoRetryAttempt for UI feedback', async () => {
      jest.useFakeTimers()

      mockFetchFailThenSucceed(1, ['{"_time":1}\n'])

      const { result } = renderHook(() => useLogStream('https://example.com/log'))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1)
      })

      await act(async () => { jest.advanceTimersByTime(1000) })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2)
      })

      await waitFor(() => {
        expect(result.current.autoRetryAttempt).toBe(0)
        expect(result.current.events).toHaveLength(1)
      })
    })
  })

  describe('manual retry', () => {
    it('resets state and re-fetches when retry is called', async () => {
      jest.useFakeTimers()

      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useLogStream('https://example.com/log'))

      // Exhaust all auto-retries
      await waitFor(() => { expect(global.fetch).toHaveBeenCalledTimes(1) })
      await act(async () => { jest.advanceTimersByTime(1000) })
      await waitFor(() => { expect(global.fetch).toHaveBeenCalledTimes(2) })
      await act(async () => { jest.advanceTimersByTime(2000) })
      await waitFor(() => { expect(global.fetch).toHaveBeenCalledTimes(3) })
      await act(async () => { jest.advanceTimersByTime(4000) })
      await waitFor(() => { expect(global.fetch).toHaveBeenCalledTimes(4) })

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      })

      // Now set up success and manually retry
      jest.useRealTimers()
      mockFetch(['{"_time":1}\n'])

      await act(async () => {
        result.current.retry()
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.error).toBeNull()
      })

      expect(result.current.events).toHaveLength(1)
    })
  })
})
