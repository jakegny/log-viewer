import { memo } from 'react'
import { LogEvent } from '../../types/LogEvent'
import { TimelineToolbar } from './TimelineToolbar'
import { HistogramChart } from './HistogramChart'
import { useTimeExtent, useBuckets } from './useBuckets'
import { TimeRange } from './types'
import styles from './Timeline.module.css'

// Re-export types consumed by parent components
export type { TimeRange } from './types'

interface TimelineProps {
  events: readonly LogEvent[]
  selectedRange: TimeRange | null
  onRangeChange: (range: TimeRange | null) => void
}

/**
 * Timeline histogram with time range selection.
 *
 * Orchestrates:
 *  - TimelineToolbar: datetime-local pickers + Reset button
 *  - HistogramChart: SVG stacked bars, gridlines, brush selection
 *  - useBuckets: bucketing events into time intervals with level counts
 *  - useBrush: click-and-drag interaction (inside HistogramChart)
 *
 * See types.ts, timeAxis.ts, useBuckets.ts, useBrush.ts for internals.
 */
export const Timeline = memo(function Timeline ({
  events,
  selectedRange,
  onRangeChange
}: TimelineProps) {
  const fullExtent = useTimeExtent(events)
  const { buckets, maxCount, timeExtent } = useBuckets(events, selectedRange, fullExtent)

  if (events.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>Timeline will appear as events stream in</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <TimelineToolbar
        fullExtent={fullExtent}
        selectedRange={selectedRange}
        onRangeChange={onRangeChange}
      />
      <HistogramChart
        buckets={buckets}
        maxCount={maxCount}
        timeExtent={timeExtent}
        selectedRange={selectedRange}
        onRangeChange={onRangeChange}
      />
    </div>
  )
})
