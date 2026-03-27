import { formatTime } from './formatTime'

describe('formatTime', () => {
  describe('UTC mode', () => {
    it('formats millisecond epoch to ISO 8601 UTC string', () => {
      expect(formatTime(1724323612592, 'utc')).toBe('2024-08-22T10:46:52.592Z')
    })

    it('formats epoch zero', () => {
      expect(formatTime(0, 'utc')).toBe('1970-01-01T00:00:00.000Z')
    })

    it('handles timestamps without millisecond precision', () => {
      expect(formatTime(1724323612000, 'utc')).toBe('2024-08-22T10:46:52.000Z')
    })
  })

  describe('local mode', () => {
    it('produces a string representing the same point in time', () => {
      const epochMs = 1724323612592
      const result = formatTime(epochMs, 'local')
      const originalDate = new Date(epochMs)

      // The local string should contain the correct local date components
      // regardless of which timezone the test runs in
      const localYear = originalDate.getFullYear().toString()
      const localMonth = String(originalDate.getMonth() + 1).padStart(2, '0')
      const localDay = String(originalDate.getDate()).padStart(2, '0')

      expect(result).toContain(localYear)
      expect(result).toContain(localMonth)
      expect(result).toContain(localDay)
    })

    it('contains the correct local hour, minute, and second', () => {
      const epochMs = 1724323612592
      const result = formatTime(epochMs, 'local')
      const date = new Date(epochMs)

      const localHour = String(date.getHours()).padStart(2, '0')
      const localMinute = String(date.getMinutes()).padStart(2, '0')
      const localSecond = String(date.getSeconds()).padStart(2, '0')

      expect(result).toContain(localMinute)
      expect(result).toContain(localSecond)
      // Hour might be in 12-hour format depending on locale, so check
      // either the 24h hour or the 12h equivalent is present
      const hour12 = date.getHours() % 12 || 12
      const hasHour =
        result.includes(localHour) ||
        result.includes(String(hour12).padStart(2, '0'))
      expect(hasHour).toBe(true)
    })

    it('does not end with Z (not UTC format)', () => {
      const result = formatTime(1724323612592, 'local')
      expect(result.endsWith('Z')).toBe(false)
    })

    it('includes milliseconds', () => {
      // 592ms should appear in the output
      const result = formatTime(1724323612592, 'local')
      expect(result).toContain('592')
    })

    it('formats epoch zero in local time', () => {
      const result = formatTime(0, 'local')
      const date = new Date(0)
      const localYear = date.getFullYear().toString()
      expect(result).toContain(localYear)
    })

    it('handles midnight boundary correctly', () => {
      // Midnight UTC on 2024-01-01
      const midnightUTC = Date.UTC(2024, 0, 1, 0, 0, 0, 0)
      const result = formatTime(midnightUTC, 'local')
      const date = new Date(midnightUTC)
      // The local date may differ from UTC date near midnight
      const localDay = String(date.getDate()).padStart(2, '0')
      expect(result).toContain(localDay)
    })
  })

  describe('defaults', () => {
    it('defaults to UTC when no format specified', () => {
      expect(formatTime(1724323612592)).toBe('2024-08-22T10:46:52.592Z')
    })
  })
})
