/**
 * Smart time axis utilities.
 *
 * Generates human-readable tick positions that snap to round time
 * boundaries (seconds, minutes, hours, days) based on the visible
 * time span. Adapts label format to the zoom level.
 */

const NICE_INTERVALS = [
  1000,             // 1s
  5000,             // 5s
  10000,            // 10s
  30000,            // 30s
  60000,            // 1m
  300000,           // 5m
  600000,           // 10m
  900000,           // 15m
  1800000,          // 30m
  3600000,          // 1h
  7200000,          // 2h
  14400000,         // 4h
  21600000,         // 6h
  43200000,         // 12h
  86400000,         // 1d
  172800000,        // 2d
  432000000,        // 5d
  604800000,        // 7d
  1209600000,       // 14d
  2592000000        // 30d
]

function pickTickInterval (spanMs: number, maxTicks: number): number {
  const idealInterval = spanMs / maxTicks
  for (const interval of NICE_INTERVALS) {
    if (interval >= idealInterval) return interval
  }
  return NICE_INTERVALS[NICE_INTERVALS.length - 1]
}

export function generateTimeTicks (minTime: number, maxTime: number, maxTicks: number): number[] {
  const span = maxTime - minTime
  if (span <= 0) return [minTime]

  const interval = pickTickInterval(span, maxTicks)
  const firstTick = Math.ceil(minTime / interval) * interval
  const ticks: number[] = []
  for (let t = firstTick; t <= maxTime; t += interval) {
    ticks.push(t)
  }
  return ticks
}

export function formatTickLabel (epochMs: number, spanMs: number): string {
  const d = new Date(epochMs)
  const pad = (n: number) => String(n).padStart(2, '0')
  const M = pad(d.getUTCMonth() + 1)
  const D = pad(d.getUTCDate())
  const h = pad(d.getUTCHours())
  const m = pad(d.getUTCMinutes())
  const s = pad(d.getUTCSeconds())

  if (spanMs > 172800000) return `${M}-${D}`
  if (spanMs > 7200000) return `${M}-${D} ${h}:${m}`
  if (spanMs > 120000) return `${h}:${m}`
  return `${h}:${m}:${s}`
}

export function generateYTicks (maxCount: number, count: number): number[] {
  if (maxCount === 0) return [0]
  const ticks: number[] = []
  let prev = -1
  for (let i = 0; i <= count; i++) {
    const val = Math.round((maxCount / count) * i)
    if (val !== prev) {
      ticks.push(val)
      prev = val
    }
  }
  return ticks
}

export function toDatetimeLocal (epochMs: number): string {
  const d = new Date(epochMs)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
}

export function formatTooltipTime (epochMs: number): string {
  return new Date(epochMs).toISOString().replace('T', ' ').replace('Z', '')
}
