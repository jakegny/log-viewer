import { useState, useCallback, useEffect } from 'react'
import styles from './ErrorBanner.module.css'

interface ErrorBannerProps {
  error: Error
  onRetry: () => void
}

export function ErrorBanner ({ error, onRetry }: ErrorBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setDismissed(false)
  }, [error])

  const handleDismiss = useCallback(() => {
    setDismissed(true)
  }, [])

  if (dismissed) return null

  return (
    <div className={styles.banner} role="alert">
      <span className={styles.message}>{error.message}</span>
      <button className={styles.retryBtn} onClick={onRetry}>
        Retry
      </button>
      <button
        className={styles.dismissBtn}
        onClick={handleDismiss}
        aria-label="Dismiss error"
      >
        x
      </button>
    </div>
  )
}
