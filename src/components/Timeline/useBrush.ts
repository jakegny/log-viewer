import { useState, useCallback, useRef, useMemo } from 'react'
import { TimeExtent, TimeRange } from './types'

interface BrushRect {
  readonly x: number
  readonly width: number
}

interface UseBrushResult {
  brushRect: BrushRect | null
  handleMouseDown: (e: React.MouseEvent) => void
  handleMouseMove: (e: React.MouseEvent) => void
  handleMouseUp: () => void
}

/**
 * Click-and-drag brush interaction for SVG charts.
 *
 * Converts mouse coordinates to SVG viewBox space, tracks drag start/end,
 * and calls onRangeChange with the selected time range on mouse up.
 * Ignores tiny drags (< 5px) to distinguish clicks from selections.
 */
export function useBrush (
  svgRef: React.RefObject<SVGSVGElement | null>,
  timeExtent: TimeExtent | null,
  viewWidth: number,
  chartWidth: number,
  paddingLeft: number,
  onRangeChange: (range: TimeRange | null) => void
): UseBrushResult {
  const [brushStart, setBrushStart] = useState<number | null>(null)
  const [brushCurrent, setBrushCurrent] = useState<number | null>(null)
  const isDragging = useRef(false)

  const mouseToSvgX = useCallback((e: React.MouseEvent): number => {
    const svg = svgRef.current
    if (!svg) return 0
    const rect = svg.getBoundingClientRect()
    const relativeX = e.clientX - rect.left
    return (relativeX / rect.width) * viewWidth
  }, [svgRef, viewWidth])

  const xToTime = useCallback((svgX: number): number => {
    if (!timeExtent) return 0
    const { minTime, maxTime } = timeExtent
    const ratio = Math.max(0, Math.min(1, (svgX - paddingLeft) / chartWidth))
    return minTime + ratio * (maxTime - minTime)
  }, [timeExtent, chartWidth, paddingLeft])

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

  const brushRect = useMemo((): BrushRect | null => {
    if (brushStart === null || brushCurrent === null) return null
    const x1 = Math.min(brushStart, brushCurrent)
    const x2 = Math.max(brushStart, brushCurrent)
    return { x: x1, width: x2 - x1 }
  }, [brushStart, brushCurrent])

  return { brushRect, handleMouseDown, handleMouseMove, handleMouseUp }
}
