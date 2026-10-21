import { isPostAct, type Action } from '../types';
import { ensureForced, run } from './run';
import { canonPos, tableOrder } from './seats';
import type { BoardInput, HandSetup } from './types';

/** Why an old action list (shorthand or saved before forced bets) cannot be replayed by the machine. */
export type LegacyFailure =
  /** The setup does not fit the table (hero and villain seats). */
  | 'bad_setup'
  /** An action has no usable seat (`V1..V9`, a seat the table does not have). */
  | 'unknown_seat'
  /** An action by a seat that is not next to act: a fold or a call is missing in between. */
  | 'out_of_turn'
  /** A button the betting does not allow there (check facing a bet, action after the hand ended...). */
  | 'invalid_action'
  /** An all-in of a seat whose stack is not known, so the amount cannot be told. */
  | 'missing_stack';

export type LegacyConversion =
  { ok: true; actions: Action[] } | { ok: false; reason: LegacyFailure; index?: number };

/**
 * Old action list to the list the entry screen writes: forced bets (ante, SB, BB, straddles from
 * the session setup) in front, call and all-in amounts filled in by the betting. Nothing is
 * guessed: any action that does not fit makes the whole conversion fail, with the first reason.
 * `index` points into `actions` (not counting the forced bets added in front).
 */
export function actionsFromLegacy(
  setup: HandSetup,
  actions: readonly Action[],
  board?: BoardInput,
): LegacyConversion {
  const n = setup.seats;
  const order = tableOrder(n);
  const hero = canonPos(n, setup.heroPos);
  const vill = canonPos(n, setup.villPos);
  if (!order.includes(hero) || !order.includes(vill) || hero === vill) {
    return { ok: false, reason: 'bad_setup' };
  }

  const known = (a: Action): boolean => {
    if (isPostAct(a.act)) return true;
    if (a.pos) return order.includes(canonPos(n, a.pos));
    return a.actor === 'hero' || a.actor === 'villain';
  };
  const unknown = actions.findIndex((a) => !known(a));
  if (unknown >= 0) return { ok: false, reason: 'unknown_seat', index: unknown };

  const offset = ensureForced(setup, actions).length - actions.length;
  const state = run({ ...setup, listedOnly: false }, actions, board);
  const first = state.invalid[0];
  if (first !== undefined) {
    const code = state.warnings.find((w) => w.index === first)?.code;
    const reason: LegacyFailure =
      code === 'out_of_turn'
        ? 'out_of_turn'
        : code === 'stack_unknown'
          ? 'missing_stack'
          : code === 'not_in_hand'
            ? 'unknown_seat'
            : 'invalid_action';
    return { ok: false, reason, index: Math.max(0, first - offset) };
  }
  return { ok: true, actions: state.actions };
}
