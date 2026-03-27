import { memo, useMemo, useState, useCallback, useRef } from 'react'
import { LogEvent } from '../../types/LogEvent'
import styles from './Timeline.module.css'

/**
 * Timeline histogram with time range selection.
 *
 * Features:
 *  - Bucketed histogram (up to 50 bars) of event density over time
 *  - Stacked bars colored by log level (error, warn, info, other)
 *  - Time range inputs (start/end) to filter events
 *  - Click-and-drag brush selection on the SVG to pick a time range
 *  - Histogram zooms to selected range; x-axis labels snap to
 *    human-readable time boundaries (hours, 15min, etc.)
 *  - Y-axis tick marks with horizontal gridlines
 *  - onRangeChange callback passes [start, end] to parent for filtering
 *
 * Performance:
 *  - Loop-based min/max (no Math.min(...50K) stack overflow)
 *  - Uint32Array for bucket counts
 *  - Memoized bucket computation
 */

export interface TimeRange {
  readonly start: number
  readonly end: number
}

interface TimelineProps {
  events: readonly LogEvent[]
  selectedRange: TimeRange | null
  onRangeChange: (range: TimeRange | null) => void
}

interface LevelCounts {
  readonly error: number
  readonly warn: number
  readonly info: number
  readonly other: number
}

interface Bucket {
  readonly startTime: number
  readonly endTime: number
  readonly count: number
  readonly levels: LevelCounts
}

// Stacking order: error on top (most visible), then warn, info, other at base
const LEVEL_STACK: readonly (keyof LevelCounts)[] = ['other', 'info', 'warn', 'error']

const LEVEL_COLORS: Record<keyof LevelCounts, string> = {
  error: '#ff6b6b',
  warn: '#dcdcaa',
  info: '#4fc1ff',
  other: '#64748b'
}

const PADDING = { top: 8, right: 12, bottom: 36, left: 48 } as const
const MAX_BUCKETS = 50
const Y_TICK_COUNT = 5

// --- Smart time axis labeling ---

// Pick a "nice" interval for x-axis ticks based on the time span
const NICE_INTERVALS = [
  1000,             // 1s
  5000,             // 5s
  10000,            // 10s
  30000,            // 30s
  60000,            // 1m
  300000,           // 5m
  600000,           // 10m
  900000,           // 15m
  1800000,          // 30m
  3600000,          // 1h
  7200000,          // 2h
  14400000,         // 4h
  21600000,         // 6h
  43200000,         // 12h
  86400000,         // 1d
  172800000,        // 2d
  432000000,        // 5d
  604800000,        // 7d
  1209600000,       // 14d
  2592000000        // 30d
]

function pickTickInterval (spanMs: number, maxTicks: number): number {
  const idealInterval = spanMs / maxTicks
  for (const interval of NICE_INTERVALS) {
    if (interval >= idealInterval) return interval
  }
  return NICE_INTERVALS[NICE_INTERVALS.length - 1]
}

function generateTimeTicks (minTime: number, maxTime: number, maxTicks: number): number[] {
  const span = maxTime - minTime
  if (span <= 0) return [minTime]

  const interval = pickTickInterval(span, maxTicks)
  // Snap first tick to a round boundary
  const firstTick = Math.ceil(minTime / interval) * interval
  const ticks: number[] = []
  for (let t = firstTick; t <= maxTime; t += interval) {
    ticks.push(t)
  }
  return ticks
}

function formatTickLabel (epochMs: number, spanMs: number): string {
  const d = new Date(epochMs)
  const pad = (n: number) => String(n).padStart(2, '0')
  const M = pad(d.getUTCMonth() + 1)
  const D = pad(d.getUTCDate())
  const h = pad(d.getUTCHours())
  const m = pad(d.getUTCMinutes())
  const s = pad(d.getUTCSeconds())

  // > 2 days: just the date
  if (spanMs > 172800000) return `${M}-${D}`
  // > 2 hours: date + hour:minute
  if (spanMs > 7200000) return `${M}-${D} ${h}:${m}`
  // > 2 minutes: hour:minute
  if (spanMs > 120000) return `${h}:${m}`
  // seconds-level
  return `${h}:${m}:${s}`
}

// --- Y-axis nice ticks ---
function generateYTicks (maxCount: number, count: number): number[] {
  if (maxCount === 0) return [0]
  const ticks: number[] = []
  let prev = -1
  for (let i = 0; i <= count; i++) {
    const val = Math.round((maxCount / count) * i)
    if (val !== prev) {
      ticks.push(val)
      prev = val
    }
  }
  return ticks
}

// Format for datetime-local input value (YYYY-MM-DDTHH:mm:ss)
function toDatetimeLocal (epochMs: number): string {
  const d = new Date(epochMs)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
}

