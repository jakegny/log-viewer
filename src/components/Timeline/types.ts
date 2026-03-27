export interface TimeRange {
  readonly start: number
  readonly end: number
}

export interface TimeExtent {
  readonly minTime: number
  readonly maxTime: number
}

export interface LevelCounts {
  readonly error: number
  readonly warn: number
  readonly info: number
  readonly other: number
}

export interface Bucket {
  readonly startTime: number
  readonly endTime: number
  readonly count: number
  readonly levels: LevelCounts
}

// Stacking order: error on top (most visible), then warn, info, other at base
export const LEVEL_STACK: readonly (keyof LevelCounts)[] = ['other', 'info', 'warn', 'error']

export const LEVEL_COLORS: Record<keyof LevelCounts, string> = {
  error: '#ff6b6b',
  warn: '#dcdcaa',
  info: '#4fc1ff',
  other: '#64748b'
}
