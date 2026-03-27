import { useState, useCallback, useMemo } from 'react'
import { TimeFormat, FacetFilter, EMPTY_FILTER, applyFacetFilter } from './types/LogEvent'
import { useLogStream } from './hooks/useLogStream'
import { Header } from './components/Header/Header'
import { LogTable } from './components/LogTable/LogTable'
import { Timeline, TimeRange } from './components/Timeline/Timeline'
import { FilterBar } from './components/FilterBar/FilterBar'
import { ErrorBanner } from './components/ErrorBanner/ErrorBanner'
import './styles.css'

const DEFAULT_URL = 'https://s3.amazonaws.com/io.cribl.c021.takehome/cribl.log'

export default function App () {
  const [urlInput, setUrlInput] = useState(DEFAULT_URL)
  const [activeUrl, setActiveUrl] = useState(DEFAULT_URL)
  const [timeFormat, setTimeFormat] = useState<TimeFormat>('utc')
  const [timeRange, setTimeRange] = useState<TimeRange | null>(null)
  const [facetFilter, setFacetFilter] = useState<FacetFilter>(EMPTY_FILTER)

  const {
    events,
    loading,
    error,
    bytesReceived,
    malformedCount,
    autoRetryAttempt,
    retry
  } = useLogStream(activeUrl)

  // Facet-only filtered events (no time range) — for Timeline
  const facetFilteredEvents = useMemo(
    () => applyFacetFilter(events, facetFilter),
    [events, facetFilter]
  )

  // Time-range filtered events (no facet) — for FilterBar counts
  const timeFilteredEvents = useMemo(() => {
    if (!timeRange) return events
    return events.filter(
      e => e._time >= timeRange.start && e._time <= timeRange.end
    )
  }, [events, timeRange])

  // Both filters applied — for LogTable
  const filteredEvents = useMemo(
    () => applyFacetFilter(timeFilteredEvents, facetFilter),
    [timeFilteredEvents, facetFilter]
  )

  const handleTimeFormatToggle = useCallback(() => {
    setTimeFormat(prev => (prev === 'utc' ? 'local' : 'utc'))
  }, [])

  const handleUrlSubmit = useCallback(() => {
    setActiveUrl(urlInput)
    setTimeRange(null)
    setFacetFilter(EMPTY_FILTER)
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
        events={facetFilteredEvents}
        selectedRange={timeRange}
        onRangeChange={setTimeRange}
      />
      <FilterBar
        events={timeFilteredEvents}
        filter={facetFilter}
        onFilterChange={setFacetFilter}
      />
      <LogTable events={filteredEvents} timeFormat={timeFormat} loading={loading} />
    </>
  )
}