function formatTooltipTime (epochMs: number): string {
  return new Date(epochMs).toISOString().replace('T', ' ').replace('Z', '')
}


export const Timeline = memo(function Timeline ({
  events,
  selectedRange,
  onRangeChange
}: TimelineProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [brushStart, setBrushStart] = useState<number | null>(null)
  const [brushCurrent, setBrushCurrent] = useState<number | null>(null)
  const isDragging = useRef(false)

  // --- Full time extent (always computed from all events) ---
  const fullExtent = useMemo(() => {
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

  // --- Visible time extent: narrows to selectedRange when active ---
  const timeExtent = useMemo(() => {
    if (!fullExtent) return null
    if (selectedRange) {
      return { minTime: selectedRange.start, maxTime: selectedRange.end }
    }
    return fullExtent
  }, [fullExtent, selectedRange])

  function classifyLevel (level?: string): keyof LevelCounts {
    switch (level) {
      case 'error': return 'error'
      case 'warn': return 'warn'
      case 'info': return 'info'
      default: return 'other'
    }
  }

  // --- Filter events to visible range ---
  const visibleEvents = useMemo(() => {
    if (!selectedRange) return events
    return events.filter(
      e => e._time >= selectedRange.start && e._time <= selectedRange.end
    )
  }, [events, selectedRange])

  // --- Compute buckets with per-level counts ---
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

  // --- SVG layout ---
  const viewWidth = 1000
  const viewHeight = 110
  const chartWidth = viewWidth - PADDING.left - PADDING.right
  const chartHeight = viewHeight - PADDING.top - PADDING.bottom

  // --- Coordinate helpers ---
  const timeToX = useCallback((time: number): number => {
    if (!timeExtent) return PADDING.left
    const { minTime, maxTime } = timeExtent
    if (maxTime === minTime) return PADDING.left
    const ratio = (time - minTime) / (maxTime - minTime)
    return PADDING.left + ratio * chartWidth
  }, [timeExtent, chartWidth])

  const xToTime = useCallback((svgX: number): number => {
    if (!timeExtent) return 0
    const { minTime, maxTime } = timeExtent
    const ratio = Math.max(0, Math.min(1, (svgX - PADDING.left) / chartWidth))
    return minTime + ratio * (maxTime - minTime)
  }, [timeExtent, chartWidth])

  const mouseToSvgX = useCallback((e: React.MouseEvent): number => {
    const svg = svgRef.current
    if (!svg) return 0
    const rect = svg.getBoundingClientRect()
    const relativeX = e.clientX - rect.left
    return (relativeX / rect.width) * viewWidth
  }, [viewWidth])

  // --- Brush handlers ---
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!timeExtent) return
    isDragging.current = true
    const svgX = mouseToSvgX(e)
    setBrushStart(svgX)
    setBrushCurrent(svgX)
  }, [timeExtent, mouseToSvgX])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return
    setBrushCurrent(mouseToSvgX(e))
  }, [mouseToSvgX])

  const handleMouseUp = useCallback(() => {
    if (!isDragging.current || brushStart === null || brushCurrent === null) {
      isDragging.current = false
      return
    }
    isDragging.current = false

    const x1 = Math.min(brushStart, brushCurrent)
    const x2 = Math.max(brushStart, brushCurrent)

    if (Math.abs(x2 - x1) < 5) {
      setBrushStart(null)
      setBrushCurrent(null)
      return
    }

    const start = xToTime(x1)
    const end = xToTime(x2)
    onRangeChange({ start, end })
    setBrushStart(null)
    setBrushCurrent(null)
  }, [brushStart, brushCurrent, xToTime, onRangeChange])

  const handleClear = useCallback(() => {
    onRangeChange(null)
  }, [onRangeChange])

  const handleStartChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const ms = Date.parse(e.target.value + 'Z') // treat as UTC
    if (isNaN(ms)) return
    // If no range yet, auto-set end to start of next day
    const nextDay = ms - (ms % 86400000) + 86400000
    const end = selectedRange?.end ?? nextDay
    onRangeChange({ start: ms, end: Math.max(ms, end) })
  }, [selectedRange, onRangeChange])

  const handleEndChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const ms = Date.parse(e.target.value + 'Z') // treat as UTC
    if (isNaN(ms)) return
    const start = selectedRange?.start ?? fullExtent?.minTime ?? ms
    onRangeChange({ start: Math.min(start, ms), end: ms })
  }, [selectedRange, fullExtent, onRangeChange])


  const brushRect = useMemo(() => {
    if (brushStart === null || brushCurrent === null) return null
    const x1 = Math.min(brushStart, brushCurrent)
    const x2 = Math.max(brushStart, brushCurrent)
    return { x: x1, width: x2 - x1 }
  }, [brushStart, brushCurrent])

  // --- Compute axis ticks ---
  const xTicks = useMemo(() => {
    if (!timeExtent) return []
    const span = timeExtent.maxTime - timeExtent.minTime
    // Fewer ticks when labels include full date (wider text)
    const maxTicks = span > 7200000 ? 4 : 5
    return generateTimeTicks(timeExtent.minTime, timeExtent.maxTime, maxTicks)
  }, [timeExtent])

  const yTicks = useMemo(() => {
    return generateYTicks(maxCount, Y_TICK_COUNT)
  }, [maxCount])

  const timeSpan = timeExtent ? timeExtent.maxTime - timeExtent.minTime : 0

  if (events.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>Timeline will appear as events stream in</div>
      </div>
    )
  }

  const barWidth = buckets.length > 0 ? chartWidth / buckets.length : 0
  const barGap = Math.max(1, barWidth * 0.1)

  return (
    <div className={styles.container}>
      {/* Toolbar */}
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
          onInput={handleStartChange as React.FormEventHandler}
          onKeyUp={handleStartChange as React.FormEventHandler}
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
          onInput={handleEndChange as React.FormEventHandler}
          onKeyUp={handleEndChange as React.FormEventHandler}
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

      {/* Chart */}
      <div
        className={styles.chartArea}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          ref={svgRef}
          className={styles.svg}
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`Timeline histogram showing ${events.length} events across ${buckets.length} time buckets`}
        >
          {/* Horizontal gridlines + Y-axis tick labels */}
          {yTicks.map((tick, i) => {
            const y = PADDING.top + chartHeight - (tick / maxCount) * chartHeight
            return (
              <g key={`y-${i}`}>
                <line
                  className={styles.gridline}
                  x1={PADDING.left}
                  y1={y}
                  x2={viewWidth - PADDING.right}
                  y2={y}
                />
                <text
                  className={styles.yLabel}
                  x={PADDING.left - 6}
                  y={y + 3}
                  textAnchor="end"
                >
                  {tick.toLocaleString()}
                </text>
              </g>
            )
          })}

          {/* Stacked bars */}
          {buckets.map((bucket, i) => {
            const totalBarHeight = (bucket.count / maxCount) * chartHeight
            const x = PADDING.left + i * barWidth + barGap / 2
            const width = Math.max(1, barWidth - barGap)

            let yOffset = PADDING.top + chartHeight
            const segments = LEVEL_STACK.map(level => {
              const count = bucket.levels[level]
              if (count === 0) return null
              const segHeight = (count / bucket.count) * totalBarHeight
              yOffset -= segHeight
              return (
                <rect
                  key={`${i}-${level}`}
                  x={x}
                  y={yOffset}
                  width={width}
                  height={segHeight}
                  fill={LEVEL_COLORS[level]}
                  opacity={0.85}
                />
              )
            })

            return (
              <g key={i}>
                {segments}
                <title>
                  {bucket.count} events ({formatTooltipTime(bucket.startTime)})
                  {bucket.levels.error > 0 ? ` — ${bucket.levels.error} error` : ''}
                  {bucket.levels.warn > 0 ? `, ${bucket.levels.warn} warn` : ''}
                  {bucket.levels.info > 0 ? `, ${bucket.levels.info} info` : ''}
                </title>
              </g>
            )
          })}

          {/* Active brush drag overlay */}
          {brushRect && (
            <>
              <rect
                className={styles.brushOverlay}
                x={brushRect.x}
                y={PADDING.top}
                width={brushRect.width}
                height={chartHeight}
              />
              <rect
                className={styles.brushBorder}
                x={brushRect.x}
                y={PADDING.top}
                width={brushRect.width}
                height={chartHeight}
              />
            </>
          )}

          {/* X-axis tick labels with tick marks — snapped to human-readable boundaries */}
          {xTicks.map((tick, i) => {
            const x = timeToX(tick)
            if (x < PADDING.left || x > viewWidth - PADDING.right) return null
            const chartBottom = PADDING.top + chartHeight
            return (
              <g key={`x-${i}`}>
                {/* Faint vertical gridline through the chart area */}
                <line
                  className={styles.gridline}
                  x1={x}
                  y1={PADDING.top}
                  x2={x}
                  y2={chartBottom}
                />
                {/* Tick mark below the chart — more prominent */}
                <line
                  className={styles.tickMark}
                  x1={x}
                  y1={chartBottom}
                  x2={x}
                  y2={chartBottom + 6}
                />
                <text
                  className={styles.axisLabel}
                  x={x}
                  y={viewHeight - 3}
                  textAnchor="middle"
                >
                  {formatTickLabel(tick, timeSpan)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
})
