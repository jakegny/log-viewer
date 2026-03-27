import { useState, useEffect, useRef, useCallback } from 'react'
import { LogEvent } from '../types/LogEvent'
import { parseChunk } from '../utils/parseNDJSON'

const MAX_AUTO_RETRIES = 3
const BASE_BACKOFF_MS = 1000

function isRetryable (error: Error): boolean {
  const msg = error.message
  // Retry on network errors and 5xx, not on 4xx (client errors)
  if (msg.startsWith('HTTP 4')) return false
  if (msg.includes('not available for streaming')) return false
  return true
}

function backoffDelay (attempt: number): number {
  return BASE_BACKOFF_MS * Math.pow(2, attempt)
}

export interface UseLogStreamResult {
  events: LogEvent[]
  loading: boolean
  error: Error | null
  bytesReceived: number
  malformedCount: number
  autoRetryAttempt: number
  retry: () => void
}

export function useLogStream (url: string): UseLogStreamResult {
  const [events, setEvents] = useState<LogEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [bytesReceived, setBytesReceived] = useState(0)
  const [malformedCount, setMalformedCount] = useState(0)
  const [retryCount, setRetryCount] = useState(0)
  const [autoRetryAttempt, setAutoRetryAttempt] = useState(0)

  // Buffer for batching events between animation frames
  const eventBufferRef = useRef<LogEvent[]>([])
  const rafIdRef = useRef<number | null>(null)
  const malformedBufferRef = useRef(0)

  const retry = useCallback(() => {
    setEvents([])
    setError(null)
    setBytesReceived(0)
    setMalformedCount(0)
    setAutoRetryAttempt(0)
    eventBufferRef.current = []
    malformedBufferRef.current = 0
    setRetryCount(c => c + 1)
  }, [])

  useEffect(() => {
    const abortController = new AbortController()
    let retryTimeoutId: ReturnType<typeof setTimeout> | null = null

    // Flush buffered events to state on animation frame
    function scheduleFlush () {
      if (rafIdRef.current !== null) return
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null
        if (eventBufferRef.current.length > 0) {
          const batch = eventBufferRef.current
          eventBufferRef.current = []
          setEvents(prev => [...prev, ...batch])
        }
        if (malformedBufferRef.current > 0) {
          const count = malformedBufferRef.current
          malformedBufferRef.current = 0
          setMalformedCount(prev => prev + count)
        }
      })
    }

    async function stream (attempt: number) {
      setLoading(true)
      setError(null)
      setAutoRetryAttempt(attempt)

      try {
        const res = await fetch(url, { signal: abortController.signal })
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText}`)
        }
        if (!res.body) {
          throw new Error('Response body is not available for streaming')
        }

        // Success — reset retry counter
        setAutoRetryAttempt(0)

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            // Drain final buffer — handle last line without trailing newline
            if (buffer.trim()) {
              const finalResult = parseChunk(buffer + '\n', '')
              if (finalResult.events.length > 0) {
                eventBufferRef.current.push(...finalResult.events)
              }
              if (finalResult.malformedCount > 0) {
                malformedBufferRef.current += finalResult.malformedCount
              }
              scheduleFlush()
            }
            break
          }

          if (abortController.signal.aborted) break

          if (value) {
            setBytesReceived(prev => prev + value.byteLength)
          }

          const text = decoder.decode(value, { stream: true })
          const result = parseChunk(text, buffer)
          buffer = result.remainder

          if (result.events.length > 0) {
            eventBufferRef.current.push(...result.events)
            scheduleFlush()
          }
          if (result.malformedCount > 0) {
            malformedBufferRef.current += result.malformedCount
            scheduleFlush()
          }
        }
      } catch (err) {
        if (abortController.signal.aborted) return

        const error = err instanceof Error ? err : new Error(String(err))

        // Auto-retry for retryable errors within attempt limit
        if (isRetryable(error) && attempt < MAX_AUTO_RETRIES) {
          const delay = backoffDelay(attempt)
          retryTimeoutId = setTimeout(() => {
            if (!abortController.signal.aborted) {
              stream(attempt + 1)
            }
          }, delay)
          return
        }

        setError(error)
      } finally {
        if (!abortController.signal.aborted) {
          // Final flush for any remaining buffered events
          if (eventBufferRef.current.length > 0) {
            const batch = eventBufferRef.current
            eventBufferRef.current = []
            setEvents(prev => [...prev, ...batch])
          }
          if (malformedBufferRef.current > 0) {
            const count = malformedBufferRef.current
            malformedBufferRef.current = 0
            setMalformedCount(prev => prev + count)
          }
          setLoading(false)
        }
      }
    }

    stream(0)

    return () => {
      abortController.abort()
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      if (retryTimeoutId !== null) {
        clearTimeout(retryTimeoutId)
      }
    }
  }, [url, retryCount])

  return { events, loading, error, bytesReceived, malformedCount, autoRetryAttempt, retry }
}
