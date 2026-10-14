import { sessionResult, type StatsSession } from 'poker-core';
import { isOneOf } from '@/lib/sessions/form';

export const KIND_FILTERS = ['all', 'cash', 'mtt'] as const;
export const MODE_FILTERS = ['all', 'live', 'online'] as const;
export const UNITS = ['bb', 'money'] as const;

export type StatsFilters = {
  kind: (typeof KIND_FILTERS)[number];
  mode: (typeof MODE_FILTERS)[number];
  venue: string;
  stake: string;
  currency: string;
  /** Null = pick by the other filters. */
  unit: (typeof UNITS)[number] | null;
};

type Query = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

/** Filters from the page's search params; anything unknown is ignored. */
export function parseFilters(q: Query): StatsFilters {
  const kind = first(q.kind);
  const mode = first(q.mode);
  const unit = first(q.unit);
  return {
    kind: isOneOf(KIND_FILTERS, kind) ? kind : 'all',
    mode: isOneOf(MODE_FILTERS, mode) ? mode : 'all',
    venue: (first(q.venue) ?? '').trim().slice(0, 100),
    stake: (first(q.stake) ?? '').trim().slice(0, 50),
    currency: (first(q.currency) ?? '').trim().slice(0, 8),
    unit: isOneOf(UNITS, unit) ? unit : null,
  };
}

export function filterSessions(list: StatsSession[], f: StatsFilters): StatsSession[] {
  const venue = f.venue.toLowerCase();
  return list.filter(
    (s) =>
      (f.kind === 'all' || s.kind === f.kind) &&
      (f.mode === 'all' || s.mode === f.mode) &&
      (!venue || (s.venue ?? '').trim().toLowerCase() === venue) &&
      (!f.stake || s.stakeLabel === f.stake) &&
      (!f.currency || s.currency === f.currency),
  );
}

/** Values for the filter selects. Venues are free text, so they are merged ignoring case. */
export function filterOptions(list: StatsSession[]) {
  const venues = new Map<string, string>();
  for (const s of list) {
    const v = s.venue?.trim();
    if (v && !venues.has(v.toLowerCase())) venues.set(v.toLowerCase(), v);
  }
  const uniq = (xs: (string | null)[]) =>
    [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b));
  return {
    venues: [...venues.values()].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    ),
    stakes: uniq(list.map((s) => s.stakeLabel)),
    currencies: uniq(list.map((s) => s.currency)),
  };
}

export type ResultsView = {
  unit: 'bb' | 'money';
  /** Set for the money view: money of different currencies never adds up (DEC-014). */
  currency: string | null;
  sessions: StatsSession[];
  /** Sessions in the view that have no result yet. */
  missing: number;
};

/**
 * What the cumulative chart plots. bb view: cash sessions only (an MTT has no single bb). Money
 * view: one currency, the chosen one or else the most common among sessions with a result.
 */
export function resolveView(filtered: StatsSession[], f: StatsFilters): ResultsView {
  const unit = f.unit ?? (f.kind === 'mtt' ? 'money' : 'bb');
  if (unit === 'bb') {
    const sessions = filtered.filter((s) => s.kind === 'cash');
    return {
      unit,
      currency: null,
      sessions,
      missing: sessions.filter((s) => !sessionResult(s)).length,
    };
  }

  let currency = f.currency || null;
  if (!currency) {
    const counts = new Map<string, number>();
    for (const s of filtered) {
      if (sessionResult(s)) counts.set(s.currency, (counts.get(s.currency) ?? 0) + 1);
    }
    currency = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
  }
  const sessions = currency ? filtered.filter((s) => s.currency === currency) : [];
  return { unit, currency, sessions, missing: sessions.filter((s) => !sessionResult(s)).length };
}
