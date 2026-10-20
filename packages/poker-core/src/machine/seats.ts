import type { Action, Actor, Position } from '../types';
import type { HandSetup } from './types';

const ORDERS: Record<number, readonly Position[]> = {
  2: ['BTN', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['CO', 'BTN', 'SB', 'BB'],
  5: ['HJ', 'CO', 'BTN', 'SB', 'BB'],
  6: ['LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  7: ['UTG', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  8: ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  9: ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  10: ['UTG', 'UTG+1', 'UTG+2', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
};

const clampSeats = (seats: number) => Math.min(10, Math.max(2, Math.round(seats)));

/** Seats in preflop acting order for a table of `seats` players (heads-up: the button is the small blind). */
export function tableOrder(seats: number): Position[] {
  return [...(ORDERS[clampSeats(seats)] ?? [])];
}

/** Heads-up the button posts the small blind, so the old name `SB` means `BTN` there. */
export function canonPos(seats: number, pos: Position): Position {
  return Math.round(seats) <= 2 && pos === 'SB' ? 'BTN' : pos;
}

/** Seats in postflop acting order: first left of the button, the button last (heads-up: BB first). */
export function postflopOrder(seats: number): Position[] {
  const order = tableOrder(seats);
  return clampSeats(seats) <= 2
    ? ['BB', 'BTN']
    : ['SB', 'BB', ...order.slice(0, order.indexOf('BTN')), 'BTN'];
}

/** How many straddles the table allows: from the seat left of the BB, never reaching the button. */
export function maxStraddles(seats: number): number {
  return Math.max(0, Math.min(3, clampSeats(seats) - 3));
}

/** Names used before 5.1c-5 that the table no longer has, by table size. */
const LEGACY: Record<number, Record<string, Position>> = {
  2: { SB: 'BTN' },
  5: { UTG: 'HJ' },
  6: { UTG: 'LJ', MP: 'HJ' },
  7: { MP: 'LJ' },
  8: { MP: 'LJ' },
};

/** Read a position saved under the old names on today's table of `seats`; anything else is unchanged. */
export function legacySeat(seats: number, pos: string): string {
  const n = clampSeats(seats);
  if ((tableOrder(n) as string[]).includes(pos)) return pos;
  return LEGACY[n]?.[pos] ?? pos;
}

/** Which of `picks` still sit at a table of `seats` players. No renaming: a seat that is gone is dropped. */
export function remapSeats(
  seats: number,
  picks: readonly Position[],
): { kept: Position[]; dropped: Position[] } {
  const order = tableOrder(seats);
  return {
    kept: picks.filter((p) => order.includes(p)),
    dropped: picks.filter((p) => !order.includes(p)),
  };
}

export function actorAt(setup: HandSetup, pos: Position): Actor {
  const p = canonPos(setup.seats, pos);
  if (p === canonPos(setup.seats, setup.heroPos)) return 'hero';
  if (p === canonPos(setup.seats, setup.villPos)) return 'villain';
  return 'other';
}

/** Forced bets as actions (DEC-045): antes, then SB, BB, then the straddles. */
export function forcedBets(setup: HandSetup): Action[] {
  const order = tableOrder(setup.seats);
  const make = (pos: Position, act: Action['act'], amount: number): Action => ({
    street: 'preflop',
    actor: actorAt(setup, pos),
    pos: canonPos(setup.seats, pos),
    act,
    amount,
  });
  const out: Action[] = [];

  const { ante } = setup;
  if (ante.mode === 'each' && ante.amount > 0) {
    for (const pos of order) out.push(make(pos, 'post_ante', ante.amount));
  } else if (ante.mode === 'bb' && ante.amount > 0) {
    out.push(make('BB', 'post_ante', ante.amount));
  }

  out.push(make('SB', 'post_sb', setup.sb));
  out.push(make('BB', 'post_bb', setup.bb));

  const levels = (setup.straddles ?? []).filter((n) => n > 0).slice(0, maxStraddles(setup.seats));
  levels.forEach((amount, i) => {
    const pos = order[i];
    if (pos) out.push(make(pos, 'post_straddle', amount));
  });
  return out;
}
