import { useState, useCallback, useMemo } from 'react'
import { TimeFormat } from './types/LogEvent'
import { useLogStream } from './hooks/useLogStream'
import { Header } from './components/Header/Header'
import { LogTable } from './components/LogTable/LogTable'
import { Timeline, TimeRange } from './components/Timeline/Timeline'
import { ErrorBanner } from './components/ErrorBanner/ErrorBanner'
import './styles.css'

const DEFAULT_URL = 'https://s3.amazonaws.com/io.cribl.c021.takehome/cribl.log'

export default function App () {
  const [urlInput, setUrlInput] = useState(DEFAULT_URL)
  const [activeUrl, setActiveUrl] = useState(DEFAULT_URL)
  const [timeFormat, setTimeFormat] = useState<TimeFormat>('utc')
  const [timeRange, setTimeRange] = useState<TimeRange | null>(null)

  const {
    events,
    loading,
    error,
    bytesReceived,
    malformedCount,
    autoRetryAttempt,
    retry
  } = useLogStream(activeUrl)

  // Filter events by selected time range
  const filteredEvents = useMemo(() => {
    if (!timeRange) return events
    return events.filter(
      e => e._time >= timeRange.start && e._time <= timeRange.end
    )
  }, [events, timeRange])

  const handleTimeFormatToggle = useCallback(() => {
    setTimeFormat(prev => (prev === 'utc' ? 'local' : 'utc'))
  }, [])

  const handleUrlSubmit = useCallback(() => {
    setActiveUrl(urlInput)
    setTimeRange(null)
  }, [urlInput])

  return (
    <>
      <Header
        url={urlInput}
        onUrlChange={setUrlInput}
        onUrlSubmit={handleUrlSubmit}
        loading={loading}
        eventCount={filteredEvents.length}
        malformedCount={malformedCount}
        bytesReceived={bytesReceived}
        timeFormat={timeFormat}
        onTimeFormatToggle={handleTimeFormatToggle}
        autoRetryAttempt={autoRetryAttempt}
      />
      {error && <ErrorBanner error={error} onRetry={retry} />}
      <Timeline
        events={events}
        selectedRange={timeRange}
        onRangeChange={setTimeRange}
      />
      <LogTable events={filteredEvents} timeFormat={timeFormat} loading={loading} />
    </>
  )
}
