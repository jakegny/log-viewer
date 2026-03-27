import { memo } from 'react'
import { LogEvent, TimeFormat } from '../../types/LogEvent'
import { LogRow } from '../LogRow/LogRow'
import styles from './LogTable.module.css'

interface LogTableProps {
  events: LogEvent[]
  timeFormat: TimeFormat
  loading: boolean
}

const MemoizedLogRow = memo(LogRow)

export function LogTable ({ events, timeFormat, loading }: LogTableProps) {
  return (
    <div className={styles.container} role="table" aria-label="Log events">
      <div className={styles.header} role="row">
        <div className={styles.headerCell} role="columnheader">Time</div>
        <div className={styles.headerCell} role="columnheader">Event</div>
      </div>
      {events.map((event, index) => (
        <MemoizedLogRow
          key={`${event._time}-${index}`}
          event={event}
          timeFormat={timeFormat}
          index={index}
        />
      ))}
      {events.length === 0 && !loading && (
        <div className={styles.empty}>No log events to display</div>
      )}
    </div>
  )
}
