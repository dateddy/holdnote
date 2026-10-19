import {
  canonPos,
  maxStraddles,
  parseAmount,
  POSITIONS,
  remapSeats,
  type Position,
} from 'poker-core';
import { isOneOf } from '@/lib/sessions/form';
import { pickedOpponents, withOpponents, type HandDraft, type HandSession } from './build';

export const STAGES = [
  'early',
  'mid',
  'near_bubble',
  'bubble',
  'itm',
  'final_table',
  'heads_up',
] as const;

/** A saved opponent that can be attached to a seat. */
export type OpponentOption = { id: string; name: string; sameVenue: boolean };

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;

/** Players dealt in this hand: the draft's count, else the session's, else 9. */
export function playersOf(session: Pick<HandSession, 'seats'>, draft: HandDraft): number {
  const n = Number(draft.playersDealt.trim());
  const dealt = Number.isInteger(n) && n >= MIN_PLAYERS ? Math.min(MAX_PLAYERS, n) : null;
  return dealt ?? session.seats ?? 9;
}

/** Move hero to `pos`. A seat that was an opponent stops being one. */
export function pickHero(draft: HandDraft, pos: Position): HandDraft {
  const rest = pickedOpponents(draft).filter((o) => o.pos !== pos);
  return withOpponents({ ...draft, heroPos: pos }, rest);
}

/** Tap a seat on the opponent bar: pick it, or drop it when it is already picked. Hero's seat never is. */
export function toggleOpponent(draft: HandDraft, pos: Position): HandDraft {
  if (draft.heroPos === pos) return draft;
  const list = pickedOpponents(draft);
  return withOpponents(
    draft,
    list.some((o) => o.pos === pos)
      ? list.filter((o) => o.pos !== pos)
      : [...list, { pos, stack: '', opponentId: '' }],
  );
}

export function setOpponentStack(draft: HandDraft, pos: string, stack: string): HandDraft {
  return withOpponents(
    draft,
    pickedOpponents(draft).map((o) => (o.pos === pos ? { ...o, stack } : o)),
  );
}

/**
 * Attach a saved opponent to a seat (`id` empty = detach). His stack from the last time they met
 * fills the seat when it has none yet. The same person cannot sit on two seats.
 */
export function nameOpponent(
  draft: HandDraft,
  pos: string,
  id: string,
  lastStack?: number,
): HandDraft {
  return withOpponents(
    draft,
    pickedOpponents(draft).map((o) => {
      if (o.pos === pos) {
        return {
          ...o,
          opponentId: id,
          stack: id && !o.stack.trim() && lastStack !== undefined ? String(lastStack) : o.stack,
        };
      }
      return id && o.opponentId === id ? { ...o, opponentId: '' } : o;
    }),
  );
}

/**
 * New head count. Seats that still exist stay picked; the others are dropped (not renamed) and
 * listed so the screen can ask to pick again. The straddle chain is cut to what the table allows.
 */
export function setPlayers(
  session: HandSession,
  draft: HandDraft,
  n: number,
): { draft: HandDraft; dropped: Position[] } {
  const count = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, Math.round(n)));
  const opponents = pickedOpponents(draft);
  const known = (p: string): p is Position => isOneOf(POSITIONS, p);
  const picks = [draft.heroPos, ...opponents.map((o) => o.pos)].filter(known);
  const canon = (p: Position) => canonPos(count, p);
  const { kept } = remapSeats(count, picks.map(canon));
  const stays = (p: string) => known(p) && kept.includes(canon(p));

  const next: HandDraft = {
    ...draft,
    playersDealt: String(count),
    heroPos: stays(draft.heroPos) ? draft.heroPos : '',
    straddles:
      session.kind === 'cash' ? draft.straddles.slice(0, maxStraddles(count)) : draft.straddles,
  };
  return {
    draft: withOpponents(
      next,
      opponents.filter((o) => stays(o.pos)),
    ),
    dropped: picks.filter((p) => !stays(p)),
  };
}

/** Straddle on (one house) or off. Locked, so off, when the table cannot have one. */
export function setStraddleCount(
  session: HandSession,
  draft: HandDraft,
  players: number,
  count: number,
  bb: number,
): HandDraft {
  const n = Math.min(count, maxStraddles(players));
  const next = draft.straddles.slice(0, n);
  while (next.length < n) {
    const last = parseAmount(next[next.length - 1] ?? '') ?? bb;
    next.push(String(last * 2));
  }
  return { ...draft, straddles: session.kind === 'cash' ? next : [] };
}

/** Opponents that are not on a seat yet, same venue first, then by name. */
export function sortOpponents<T extends { name: string; sameVenue: boolean }>(list: T[]): T[] {
  return [...list].sort(
    (a, b) => Number(b.sameVenue) - Number(a.sameVenue) || a.name.localeCompare(b.name),
  );
}
