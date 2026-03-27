import { generateTimeTicks, formatTickLabel, generateYTicks, toDatetimeLocal, formatTooltipTime } from './timeAxis'

describe('generateTimeTicks', () => {
  it('returns single tick for zero span', () => {
    const ticks = generateTimeTicks(1000, 1000, 5)
    expect(ticks).toEqual([1000])
  })

  it('generates ticks within the time range', () => {
    const min = 0
    const max = 60000 // 1 minute
    const ticks = generateTimeTicks(min, max, 5)
    expect(ticks.length).toBeGreaterThan(0)
    for (const t of ticks) {
      expect(t).toBeGreaterThanOrEqual(min)
      expect(t).toBeLessThanOrEqual(max)
    }
  })

  it('snaps ticks to nice intervals', () => {
    const min = 1000
    const max = 61000 // ~60s span
    const ticks = generateTimeTicks(min, max, 5)
    // Each tick should be at a round interval boundary
    for (const t of ticks) {
      // Ticks should be divisible by the chosen interval
      expect(t % 1000).toBe(0) // at minimum, snapped to seconds
    }
  })

  it('respects maxTicks limit', () => {
    const ticks = generateTimeTicks(0, 3600000, 3) // 1 hour, max 3 ticks
    expect(ticks.length).toBeLessThanOrEqual(4) // may slightly exceed due to rounding
  })
})

describe('formatTickLabel', () => {
  it('shows date only for spans > 2 days', () => {
    const label = formatTickLabel(Date.UTC(2024, 7, 15, 12, 30), 300000000)
    expect(label).toMatch(/^\d{2}-\d{2}$/)
  })

  it('shows date and time for spans > 2 hours', () => {
    const label = formatTickLabel(Date.UTC(2024, 7, 15, 12, 30), 10000000)
    expect(label).toMatch(/^\d{2}-\d{2} \d{2}:\d{2}$/)
  })

  it('shows hours:minutes for spans > 2 minutes', () => {
    const label = formatTickLabel(Date.UTC(2024, 7, 15, 12, 30), 300000)
    expect(label).toMatch(/^\d{2}:\d{2}$/)
  })

  it('shows hours:minutes:seconds for short spans', () => {
    const label = formatTickLabel(Date.UTC(2024, 7, 15, 12, 30, 45), 60000)
    expect(label).toMatch(/^\d{2}:\d{2}:\d{2}$/)
  })
})

describe('generateYTicks', () => {
  it('returns [0] for zero maxCount', () => {
    expect(generateYTicks(0, 5)).toEqual([0])
  })

  it('generates ticks from 0 to maxCount', () => {
    const ticks = generateYTicks(100, 5)
    expect(ticks[0]).toBe(0)
    expect(ticks[ticks.length - 1]).toBe(100)
  })

  it('deduplicates when maxCount is small', () => {
    const ticks = generateYTicks(2, 5)
    const unique = new Set(ticks)
    expect(ticks.length).toBe(unique.size)
  })
})

describe('toDatetimeLocal', () => {
  it('formats epoch to datetime-local string', () => {
    const result = toDatetimeLocal(Date.UTC(2024, 7, 15, 12, 30, 45))
    expect(result).toBe('2024-08-15T12:30:45')
  })
})

describe('formatTooltipTime', () => {
  it('formats epoch to readable ISO-like string without T and Z', () => {
    const result = formatTooltipTime(Date.UTC(2024, 7, 15, 12, 30, 45))
    expect(result).toContain('2024-08-15')
    expect(result).toContain('12:30:45')
    expect(result).not.toContain('T')
    expect(result).not.toContain('Z')
  })
})
