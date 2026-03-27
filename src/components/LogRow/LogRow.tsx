import { useState, useCallback, useMemo } from 'react'
import { LogEvent, TimeFormat } from '../../types/LogEvent'
import { formatTime } from '../../utils/formatTime'
import styles from './LogRow.module.css'

interface LogRowProps {
  event: LogEvent
  timeFormat: TimeFormat
  index: number
  style?: React.CSSProperties
}

function getLevelClass (level?: string): string {
  switch (level) {
    case 'error': return styles.levelError
    case 'info': return styles.levelInfo
    default: return styles.levelDefault
  }
}

export function LogRow ({ event, timeFormat, index, style }: LogRowProps) {
  const [expanded, setExpanded] = useState(false)

  const toggle = useCallback(() => {
    setExpanded(prev => !prev)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setExpanded(prev => !prev)
    }
  }, [])

  // Memoize expensive string operations — only recompute when inputs change
  const formattedTime = useMemo(
    () => formatTime(event._time, timeFormat),
    [event._time, timeFormat]
  )
  const singleLineJson = useMemo(
    () => JSON.stringify(event),
    [event]
  )
  const multiLineJson = useMemo(
    () => JSON.stringify(event, null, 2),
    [event]
  )

  const isEven = index % 2 === 0
  const rowClasses = [
    styles.row,
    isEven ? styles.rowEven : '',
    getLevelClass(event.level)
  ].filter(Boolean).join(' ')

  return (
    <div
      className={rowClasses}
      role="row"
      tabIndex={0}
      aria-expanded={expanded}
      onClick={toggle}
      onKeyDown={handleKeyDown}
      style={style}
    >
      <div className={styles.time} role="cell">
        {formattedTime}
      </div>
      <div className={styles.eventCollapsed} role="cell">
        {singleLineJson}
      </div>
      <div className={`${styles.expandWrapper} ${expanded ? styles.expandWrapperOpen : ''}`}>
        <div className={styles.expandContent}>
          {expanded && (
            <pre className={styles.eventExpanded}>
              {multiLineJson}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}
