import type { Action, Actor, Position } from '../types';
import type { HandSetup } from './types';

const ORDERS: Record<number, readonly Position[]> = {
  2: ['SB', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['CO', 'BTN', 'SB', 'BB'],
  5: ['UTG', 'CO', 'BTN', 'SB', 'BB'],
  6: ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB'],
  7: ['UTG', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  8: ['UTG', 'UTG+1', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  9: ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
};

/** Seats in preflop acting order for a table of `seats` players (heads-up: SB is the button). */
export function tableOrder(seats: number): Position[] {
  const n = Math.min(9, Math.max(2, Math.round(seats)));
  return [...(ORDERS[n] ?? ORDERS[9] ?? [])];
}

/** Heads-up the button is the small blind. */
export function canonPos(seats: number, pos: Position): Position {
  return Math.round(seats) <= 2 && pos === 'BTN' ? 'SB' : pos;
}

/** How many straddles the table allows: from the seat left of the BB, never reaching the button. */
export function maxStraddles(seats: number): number {
  return Math.max(0, Math.min(3, Math.min(9, Math.round(seats)) - 3));
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
    pos,
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
