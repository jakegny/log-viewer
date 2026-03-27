import { LogEvent } from '../types/LogEvent'

export interface ParseResult {
  events: LogEvent[]
  remainder: string
  malformedCount: number
}

export function parseChunk (chunk: string, buffer: string): ParseResult {
  const combined = buffer + chunk
  const lines = combined.split('\n')
  const remainder = lines.pop() ?? ''

  const events: LogEvent[] = []
  let malformedCount = 0

  for (const rawLine of lines) {
    // handle CRLF line endings
    const line = rawLine.replace(/\r$/, '').trim()
    if (line === '') continue // skip empty lines

    try {
      const parsed = JSON.parse(line)
      if (typeof parsed._time !== 'number') {
        malformedCount++
      } else {
        events.push(parsed as LogEvent)
      }
    } catch {
      malformedCount++
    }
  }

  return { events, remainder, malformedCount }
}
