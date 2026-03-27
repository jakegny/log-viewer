export interface LogEvent {
  _time: number;
  level?: string;
  channel?: string;
  message?: string;
  [key: string]: unknown;
}

export type TimeFormat = 'utc' | 'local';

/**
 * Faceted filter state — extensible for future filter types.
 *
 * Pattern: Datadog-style faceted search.
 *  - OR within a facet: event matches if its value is in the selected set
 *  - AND across facets: event must match ALL facets
 *  - Empty set = no filter (show all)
 */
export interface FacetFilter {
  readonly levels: ReadonlySet<string>
  // Future facets:
  // readonly channels: ReadonlySet<string>
  // readonly search: string
}

export const EMPTY_FILTER: FacetFilter = {
  levels: new Set()
}

export function applyFacetFilter (events: readonly LogEvent[], filter: FacetFilter): LogEvent[] {
  let result = events as LogEvent[]
  if (filter.levels.size > 0) {
    result = result.filter(e => filter.levels.has(e.level ?? ''))
  }
  return result
}

export interface StreamState {
  events: LogEvent[];
  loading: boolean;
  error: Error | null;
  bytesReceived: number;
  malformedCount: number;
}
