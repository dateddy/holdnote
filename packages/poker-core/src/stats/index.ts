import { roundMoney, toBb } from '../amount';

/** MTT result fields of a session (`sessions.mtt`). Money is in the session currency. */
export interface StatsMtt {
  reentries: number;
  prize: number | null;
  bounty: number | null;
  place: number | null;
  entries: number | null;
  bustStage: string | null;
}

/** The session columns the stats need, already parsed (numbers, not strings). */
export interface StatsSession {
  id: string;
  kind: 'cash' | 'mtt';
  mode: 'live' | 'online';
  venue: string | null;
  stakeLabel: string | null;
  currency: string;
  bb: number;
  /** `YYYY-MM-DD`. */
  date: string;
  startAt: string | null;
  endAt: string | null;
  buyin: number | null;
  cashout: number | null;
  stopLoss: number | null;
  selfState: string | null;
  mtt: StatsMtt | null;
}

export interface SessionResult {
  money: number;
  /** Null for MTT: blinds change every level, so one bb does not exist. */
  bb: number | null;
}

/** Cash: cash-out − buy-in. MTT: prize + bounty − buy-in × (1 + re-entries). Null when not recorded. */
export function sessionResult(s: StatsSession): SessionResult | null {
  if (s.buyin == null) return null;
  if (s.kind === 'cash') {
    if (s.cashout == null) return null;
    const money = roundMoney(s.cashout - s.buyin);
    return { money, bb: toBb(money, s.bb) };
  }
  if (!s.mtt || s.mtt.prize == null) return null;
  const cost = s.buyin * (1 + s.mtt.reentries);
  return { money: roundMoney(s.mtt.prize + (s.mtt.bounty ?? 0) - cost), bb: null };
}

/** Cash only, and only when both start and end time exist (spec 6). */
export function bbPerHour(s: StatsSession): number | null {
  if (s.kind !== 'cash' || !s.startAt || !s.endAt) return null;
  const result = sessionResult(s);
  if (!result || result.bb == null) return null;
  const hours = (Date.parse(s.endAt) - Date.parse(s.startAt)) / 3_600_000;
  if (!Number.isFinite(hours) || hours <= 0) return null;
  return roundMoney(result.bb / hours);
}

/** Cash session whose loss went past the stop-loss (a loss equal to it is not a breach). */
export function stopLossBreached(s: StatsSession): boolean {
  if (s.kind !== 'cash' || s.stopLoss == null || s.stopLoss <= 0) return false;
  const result = sessionResult(s);
  return !!result && -result.money > s.stopLoss;
}

export interface MttGroup {
  currency: string;
  count: number;
  cost: number;
  returned: number;
  /** (returned − cost) / cost, as a ratio. */
  roi: number;
  /** Share of tournaments with a prize, 0–100. */
  itmPct: number;
  topBustStage: string | null;
}

/** MTT sessions with a result, grouped by currency (money of different currencies never adds up). */
export function mttStats(sessions: StatsSession[]): MttGroup[] {
  const groups = new Map<string, StatsSession[]>();
  for (const s of sessions) {
    if (s.kind !== 'mtt' || !sessionResult(s)) continue;
    groups.set(s.currency, [...(groups.get(s.currency) ?? []), s]);
  }
  return [...groups].map(([currency, list]) => {
    let cost = 0;
    let returned = 0;
    let itm = 0;
    const stages = new Map<string, number>();
    for (const s of list) {
      const m = s.mtt!;
      cost += (s.buyin ?? 0) * (1 + m.reentries);
      returned += (m.prize ?? 0) + (m.bounty ?? 0);
      if ((m.prize ?? 0) > 0) itm += 1;
      if (m.bustStage) stages.set(m.bustStage, (stages.get(m.bustStage) ?? 0) + 1);
    }
    const top = [...stages].sort((a, b) => b[1] - a[1])[0];
    return {
      currency,
      count: list.length,
      cost: roundMoney(cost),
      returned: roundMoney(returned),
      roi: cost > 0 ? (returned - cost) / cost : 0,
      itmPct: (itm / list.length) * 100,
      topBustStage: top ? top[0] : null,
    };
  });
}

export interface LeakRow {
  sessionId: string;
  tag: string;
  /** 0 for tags that only come from the session summary. */
  handCount: number;
}

export interface LeakLine {
  tag: string;
  hands: number;
  sessions: number;
  /** One flag per recent session, oldest to newest: did the tag show up. */
  trend: boolean[];
  /** At least 3 of the last 5 sessions (spec 6). */
  repeated: boolean;
}

export const LEAK_WINDOW = 5;
const REPEAT_MIN = 3;

export function leakTable(rows: LeakRow[], sessions: { id: string; date: string }[]): LeakLine[] {
  const ordered = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const known = new Set(ordered.map((s) => s.id));
  const recent = ordered.slice(-LEAK_WINDOW).map((s) => s.id);

  const byTag = new Map<string, { hands: number; sessions: Set<string> }>();
  for (const r of rows) {
    if (!known.has(r.sessionId)) continue;
    const entry = byTag.get(r.tag) ?? { hands: 0, sessions: new Set<string>() };
    entry.hands += r.handCount;
    entry.sessions.add(r.sessionId);
    byTag.set(r.tag, entry);
  }

  return [...byTag]
    .map(([tag, e]) => {
      const trend = recent.map((id) => e.sessions.has(id));
      return {
        tag,
        hands: e.hands,
        sessions: e.sessions.size,
        trend,
        repeated: trend.filter(Boolean).length >= REPEAT_MIN,
      };
    })
    .sort((a, b) => b.sessions - a.sessions || b.hands - a.hands || a.tag.localeCompare(b.tag));
}

export interface SeriesPoint {
  sessionId: string;
  date: string;
  value: number;
  cumulative: number;
}

/** Running total by date. Sessions with no result for the chosen unit are left out. */
export function cumulativeSeries(sessions: StatsSession[], unit: 'bb' | 'money'): SeriesPoint[] {
  const ordered = [...sessions].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.startAt ?? '').localeCompare(b.startAt ?? ''),
  );
  const points: SeriesPoint[] = [];
  let total = 0;
  for (const s of ordered) {
    const result = sessionResult(s);
    const value = unit === 'bb' ? result?.bb : result?.money;
    if (value == null) continue;
    total = roundMoney(total + value);
    points.push({ sessionId: s.id, date: s.date, value, cumulative: total });
  }
  return points;
}

export interface Discipline {
  sessions: number;
  stopLossBreaches: number;
  tiltSessions: number;
}

export function disciplineStats(sessions: StatsSession[]): Discipline {
  return {
    sessions: sessions.length,
    stopLossBreaches: sessions.filter(stopLossBreached).length,
    tiltSessions: sessions.filter((s) => s.selfState === 'tilt').length,
  };
}
