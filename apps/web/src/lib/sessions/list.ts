import {
  sessionResult,
  sessionTotals,
  staleSession,
  type SessionTotals,
  type StatsSession,
} from 'poker-core';
import { handTotals } from '@/lib/home/home';
import { isOneOf } from './form';
import { toStatsSession, type StatsRow } from './summary';

/** One line of the session list: the session plus what the list needs from its hands. */
export type SessionListItem = {
  session: StatsSession;
  handCount: number;
  /** Flagged hands with no accepted review yet. */
  toReview: number;
  /** Cash session still open: result of the hands so far (there is no cash-out yet). */
  live: { bb: number; money: number } | null;
  /** Free text of the debrief (`summary.notes`), searched with the venue. */
  notes: string;
  tournamentName: string | null;
  /** `created_at` of the newest hand, for the end-time suggestion of a forgotten session. */
  lastHandAt: string | null;
};

export type ListSessionRow = StatsRow & { summary: unknown };
export type ListHandRow = {
  id: string;
  session_id: string;
  result: number | null;
  level_bb: number | null;
  flagged: boolean;
  created_at?: string;
};

const record = (x: unknown): Record<string, unknown> =>
  x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {};

/** Joins sessions with their hands. `reviewedHandIds` = hands whose current review is accepted. */
export function buildListItems(
  rows: readonly ListSessionRow[],
  hands: readonly ListHandRow[],
  reviewedHandIds: ReadonlySet<string>,
): SessionListItem[] {
  const bySession = new Map<string, ListHandRow[]>();
  for (const h of hands) {
    const list = bySession.get(h.session_id);
    if (list) list.push(h);
    else bySession.set(h.session_id, [h]);
  }
  return rows.map((row) => {
    const own = bySession.get(row.id) ?? [];
    const session = toStatsSession(row);
    const notes = record(row.summary).notes;
    const name = record(row.mtt).name;
    return {
      session,
      handCount: own.length,
      toReview: own.filter((h) => h.flagged && !reviewedHandIds.has(h.id)).length,
      live:
        !session.endAt && session.kind === 'cash' && own.length > 0
          ? handTotals(own, session.bb)
          : null,
      notes: typeof notes === 'string' ? notes : '',
      tournamentName: typeof name === 'string' && name.trim() ? name.trim() : null,
      lastHandAt: own.reduce<string | null>(
        (best, h) => (h.created_at && (!best || h.created_at > best) ? h.created_at : best),
        null,
      ),
    };
  });
}

/** Open sessions left for more than 16 hours, each with the end time the app suggests. */
export function staleItems(
  items: readonly SessionListItem[],
  now: string,
): { item: SessionListItem; suggestedEnd: string }[] {
  return items.flatMap((item) => {
    const stale = staleSession(item.session, item.lastHandAt, now);
    return stale ? [{ item, suggestedEnd: stale.suggestedEnd }] : [];
  });
}

export type Net = { bb: number | null; money: number; currency: string };

/** Result shown on a row: the saved result, or for an open cash session what the hands add up to. */
export function sessionNet(item: SessionListItem): Net | null {
  const { session } = item;
  const result = sessionResult(session);
  if (result) return { bb: result.bb, money: result.money, currency: session.currency };
  if (item.live) return { ...item.live, currency: session.currency };
  return null;
}

// --- filter -----------------------------------------------------------------------------------

export const LIST_KINDS = ['all', 'cash', 'mtt'] as const;

export type ListFilter = {
  kind: (typeof LIST_KINDS)[number];
  /** `YYYY-MM`, or empty. */
  month: string;
  venue: string;
  win: boolean;
  loss: boolean;
  /** Only sessions with flagged hands that have no accepted review. */
  toReview: boolean;
  q: string;
};

export const EMPTY_FILTER: ListFilter = {
  kind: 'all',
  month: '',
  venue: '',
  win: false,
  loss: false,
  toReview: false,
  q: '',
};

export function isFiltering(f: ListFilter): boolean {
  return (
    f.kind !== 'all' || !!f.month || !!f.venue || f.win || f.loss || f.toReview || f.q.trim() !== ''
  );
}

/** Lower case, no accents: "Đối thủ" matches "doi thu". */
function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export const monthOf = (s: StatsSession): string => s.date.slice(0, 7);

