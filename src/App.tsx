import { useState, useCallback } from 'react'
import { TimeFormat } from './types/LogEvent'
import { useLogStream } from './hooks/useLogStream'
import { Header } from './components/Header/Header'
import { LogTable } from './components/LogTable/LogTable'
import { ErrorBanner } from './components/ErrorBanner/ErrorBanner'
import './styles.css'

const DEFAULT_URL = 'https://s3.amazonaws.com/io.cribl.c021.takehome/cribl.log'

export default function App () {
  const [urlInput, setUrlInput] = useState(DEFAULT_URL)
  const [activeUrl, setActiveUrl] = useState(DEFAULT_URL)
  const [timeFormat, setTimeFormat] = useState<TimeFormat>('utc')

  const {
    events,
    loading,
    error,
    bytesReceived,
    malformedCount,
    autoRetryAttempt,
    retry
  } = useLogStream(activeUrl)

  const handleTimeFormatToggle = useCallback(() => {
    setTimeFormat(prev => (prev === 'utc' ? 'local' : 'utc'))
  }, [])

  const handleUrlSubmit = useCallback(() => {
    setActiveUrl(urlInput)
  }, [urlInput])

  return (
    <>
      <Header
        url={urlInput}
        onUrlChange={setUrlInput}
        onUrlSubmit={handleUrlSubmit}
        loading={loading}
        eventCount={events.length}
        malformedCount={malformedCount}
        bytesReceived={bytesReceived}
        timeFormat={timeFormat}
        onTimeFormatToggle={handleTimeFormatToggle}
        autoRetryAttempt={autoRetryAttempt}
      />
      {error && <ErrorBanner error={error} onRetry={retry} />}
      <LogTable events={events} timeFormat={timeFormat} loading={loading} />
    </>
  )
}
