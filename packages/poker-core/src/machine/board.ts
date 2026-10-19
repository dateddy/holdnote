import { STREETS, type Street } from '../types';
import type { HandState } from './types';

/** Board cards the betting has reached: none before the flop, then 3, 4, 5. */
const CARDS_FOR: Record<Street, number> = { preflop: 0, flop: 3, turn: 4, river: 5 };

/**
 * The street the betting is on, or the last one with a valid action once the hand is over.
 * (A run-out after an all-in does not move it: nobody acts on the later streets.)
 */
export function reachedStreet(state: HandState): Street {
  if (state.phase.kind === 'act') return state.phase.street;
  const skip = new Set(state.invalid);
  let last: Street = 'preflop';
  state.actions.forEach((a, i) => {
    if (a.act === 'dead' || a.act.startsWith('post_') || skip.has(i)) return;
    if (STREETS.indexOf(a.street) > STREETS.indexOf(last)) last = a.street;
  });
  return last;
}

/** Cards the board should hold now. A run-out or showdown needs all five. */
export function boardNeeded(state: HandState): number {
  if (state.phase.kind === 'runout' || state.phase.kind === 'showdown') return 5;
  return CARDS_FOR[reachedStreet(state)];
}

export type SlotState =
  /** Beyond the street reached and empty: not open yet. */
  | 'locked'
  /** Needed and filled. */
  | 'open'
  /** Needed and still empty: remind the player, never block. */
  | 'missing'
  /** Filled but beyond the street reached (too many cards for this hand). */
  | 'extra';

export interface BoardCheck {
  /** One state per board slot: flop 1-3, turn, river. */
  slots: SlotState[];
  needed: number;
  missing: number;
  extra: number;
}

/**
 * How the five board slots stand against the betting. Nothing is ever removed: a card that no
 * longer belongs (an action edit cut the hand short) is `extra`, and the player decides.
 */
export function boardCheck(state: HandState, slots: readonly string[]): BoardCheck {
  const needed = boardNeeded(state);
  let missing = 0;
  let extra = 0;
  const out: SlotState[] = Array.from({ length: 5 }, (_, i) => {
    const filled = Boolean(slots[i]);
    if (i < needed) {
      if (filled) return 'open';
      missing++;
      return 'missing';
    }
    if (filled) {
      extra++;
      return 'extra';
    }
    return 'locked';
  });
  return { slots: out, needed, missing, extra };
}

export type TabState =
  /** The street the betting is on. */
  | 'current'
  /** Reached and finished (or the hand ended there). */
  | 'done'
  /** Has an action that no longer fits the betting. */
  | 'invalid'
  /** Not reached yet. */
  | 'locked';

/** State of the Preflop / Flop / Turn / River tabs. */
export function streetTabs(state: HandState): Record<Street, TabState> {
  const reached = STREETS.indexOf(reachedStreet(state));
  const bad = new Set(state.invalid.map((i) => state.actions[i]?.street));
  const out = {} as Record<Street, TabState>;
  for (const street of STREETS) {
    const i = STREETS.indexOf(street);
    out[street] = bad.has(street)
      ? 'invalid'
      : i > reached
        ? 'locked'
        : i === reached && state.phase.kind === 'act'
          ? 'current'
          : 'done';
  }
  return out;
}