export function filterItems(items: readonly SessionListItem[], f: ListFilter): SessionListItem[] {
  const venue = f.venue.trim().toLowerCase();
  const q = fold(f.q.trim());
  return items.filter((it) => {
    const s = it.session;
    if (f.kind !== 'all' && s.kind !== f.kind) return false;
    if (f.month && monthOf(s) !== f.month) return false;
    if (venue && (s.venue ?? '').trim().toLowerCase() !== venue) return false;
    if (f.toReview && it.toReview === 0) return false;
    if (f.win || f.loss) {
      // A session with no result yet is neither a win nor a loss.
      const money = sessionResult(s)?.money;
      if (money == null) return false;
      if (!((f.win && money > 0) || (f.loss && money < 0))) return false;
    }
    if (q) {
      const hay = fold([s.venue, it.notes, it.tournamentName].filter(Boolean).join(' '));
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** Months (newest first) and venues (case merged) that exist in the data, for the chip menus. */
export function listOptions(items: readonly SessionListItem[]): {
  months: string[];
  venues: string[];
} {
  const venues = new Map<string, string>();
  for (const it of items) {
    const v = it.session.venue?.trim();
    if (v && !venues.has(v.toLowerCase())) venues.set(v.toLowerCase(), v);
  }
  return {
    months: [...new Set(items.map((it) => monthOf(it.session)))].sort().reverse(),
    venues: [...venues.values()].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    ),
  };
}

// --- URL --------------------------------------------------------------------------------------

type Query = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseListFilter(q: Query): ListFilter {
  const kind = first(q.kind);
  const month = first(q.month) ?? '';
  return {
    kind: isOneOf(LIST_KINDS, kind) ? kind : 'all',
    month: /^\d{4}-\d{2}$/.test(month) ? month : '',
    venue: (first(q.venue) ?? '').trim().slice(0, 100),
    win: first(q.win) === '1',
    loss: first(q.loss) === '1',
    toReview: first(q.review) === '1',
    q: (first(q.q) ?? '').slice(0, 100),
  };
}

/** Query string without the leading `?`; defaults are left out. */
export function serializeListFilter(f: ListFilter): string {
  const p = new URLSearchParams();
  if (f.kind !== 'all') p.set('kind', f.kind);
  if (f.month) p.set('month', f.month);
  if (f.venue) p.set('venue', f.venue);
  if (f.win) p.set('win', '1');
  if (f.loss) p.set('loss', '1');
  if (f.toReview) p.set('review', '1');
  if (f.q.trim()) p.set('q', f.q);
  return p.toString();
}

// --- grouping and sorting ---------------------------------------------------------------------

export type MonthGroup = { month: string; items: SessionListItem[]; totals: SessionTotals };

/** Open sessions first, then one group per month, newest first (stable within a day). */
export function groupByMonth(items: readonly SessionListItem[]): {
  open: SessionListItem[];
  months: MonthGroup[];
} {
  const byDate = (a: SessionListItem, b: SessionListItem) =>
    b.session.date.localeCompare(a.session.date);
  const open = items.filter((it) => !it.session.endAt).sort(byDate);
  const groups = new Map<string, SessionListItem[]>();
  for (const it of [...items].filter((x) => x.session.endAt).sort(byDate)) {
    const m = monthOf(it.session);
    const list = groups.get(m);
    if (list) list.push(it);
    else groups.set(m, [it]);
  }
  return {
    open,
    months: [...groups]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, list]) => ({
        month,
        items: list,
        totals: sessionTotals(list.map((it) => it.session)),
      })),
  };
}

export const SORT_COLUMNS = [
  'date',
  'kind',
  'venue',
  'blind',
  'duration',
  'hands',
  'net',
  'bbPerHour',
  'review',
] as const;
export type SortColumn = (typeof SORT_COLUMNS)[number];
export type SortDir = 'asc' | 'desc';

function sortKey(it: SessionListItem, col: SortColumn): string | number | null {
  const s = it.session;
  switch (col) {
    case 'date':
      return s.date;
    case 'kind':
      return s.kind;
    case 'venue':
      return s.venue?.trim().toLowerCase() || null;
    case 'blind':
      return s.kind === 'cash' ? s.bb : s.buyin;
    case 'duration':
      return sessionTotals([s]).hours || null;
    case 'hands':
      return it.handCount;
    case 'net':
      return sessionNet(it)?.bb ?? null;
    case 'bbPerHour':
      return sessionTotals([s]).bbPerHour;
    case 'review':
      return it.toReview;
  }
}

/** Sorted copy. A row with no value in the column goes last, whichever way the sort runs. */
export function sortItems(
  items: readonly SessionListItem[],
  col: SortColumn,
  dir: SortDir,
): SessionListItem[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const x = sortKey(a, col);
    const y = sortKey(b, col);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    const c =
      typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
    return c * sign;
  });
}

// --- tiles ------------------------------------------------------------------------------------

export type MoneyLine = { currency: string; money: number };
export type NetTile = { main: { bb: number } | MoneyLine | null; sub: MoneyLine[] };

/**
 * The Net tile follows the kind filter: cash shows bb (money under it); all and MTT show money,
 * because bb of cash and prize money of MTT cannot be added.
 */
export function netTile(totals: SessionTotals, kind: ListFilter['kind']): NetTile {
  if (kind === 'cash') return { main: { bb: totals.netBb }, sub: totals.netMoney };
  const [first, ...rest] = totals.netMoney;
  return { main: first ?? null, sub: rest };
}
