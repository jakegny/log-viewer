import { memo, useCallback } from 'react'
import { TimeRange, TimeExtent } from './types'
import { toDatetimeLocal } from './timeAxis'
import styles from './Timeline.module.css'

interface TimelineToolbarProps {
  fullExtent: TimeExtent | null
  selectedRange: TimeRange | null
  onRangeChange: (range: TimeRange | null) => void
}

export const TimelineToolbar = memo(function TimelineToolbar ({
  fullExtent,
  selectedRange,
  onRangeChange
}: TimelineToolbarProps) {
  const handleStartChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const ms = Date.parse(e.target.value + 'Z')
    if (isNaN(ms)) return
    // Default to end-of-day boundary when no end time is selected yet
    const nextDay = ms - (ms % 86400000) + 86400000
    const end = selectedRange?.end ?? nextDay
    onRangeChange({ start: ms, end: Math.max(ms, end) })
  }, [selectedRange, onRangeChange])

  const handleEndChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const ms = Date.parse(e.target.value + 'Z')
    if (isNaN(ms)) return
    const start = selectedRange?.start ?? fullExtent?.minTime ?? ms
    onRangeChange({ start: Math.min(start, ms), end: ms })
  }, [selectedRange, fullExtent, onRangeChange])

  const handleClear = useCallback(() => {
    onRangeChange(null)
  }, [onRangeChange])

  return (
    <div className={styles.toolbar}>
      <span className={styles.toolbarLabel}>Range</span>
      <input
        className={styles.timeInput}
        type="datetime-local"
        step="1"
        min={fullExtent ? toDatetimeLocal(fullExtent.minTime) : undefined}
        max={fullExtent ? toDatetimeLocal(fullExtent.maxTime) : undefined}
        value={selectedRange ? toDatetimeLocal(selectedRange.start) : ''}
        onChange={handleStartChange}
        aria-label="Range start time"
      />
      <span className={styles.toolbarSeparator}>&ndash;</span>
      <input
        className={styles.timeInput}
        type="datetime-local"
        step="1"
        min={fullExtent ? toDatetimeLocal(fullExtent.minTime) : undefined}
        max={fullExtent ? toDatetimeLocal(fullExtent.maxTime) : undefined}
        value={selectedRange ? toDatetimeLocal(selectedRange.end) : ''}
        onChange={handleEndChange}
        aria-label="Range end time"
      />
      {selectedRange && (
        <button
          className={styles.clearButton}
          onClick={handleClear}
          aria-label="Clear time range"
        >
          Reset
        </button>
      )}
    </div>
  )
})
