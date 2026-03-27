import { renderHook } from '@testing-library/react'
import { useTimeExtent, useBuckets } from './useBuckets'
import { LogEvent } from '../../types/LogEvent'

const makeEvent = (time: number, level?: string): LogEvent => ({
  _time: time,
  level,
  message: `event at ${time}`
})

describe('useTimeExtent', () => {
  it('returns null for empty events', () => {
    const { result } = renderHook(() => useTimeExtent([]))
    expect(result.current).toBeNull()
  })

  it('computes correct min/max for multiple events', () => {
    const events = [makeEvent(100), makeEvent(50), makeEvent(200), makeEvent(75)]
    const { result } = renderHook(() => useTimeExtent(events))
    expect(result.current).toEqual({ minTime: 50, maxTime: 200 })
  })

  it('handles single event', () => {
    const events = [makeEvent(42)]
    const { result } = renderHook(() => useTimeExtent(events))
    expect(result.current).toEqual({ minTime: 42, maxTime: 42 })
  })
})

describe('useBuckets', () => {
  it('returns empty buckets when no extent', () => {
    const { result } = renderHook(() => useBuckets([], null, null))
    expect(result.current.buckets).toEqual([])
    expect(result.current.maxCount).toBe(1)
  })

  it('creates single bucket when all events have same timestamp', () => {
    const events = [makeEvent(100, 'info'), makeEvent(100, 'error'), makeEvent(100, 'warn')]
    const extent = { minTime: 100, maxTime: 100 }
    const { result } = renderHook(() => useBuckets(events, null, extent))
    expect(result.current.buckets).toHaveLength(1)
    expect(result.current.buckets[0].count).toBe(3)
    expect(result.current.buckets[0].levels.info).toBe(1)
    expect(result.current.buckets[0].levels.error).toBe(1)
    expect(result.current.buckets[0].levels.warn).toBe(1)
  })

  it('classifies levels correctly', () => {
    const events = [
      makeEvent(100, 'error'),
      makeEvent(200, 'warn'),
      makeEvent(300, 'info'),
      makeEvent(400, 'debug'),
      makeEvent(500, undefined)
    ]
    const extent = { minTime: 100, maxTime: 500 }
    const { result } = renderHook(() => useBuckets(events, null, extent))

    const totals = { error: 0, warn: 0, info: 0, other: 0 }
    for (const b of result.current.buckets) {
      totals.error += b.levels.error
      totals.warn += b.levels.warn
      totals.info += b.levels.info
      totals.other += b.levels.other
    }
    expect(totals.error).toBe(1)
    expect(totals.warn).toBe(1)
    expect(totals.info).toBe(1)
    expect(totals.other).toBe(2) // 'debug' and undefined
  })

  it('respects selectedRange for visible events', () => {
    const events = [makeEvent(100, 'info'), makeEvent(200, 'info'), makeEvent(300, 'info')]
    const extent = { minTime: 100, maxTime: 300 }
    const range = { start: 150, end: 250 }
    const { result } = renderHook(() => useBuckets(events, range, extent))

    const totalCount = result.current.buckets.reduce((sum, b) => sum + b.count, 0)
    expect(totalCount).toBe(1) // only event at 200 is in range
  })

  it('limits to at most 50 buckets', () => {
    const events = Array.from({ length: 100 }, (_, i) => makeEvent(i * 1000, 'info'))
    const extent = { minTime: 0, maxTime: 99000 }
    const { result } = renderHook(() => useBuckets(events, null, extent))
    expect(result.current.buckets.length).toBeLessThanOrEqual(50)
  })
})
