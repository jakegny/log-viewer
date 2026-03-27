import { memo, useCallback, useRef } from 'react'
import { LogEvent, TimeFormat } from '../../types/LogEvent'
import { LogRow } from '../LogRow/LogRow'
import { VirtualList } from '../VirtualList/VirtualList'
import styles from './LogTable.module.css'

interface LogTableProps {
  events: LogEvent[]
  timeFormat: TimeFormat
  loading: boolean
}

const MemoizedLogRow = memo(LogRow)

const ROW_HEIGHT = 40

export function LogTable ({ events, timeFormat, loading }: LogTableProps) {
  // Store events/timeFormat in refs so renderItem stays referentially stable.
  // Refs are assigned synchronously during render — always current when
  // renderItem is called in the same render pass.
  const eventsRef = useRef(events)
  eventsRef.current = events
  const timeFormatRef = useRef(timeFormat)
  timeFormatRef.current = timeFormat

  const renderItem = useCallback(
    (index: number, onToggleExpand: (index: number) => void, isExpanded: boolean) => (
      <MemoizedLogRow
        event={eventsRef.current[index]}
        timeFormat={timeFormatRef.current}
        index={index}
        expanded={isExpanded}
        onToggle={onToggleExpand}
      />
    ),
    []
  )

  return (
    <div className={styles.container} role="table" aria-label="Log events">
      <div className={styles.header} role="row">
        <div className={styles.headerCell} role="columnheader">Time</div>
        <div className={styles.headerCell} role="columnheader">Event</div>
      </div>
      {events.length > 0 ? (
        <VirtualList
          itemCount={events.length}
          defaultItemHeight={ROW_HEIGHT}
          renderItem={renderItem}
        />
      ) : (
        !loading && (
          <div className={styles.empty}>No log events to display</div>
        )
      )}
    </div>
  )
}
