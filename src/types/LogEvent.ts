export interface LogEvent {
  readonly _time: number;
  readonly level?: string;
  readonly channel?: string;
  readonly message?: string;
  readonly [key: string]: unknown;
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

export function applyFacetFilter (events: readonly LogEvent[], filter: FacetFilter): readonly LogEvent[] {
  if (filter.levels.size === 0) return events
  return events.filter(e => filter.levels.has(e.level ?? ''))
}
