import { memo, useMemo, useCallback, useRef } from 'react'
import { Bucket, TimeExtent, LEVEL_STACK, LEVEL_COLORS } from './types'
import { generateTimeTicks, generateYTicks, formatTickLabel, formatTooltipTime } from './timeAxis'
import { useBrush } from './useBrush'
import { TimeRange } from './types'
import styles from './Timeline.module.css'

const PADDING = { top: 8, right: 12, bottom: 22, left: 48 } as const
const VIEW_WIDTH = 1000
const VIEW_HEIGHT = 110
const Y_TICK_COUNT = 5

interface HistogramChartProps {
  buckets: readonly Bucket[]
  maxCount: number
  timeExtent: TimeExtent | null
  selectedRange: TimeRange | null
  onRangeChange: (range: TimeRange | null) => void
}

export const HistogramChart = memo(function HistogramChart ({
  buckets,
  maxCount,
  timeExtent,
  selectedRange,
  onRangeChange
}: HistogramChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  const chartWidth = VIEW_WIDTH - PADDING.left - PADDING.right
  const chartHeight = VIEW_HEIGHT - PADDING.top - PADDING.bottom

  const timeToX = useCallback((time: number): number => {
    if (!timeExtent) return PADDING.left
    const { minTime, maxTime } = timeExtent
    if (maxTime === minTime) return PADDING.left
    const ratio = (time - minTime) / (maxTime - minTime)
    return PADDING.left + ratio * chartWidth
  }, [timeExtent, chartWidth])

  const { brushRect, handleMouseDown, handleMouseMove, handleMouseUp } = useBrush(
    svgRef, timeExtent, VIEW_WIDTH, chartWidth, PADDING.left, onRangeChange
  )

  const xTicks = useMemo(() => {
    if (!timeExtent) return []
    const span = timeExtent.maxTime - timeExtent.minTime
    const maxTicks = span > 7200000 ? 4 : 5
    return generateTimeTicks(timeExtent.minTime, timeExtent.maxTime, maxTicks)
  }, [timeExtent])

  const yTicks = useMemo(() => generateYTicks(maxCount, Y_TICK_COUNT), [maxCount])

  const timeSpan = timeExtent ? timeExtent.maxTime - timeExtent.minTime : 0
  const barWidth = buckets.length > 0 ? chartWidth / buckets.length : 0
  const barGap = Math.max(1, barWidth * 0.1)

  return (
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
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Timeline histogram showing ${buckets.reduce((s, b) => s + b.count, 0)} events across ${buckets.length} time buckets`}
      >
        {/* Horizontal gridlines + Y-axis tick labels */}
        {yTicks.map((tick, i) => {
          const y = PADDING.top + chartHeight - (tick / maxCount) * chartHeight
          return (
            <g key={`y-${i}`}>
              <line
                className={styles.gridline}
                x1={PADDING.left} y1={y}
                x2={VIEW_WIDTH - PADDING.right} y2={y}
              />
              <text
                className={styles.yLabel}
                x={PADDING.left - 6} y={y + 3}
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
                x={x} y={yOffset}
                width={width} height={segHeight}
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
              x={brushRect.x} y={PADDING.top}
              width={brushRect.width} height={chartHeight}
            />
            <rect
              className={styles.brushBorder}
              x={brushRect.x} y={PADDING.top}
              width={brushRect.width} height={chartHeight}
            />
            {/* Left edge handle */}
            <line
              className={styles.brushEdge}
              x1={brushRect.x} y1={PADDING.top}
              x2={brushRect.x} y2={PADDING.top + chartHeight}
            />
            {/* Right edge handle */}
            <line
              className={styles.brushEdge}
              x1={brushRect.x + brushRect.width} y1={PADDING.top}
              x2={brushRect.x + brushRect.width} y2={PADDING.top + chartHeight}
            />
          </>
        )}

        {/* X-axis tick labels with tick marks */}
        {xTicks.map((tick, i) => {
          const x = timeToX(tick)
          if (x < PADDING.left || x > VIEW_WIDTH - PADDING.right) return null
          const chartBottom = PADDING.top + chartHeight
          return (
            <g key={`x-${i}`}>
              <line
                className={styles.gridline}
                x1={x} y1={PADDING.top}
                x2={x} y2={chartBottom}
              />
              <line
                className={styles.tickMark}
                x1={x} y1={chartBottom}
                x2={x} y2={chartBottom + 6}
              />
              <text
                className={styles.axisLabel}
                x={x} y={VIEW_HEIGHT - 3}
                textAnchor="middle"
              >
                {formatTickLabel(tick, timeSpan)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
})
