import { useCallback } from 'react'
import { TimeFormat } from '../../types/LogEvent'
import styles from './Header.module.css'

interface HeaderProps {
  url: string
  onUrlChange: (url: string) => void
  onUrlSubmit: () => void
  loading: boolean
  eventCount: number
  malformedCount: number
  bytesReceived: number
  timeFormat: TimeFormat
  onTimeFormatToggle: () => void
  autoRetryAttempt: number
}

function formatBytes (bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function Header ({
  url,
  onUrlChange,
  onUrlSubmit,
  loading,
  eventCount,
  malformedCount,
  bytesReceived,
  timeFormat,
  onTimeFormatToggle,
  autoRetryAttempt
}: HeaderProps) {
  const handleUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUrlChange(e.target.value)
    },
    [onUrlChange]
  )

  const handleUrlKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        onUrlSubmit()
      }
    },
    [onUrlSubmit]
  )

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>Cribl Log Viewer</h1>
      <input
        className={styles.urlInput}
        type="url"
        value={url}
        onChange={handleUrlChange}
        onKeyDown={handleUrlKeyDown}
        placeholder="Enter NDJSON log URL, press Enter to load..."
        aria-label="Log file URL"
      />
      {loading && <div className={styles.spinner} aria-label="Loading" />}
      {autoRetryAttempt > 0 && (
        <span className={styles.stats}>
          Retry {autoRetryAttempt}/3...
        </span>
      )}
      <div className={styles.stats}>
        <span>{eventCount} events</span>
        <span>{formatBytes(bytesReceived)}</span>
        {malformedCount > 0 && (
          <span className={styles.malformed}>
            {malformedCount} malformed
          </span>
        )}
      </div>
      <button
        className={`${styles.toggleBtn} ${timeFormat === 'local' ? styles.toggleBtnActive : ''}`}
        onClick={onTimeFormatToggle}
        title={`Currently showing ${timeFormat === 'utc' ? 'UTC' : 'local'} time. Click to switch.`}
      >
        {timeFormat === 'utc' ? 'UTC' : 'Local'}
      </button>
    </header>
  )
}
