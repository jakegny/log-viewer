import { TimeFormat } from '../types/LogEvent';

export function formatTime(
  epochMs: number,
  format: TimeFormat = 'utc'
): string {
  const date = new Date(epochMs);

  if (format === 'utc') {
    return date.toISOString();
  }

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
}
