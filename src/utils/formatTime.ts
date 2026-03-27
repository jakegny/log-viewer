import { TimeFormat } from '../types/LogEvent';

export function formatTime(
  epochMs: number,
  format: TimeFormat = 'utc'
): string {
  const date = new Date(epochMs);

  if (format === 'utc') {
    return date.toISOString();
  }

  // Use 24-hour format for compact, log-viewer-friendly local time
  // e.g. "2024-08-22 05:46:52.592" — same length as ISO 8601 minus the T and Z
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${y}-${mo}-${d} ${h}:${mi}:${s}.${ms}`;
}
