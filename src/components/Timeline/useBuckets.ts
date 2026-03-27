import { useMemo } from 'react'
import { LogEvent } from '../../types/LogEvent'
import { TimeRange, TimeExtent, LevelCounts, Bucket } from './types'

const MAX_BUCKETS = 50

function classifyLevel (level?: string): keyof LevelCounts {
  switch (level) {
    case 'error': return 'error'
    case 'warn': return 'warn'
    case 'info': return 'info'
    default: return 'other'
  }
}

/**
 * Computes the full time extent of all events (loop-based min/max
 * to avoid stack overflow with 50K+ events).
 */
export function useTimeExtent (events: readonly LogEvent[]): TimeExtent | null {
  return useMemo(() => {
    if (events.length === 0) return null
    let minTime = events[0]._time
    let maxTime = events[0]._time
    for (let i = 1; i < events.length; i++) {
      const t = events[i]._time
      if (t < minTime) minTime = t
      if (t > maxTime) maxTime = t
    }
    return { minTime, maxTime }
  }, [events])
}

/**
 * Buckets visible events into up to MAX_BUCKETS intervals with
 * per-level counts. Uses Uint32Array for efficient counting.
 */
export function useBuckets (
  events: readonly LogEvent[],
  selectedRange: TimeRange | null,
  fullExtent: TimeExtent | null
) {
  const timeExtent = useMemo((): TimeExtent | null => {
    if (!fullExtent) return null
    if (selectedRange) {
      return { minTime: selectedRange.start, maxTime: selectedRange.end }
    }
    return fullExtent
  }, [fullExtent, selectedRange])

  const visibleEvents = useMemo(() => {
    if (!selectedRange) return events
    return events.filter(
      e => e._time >= selectedRange.start && e._time <= selectedRange.end
    )
  }, [events, selectedRange])

  const buckets = useMemo((): readonly Bucket[] => {
    if (!timeExtent) return []
    const { minTime, maxTime } = timeExtent

    if (minTime === maxTime) {
      const levels: Record<keyof LevelCounts, number> = { error: 0, warn: 0, info: 0, other: 0 }
      for (const event of visibleEvents) {
        levels[classifyLevel(event.level)]++
      }
      return [{ startTime: minTime, endTime: maxTime, count: visibleEvents.length, levels }]
    }

    const bucketCount = Math.min(MAX_BUCKETS, visibleEvents.length)
    if (bucketCount === 0) return []
    const bucketWidth = (maxTime - minTime) / bucketCount

    const levelArrays = {
      error: new Uint32Array(bucketCount),
      warn: new Uint32Array(bucketCount),
      info: new Uint32Array(bucketCount),
      other: new Uint32Array(bucketCount)
    }

    for (const event of visibleEvents) {
      const idx = Math.min(
        Math.floor((event._time - minTime) / bucketWidth),
        bucketCount - 1
      )
      levelArrays[classifyLevel(event.level)][idx]++
    }

    return Array.from({ length: bucketCount }, (_, i) => {
      const levels: LevelCounts = {
        error: levelArrays.error[i],
        warn: levelArrays.warn[i],
        info: levelArrays.info[i],
        other: levelArrays.other[i]
      }
      return {
        startTime: minTime + i * bucketWidth,
        endTime: minTime + (i + 1) * bucketWidth,
        count: levels.error + levels.warn + levels.info + levels.other,
        levels
      }
    })
  }, [visibleEvents, timeExtent])

  const maxCount = useMemo(() => {
    let max = 1
    for (const b of buckets) {
      if (b.count > max) max = b.count
    }
    return max
  }, [buckets])

  return { buckets, maxCount, timeExtent }
}
