import { useRef, useCallback, useEffect, useMemo, useState } from 'react'
import styles from './VirtualList.module.css'

const OVERSCAN = 5
const EXPANDED_HEIGHT_ESTIMATE = 300

interface VirtualListProps {
  itemCount: number
  defaultItemHeight: number
  renderItem: (
    index: number,
    onToggleExpand: (index: number) => void,
    isExpanded: boolean
  ) => React.ReactNode
}

/**
 * Virtualizer with fixed collapsed heights + dynamic expanded heights.
 *
 * Architecture:
 *  - Single ghost div whose height = totalSize fakes the scrollbar
 *  - Visible items are absolutely positioned via transform: translateY
 *  - Binary search to find the visible range from scroll position
 *  - Overscan buffer renders extra rows above/below the viewport
 *  - Expand state lifted here for height tracking
 *  - Collapsed rows use a fixed height (O(1) lookup)
 *  - Expanded rows render without a height constraint — a per-row
 *    ResizeObserver measures the actual content height, which feeds
 *    back into getOffset/totalSize for correct positioning of
 *    subsequent rows. No guessing, no gaps, no overlap.
 */
export function VirtualList ({
  itemCount,
  defaultItemHeight,
  renderItem
}: VirtualListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)
  const [expandedRows, setExpandedRows] = useState<ReadonlySet<number>>(
    () => new Set()
  )

  // Cache of measured heights for expanded rows.
  // Key = row index, value = measured pixel height.
  const [measuredHeights, setMeasuredHeights] = useState<ReadonlyMap<number, number>>(
    () => new Map()
  )

  // --- Measure viewport via ResizeObserver ---
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setViewportHeight(entry.contentRect.height)
      }
    })
    ro.observe(el)
    setViewportHeight(el.clientHeight)

    return () => ro.disconnect()
  }, [])

  // --- Scroll handler (rAF-throttled) ---
  const rafRef = useRef<number | null>(null)
  const handleScroll = useCallback(() => {
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const el = containerRef.current
      if (el) setScrollTop(el.scrollTop)
    })
  }, [])

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // Track ResizeObservers for expanded row wrappers
  const rowObserversRef = useRef<Map<number, ResizeObserver>>(new Map())

  // Clean up observers when rows collapse or component unmounts
  useEffect(() => {
    rowObserversRef.current.forEach((ro, idx) => {
      if (!expandedRows.has(idx)) {
        ro.disconnect()
        rowObserversRef.current.delete(idx)
      }
    })
  }, [expandedRows])

  useEffect(() => {
    return () => {
      rowObserversRef.current.forEach(ro => ro.disconnect())
      rowObserversRef.current.clear()
    }
  }, [])

  // --- Toggle expand (stable callback) ---
  const handleToggleExpand = useCallback((index: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
        // Clear cached measurement for collapsed row
        setMeasuredHeights(prevH => {
          const nextH = new Map(prevH)
          nextH.delete(index)
          return nextH
        })
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  // --- Height for a given row ---
  const getHeight = useCallback(
    (index: number): number => {
      if (!expandedRows.has(index)) return defaultItemHeight
      return measuredHeights.get(index) ?? EXPANDED_HEIGHT_ESTIMATE
    },
    [expandedRows, measuredHeights, defaultItemHeight]
  )

  // --- O(1)-ish total height ---
  // Base: all rows at default height.
  // Add delta for each expanded row (measured or estimated).
  const totalSize = useMemo(() => {
    let size = itemCount * defaultItemHeight
    expandedRows.forEach(idx => {
      const h = measuredHeights.get(idx) ?? EXPANDED_HEIGHT_ESTIMATE
      size += h - defaultItemHeight
    })
    return size
  }, [itemCount, defaultItemHeight, expandedRows, measuredHeights])

  // --- Build sorted expanded indices for binary-search offset correction ---
  const sortedExpanded = useMemo(() => {
    const arr = Array.from(expandedRows).sort((a, b) => a - b)
    return arr
  }, [expandedRows])

  // --- Compute offset at a given index: O(log E + E) where E = expanded count ---
  const getOffset = useCallback(
    (index: number): number => {
      let offset = index * defaultItemHeight
      // Add height deltas for expanded rows before this index
      for (const idx of sortedExpanded) {
        if (idx >= index) break
        const h = measuredHeights.get(idx) ?? EXPANDED_HEIGHT_ESTIMATE
        offset += h - defaultItemHeight
      }
      return offset
    },
    [defaultItemHeight, sortedExpanded, measuredHeights]
  )

  // --- Find start index via binary search on offsets ---
  const findStartIndex = useCallback(
    (top: number): number => {
      let lo = 0
      let hi = itemCount - 1
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (getOffset(mid) + getHeight(mid) <= top) lo = mid + 1
        else hi = mid
      }
      return lo
    },
    [itemCount, getHeight, getOffset]
  )

  // --- Visible range ---
  const { startIndex, endIndex } = useMemo(() => {
    if (itemCount === 0 || viewportHeight === 0) {
      return { startIndex: 0, endIndex: -1 }
    }

    const rawStart = findStartIndex(scrollTop)
    const start = Math.max(0, rawStart - OVERSCAN)

    let end = start
    while (end < itemCount) {
      if (getOffset(end) > scrollTop + viewportHeight) break
      end++
    }
    end = Math.min(itemCount - 1, end + OVERSCAN)

    return { startIndex: start, endIndex: end }
  }, [itemCount, viewportHeight, scrollTop, findStartIndex, getOffset])

  // --- Ref callback: observe expanded row wrappers via ResizeObserver ---
  // No height constraint on the wrapper — content sizes naturally.
  // ResizeObserver fires with the real height, which feeds back into
  // getHeight/getOffset/totalSize for correct positioning of subsequent rows.
  const itemRef = useCallback(
    (el: HTMLDivElement | null, index: number) => {
      // Disconnect any prior observer for this index
      const existing = rowObserversRef.current.get(index)
      if (existing) {
        existing.disconnect()
        rowObserversRef.current.delete(index)
      }

      if (!el || !expandedRows.has(index)) return

      const ro = new ResizeObserver(entries => {
        for (const entry of entries) {
          const h = Math.ceil(
            entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height
          )
          if (h > 0) {
            setMeasuredHeights(prev => {
              if (prev.get(index) === h) return prev
              const next = new Map(prev)
              next.set(index, h)
              return next
            })
          }
        }
      })
      ro.observe(el)
      rowObserversRef.current.set(index, ro)
    },
    [expandedRows]
  )

  // --- Render visible items with absolute positioning ---
  // Expanded wrappers have no height constraint — content flows naturally.
  // Collapsed wrappers use the fixed defaultItemHeight.
  const items: React.ReactNode[] = []
  for (let i = startIndex; i <= endIndex && i < itemCount; i++) {
    const offset = getOffset(i)
    const isExpanded = expandedRows.has(i)
    const idx = i
    items.push(
      <div
        key={i}
        ref={isExpanded ? (el) => itemRef(el, idx) : undefined}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: isExpanded ? undefined : defaultItemHeight,
          transform: `translateY(${offset}px)`
        }}
      >
        {renderItem(i, handleToggleExpand, isExpanded)}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={styles.container}
      onScroll={handleScroll}
    >
      <div className={styles.spacer} style={{ height: totalSize }}>
        {items}
      </div>
    </div>
  )
}
