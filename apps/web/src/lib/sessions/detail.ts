import { bbPerHour, roundMoney, sessionHours, sessionResult, type StatsSession } from 'poker-core';
import type { HandRow } from '@/lib/hands/session-hands';
import type { SessionSummary } from './summary';

export type CashTiles = {
  kind: 'cash';
  /** Played so far (open session) or the whole session; null without a start time. */
  hours: number | null;
  hands: number;
  net: { bb: number; money: number } | null;
  /** Only for an ended session with both times. */
  rate: number | null;
  toReview: number;
};

export type MttTiles = {
  kind: 'mtt';
  buyin: number | null;
  reentries: number;
  place: number | null;
  entries: number | null;
  /** Prize plus bounty; null until the result is entered. */
  prize: number | null;
  bounty: number | null;
  toReview: number;
};

/** The four tiles on top of the session detail. `now` comes from the server (ISO time). */
export function detailTiles(
  session: StatsSession,
  rows: readonly HandRow[],
  now: string,
): CashTiles | MttTiles {
  const toReview = rows.filter((r) => r.needsReview).length;

  if (session.kind === 'mtt') {
    const m = session.mtt;
    const prize = m?.prize == null ? null : roundMoney(m.prize + (m.bounty ?? 0));
    return {
      kind: 'mtt',
      buyin: session.buyin,
      reentries: m?.reentries ?? 0,
      place: m?.place ?? null,
      entries: m?.entries ?? null,
      prize,
      bounty: m?.bounty ?? null,
      toReview,
    };
  }

  const ended = Boolean(session.endAt);
  const elapsed =
    ended || !session.startAt
      ? sessionHours(session)
      : (Date.parse(now) - Date.parse(session.startAt)) / 3_600_000;
  const final = ended ? sessionResult(session) : null;
  const known = rows.filter((r) => r.result != null);
  const net =
    final?.bb != null
      ? { bb: final.bb, money: final.money }
      : known.length > 0
        ? {
            bb: roundMoney(known.reduce((sum, r) => sum + (r.resultBb ?? 0), 0)),
            money: roundMoney(known.reduce((sum, r) => sum + (r.result ?? 0), 0)),
          }
        : null;
  return {
    kind: 'cash',
    hours: elapsed != null && Number.isFinite(elapsed) && elapsed > 0 ? elapsed : null,
    hands: rows.length,
    net,
    rate: ended ? bbPerHour(session) : null,
    toReview,
  };
}

export type SessionStage = 'notStarted' | 'playing' | 'ended' | 'summarized';

/** Where the session stands; decides which buttons the detail page offers. */
export function sessionStage(
  session: Pick<StatsSession, 'startAt' | 'endAt'>,
  summary: SessionSummary,
): SessionStage {
  if (!session.startAt && !session.endAt) return 'notStarted';
  if (!session.endAt) return 'playing';
  const done =
    summary.grade != null ||
    summary.good.length > 0 ||
    summary.leak_tags.length > 0 ||
    summary.rules.length > 0 ||
    summary.notes.trim() !== '';
  return done ? 'summarized' : 'ended';
}
