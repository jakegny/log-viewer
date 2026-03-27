export interface LogEvent {
  _time: number;
  level?: string;
  channel?: string;
  message?: string;
  [key: string]: unknown;
}

export type TimeFormat = 'utc' | 'local';

export interface StreamState {
  events: LogEvent[];
  loading: boolean;
  error: Error | null;
  bytesReceived: number;
  malformedCount: number;
}
