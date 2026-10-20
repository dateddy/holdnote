import { roundMoney, toBb } from '../amount';
import { computePot } from '../engine/pot';
import { computeResult } from '../engine/result';
import { isPostAct, type Action, type HandInput, type Position, type Street } from '../types';
import { run, ensureForced } from './run';
import { actorAt, canonPos, tableOrder } from './seats';
import type { ActInput, BoardInput, HandSetup, HandState, Notice, Settlement } from './types';

export {
  canonPos,
  forcedBets,
  legacySeat,
  maxStraddles,
  postflopOrder,
  remapSeats,
  tableOrder,
} from './seats';
export { playersByStreet } from './streets';
export type { StreetPlayers } from './streets';
export { showdown } from './showdown';
export type { PotOutcome, ShowdownInput, ShowdownResult } from './showdown';
export type * from './types';
export { boardCheck, boardNeeded, reachedStreet, streetTabs } from './board';
export type { BoardCheck, SlotState, TabState } from './board';
export { previewAmount, quickSizes } from './sizes';
export type { AmountPreview, QuickSize, SizeKind } from './sizes';

/**
 * Where the hand stands after `actions`. Replays from the first forced bet every time, so editing
 * an old action is the same call. `actions` without forced bets get them added in front.
 */
export function replay(
  setup: HandSetup,
  actions: readonly Action[],
  board?: BoardInput,
  /** Seats to treat as followed, to preview the buttons of a seat that is about to be added. */
  extra: readonly Position[] = [],
): HandState {
  const state = run(setup, actions, board, extra);
  if (
    state.phase.kind === 'won' ||
    state.phase.kind === 'showdown' ||
    state.phase.kind === 'runout'
  ) {
    return state;
  }
  // A seat is addable when following it breaks none of the actions already entered.
  const base = new Set(state.invalid);
  const addable: Position[] = state.players
    .filter((p) => !p.tracked)
    .map((p) => p.pos)
    .filter((pos) => run(setup, actions, board, [...extra, pos]).invalid.every((i) => base.has(i)));
  return { ...state, addable };
}

/**
 * The opponent the hand is about: the one still in who acted last; when all of them have folded,
 * the one who folded last. Without any action, the first picked. Null when nobody was picked.
 */
export function primaryOpponent(state: HandState, picked: readonly Position[]): Position | null {
  const folded = (p: Position) => Boolean(state.players.find((x) => x.pos === p)?.folded);
  const seatOf = (a: Action): Position | null => {
    if (!a.pos) return null;
    if (state.players.some((p) => p.pos === a.pos)) return a.pos;
    return a.pos === 'SB' ? 'BTN' : null; // heads-up: the old name of the button
  };
  // Picked seats by their last action, the latest first.
  const latest: Position[] = [];
  state.actions.forEach((a, i) => {
    if (isPostAct(a.act) || a.act === 'dead' || state.invalid.includes(i)) return;
    const seat = seatOf(a);
    if (seat && picked.includes(seat)) latest.unshift(seat);
  });
  const byLast = [...new Set(latest)];
  const live = picked.filter((p) => !folded(p));
  return byLast.find((p) => !folded(p)) ?? live[0] ?? byLast[0] ?? picked[0] ?? null;
}

export interface ActResult {
  /** False when the entry was refused; `actions` is then unchanged. */
  accepted: boolean;
  actions: Action[];
  state: HandState;
  notices: Notice[];
}

/** The action for an input, before the betting fills in amounts. */
function candidate(setup: HandSetup, street: Street, pos: Position, input: ActInput): Action {
  const base: Action = { street, actor: actorAt(setup, pos), pos, act: 'fold' };
  switch (input.act) {
    case 'fold':
    case 'check':
    case 'call':
      return { ...base, act: input.act };
    case 'open':
      return {
        ...base,
        act: 'raise',
        verb: 'open',
        ...(input.to !== undefined && { amount: input.to }),
      };
    case 'bet':
    case 'raise':
      return { ...base, act: input.act, ...(input.to !== undefined && { amount: input.to }) };
    case 'all-in':
      return { ...base, act: 'all-in', ...(input.to !== undefined && { amount: input.to }) };
    case 'dead':
      return { ...base, act: 'dead', ...(input.to !== undefined && { amount: input.to }) };
  }
}

