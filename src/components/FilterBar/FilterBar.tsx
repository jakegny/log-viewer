import { memo, useMemo, useCallback } from 'react'
import { LogEvent, FacetFilter } from '../../types/LogEvent'
import styles from './FilterBar.module.css'

/**
 * Datadog-style faceted filter bar.
 *
 * Pattern:
 *  - Toggle pills with counts for each facet value
 *  - OR within a facet: selecting "error" and "warn" shows both
 *  - Empty selection = show all (no filter)
 *  - Clicking an active pill deselects it
 *  - Extensible: add new facet groups by adding to FacetFilter type
 *
 * The counts shown are from the unfiltered (but time-range-scoped) events,
 * so the user can see the full distribution before filtering.
 */

interface FilterBarProps {
  /** Events to compute facet counts from (pre-time-filter, post-time-range) */
  events: readonly LogEvent[]
  filter: FacetFilter
  onFilterChange: (filter: FacetFilter) => void
}

const LEVEL_ORDER = ['error', 'warn', 'info'] as const

function getLevelPillStyle (level: string, isActive: boolean): string {
  if (!isActive) return styles.pill
  switch (level) {
    case 'error': return styles.pillError
    case 'warn': return styles.pillWarn
    case 'info': return styles.pillInfo
    default: return styles.pillOther
  }
}

export const FilterBar = memo(function FilterBar ({
  events,
  filter,
  onFilterChange
}: FilterBarProps) {
  // Compute level counts from all events (not filtered)
  const levelCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const event of events) {
      const level = event.level ?? ''
      counts.set(level, (counts.get(level) ?? 0) + 1)
    }
    return counts
  }, [events])

  // Sorted level keys: known levels first in order, then others alphabetically
  const sortedLevels = useMemo(() => {
    const known = LEVEL_ORDER.filter(l => levelCounts.has(l))
    const others = Array.from(levelCounts.keys())
      .filter(l => !(LEVEL_ORDER as readonly string[]).includes(l))
      .sort()
    return [...known, ...others]
  }, [levelCounts])

  const handleLevelToggle = useCallback((level: string) => {
    const next = new Set(filter.levels)
    if (next.has(level)) {
      next.delete(level)
    } else {
      next.add(level)
    }
    onFilterChange({ ...filter, levels: next })
  }, [filter, onFilterChange])

  const handleClearAll = useCallback(() => {
    onFilterChange({ ...filter, levels: new Set() })
  }, [filter, onFilterChange])

  const hasActiveFilters = filter.levels.size > 0

  return (
    <div className={styles.container} role="toolbar" aria-label="Log filters">
      {/* Level facet */}
      <div className={styles.facetGroup}>
        <span className={styles.facetLabel}>Level</span>
        {sortedLevels.map(level => {
          const count = levelCounts.get(level) ?? 0
          const isActive = filter.levels.has(level)
          return (
            <button
              key={level}
              className={getLevelPillStyle(level, isActive)}
              onClick={() => handleLevelToggle(level)}
              aria-pressed={isActive}
              aria-label={`Filter by ${level || 'unknown'} (${count})`}
            >
              {level || 'unknown'}
              <span className={styles.count}>{count.toLocaleString()}</span>
            </button>
          )
        })}
      </div>

      {/* Future facet groups go here */}

      {hasActiveFilters && (
        <button
          className={styles.clearAll}
          onClick={handleClearAll}
          aria-label="Clear all filters"
        >
          Clear filters
        </button>
      )}
    </div>
  )
})