/** Put `next` at `index` (or at the end) and report how the betting takes it. */
function tryEntry(
  setup: HandSetup,
  full: readonly Action[],
  index: number | null,
  next: Action,
  board?: BoardInput,
): ActResult {
  const at = index ?? full.length;
  const before = run(setup, full.slice(0, at), board);
  const entry: Action = { ...next };
  // A call that only completes the forced bets is a limp.
  if (entry.act === 'call' && entry.street === 'preflop' && !before.raised) entry.verb = 'limp';

  const actions = [...full];
  if (index === null) actions.push(entry);
  else actions[index] = entry;

  const state = replay(setup, actions, board);
  const resolved = state.actions;
  if (state.invalid.includes(at)) {
    return {
      accepted: false,
      actions: [...full],
      state: replay(setup, full, board),
      notices: state.warnings.filter((w) => w.index === at),
    };
  }
  return {
    accepted: true,
    actions: resolved,
    state,
    notices: state.warnings.filter((w) => w.index === at),
  };
}

/** Add one action. Refused entries (out of turn, button not offered) change nothing. */
export function act(
  setup: HandSetup,
  actions: readonly Action[],
  input: ActInput,
  board?: BoardInput,
): ActResult {
  const full = ensureForced(setup, actions);
  const now = replay(setup, full, board);
  const refuse = (code: Notice['code']): ActResult => ({
    accepted: false,
    actions: full,
    state: now,
    notices: [{ code }],
  });

  if (input.act === 'dead') {
    const pos = input.seat ? canonPos(setup.seats, input.seat) : null;
    if (!pos || !input.to || input.to <= 0) return refuse('illegal_act');
    const street = now.phase.kind === 'act' ? now.phase.street : 'preflop';
    return tryEntry(setup, full, null, candidate(setup, street, pos, input), board);
  }

  if (now.phase.kind !== 'act') return refuse('illegal_act');
  const pos = input.seat ? canonPos(setup.seats, input.seat) : now.phase.toAct;
  if (!tableOrder(setup.seats).includes(pos)) return refuse('illegal_act');
  if (input.act === 'all-in' && input.to === undefined) {
    const seat = now.players.find((p) => p.pos === pos);
    if (seat && seat.stack === undefined) return refuse('stack_unknown');
  }
  return tryEntry(setup, full, null, candidate(setup, now.phase.street, pos, input), board);
}

/**
 * Replace the action at `index` and replay everything after it. Later actions that no longer fit
 * are listed in `state.invalid`, not deleted.
 */
export function edit(
  setup: HandSetup,
  actions: readonly Action[],
  index: number,
  input: ActInput,
  board?: BoardInput,
): ActResult {
  const full = ensureForced(setup, actions);
  const old = full[index];
  const posts = full.filter((a) => isPostAct(a.act)).length;
  if (!old || index < posts || !old.pos) {
    return {
      accepted: false,
      actions: full,
      state: replay(setup, full, board),
      notices: [{ code: 'illegal_act', index }],
    };
  }
  return tryEntry(setup, full, index, candidate(setup, old.street, old.pos, input), board);
}

/** Drop the last action. Forced bets stay. */
export function undo(actions: readonly Action[]): Action[] {
  const out = [...actions];
  const last = out.at(-1);
  if (last && !isPostAct(last.act)) out.pop();
  return out;
}

/**
 * Hero result once the winner is known, for the two-sided case (hero vs the main opponent). A thin
 * wrapper: `computeResult` builds and pays the pots with `settlePots`, like `showdown`.
 */
export function settle(
  setup: HandSetup,
  actions: readonly Action[],
  winner: 'hero' | 'villain' | 'split',
  board?: BoardInput,
): Settlement {
  const state = replay(setup, actions, board);
  const skip = new Set(state.invalid);
  const hero = canonPos(setup.seats, setup.heroPos);
  const vill = canonPos(setup.seats, setup.villPos);
  const outcome = winner === 'hero' ? 'win' : winner === 'split' ? 'split' : 'lose';
  const input: HandInput = {
    blinds: { sb: setup.sb, bb: setup.bb, ante: setup.ante },
    heroPos: hero,
    villPos: vill,
    ...(setup.stacks?.[hero] !== undefined && { heroStack: setup.stacks[hero] }),
    ...(setup.stacks?.[vill] !== undefined && { villStack: setup.stacks[vill] }),
    ...(setup.stacks && { seatStacks: setup.stacks }),
    actions: state.actions.filter((_, i) => !skip.has(i)),
    outcome,
  };
  const pot = computePot(input);
  const result = roundMoney(computeResult(input) ?? -pot.heroInvested);
  return {
    result,
    resultBb: toBb(result, setup.bb),
    pot: pot.pot,
    heroInvested: pot.heroInvested,
    outcome,
  };
}
