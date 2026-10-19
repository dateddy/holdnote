import type { Actor, Action, Ante, Card, Position, Street } from '../types';

/** Everything the table looks like before the first action (spec step ①). */
export interface HandSetup {
  /** Players dealt in, 2..9. Larger tables are treated as 9. */
  seats: number;
  sb: number;
  bb: number;
  ante: Ante;
  /** Straddle levels in chips, first straddler first. Cut to what the table allows (max 3). */
  straddles?: number[];
  heroPos: Position;
  villPos: Position;
  /** Seats followed in this hand besides hero and villain. */
  tracked?: Position[];
  /** Stacks at the start of the hand, by seat. Missing = unknown. */
  stacks?: Partial<Record<Position, number>>;
}

/** Buttons of the entry screen. `open` is a raise with `verb: 'open'`. */
export type ButtonKind = 'fold' | 'check' | 'call' | 'open' | 'bet' | 'raise' | 'all-in';

export interface ActInput {
  act: ButtonKind | 'dead';
  /** "Up to" amount for open / bet / raise, or the dead money. All-in defaults to the stack. */
  to?: number;
  /** Acting seat; defaults to the seat whose turn it is. */
  seat?: Position;
}

export interface BoardInput {
  /** Cards entered so far, in board order. Only the run-out reads them; they never gate the betting. */
  cards: readonly Card[];
}

export type WarningCode =
  'below_min_raise' | 'auto_all_in' | 'out_of_turn' | 'illegal_act' | 'stack_unknown' | 'side_pot';

export interface Notice {
  code: WarningCode;
  /** Index in `HandState.actions`, when the notice is about one action. */
  index?: number;
}

export type Phase =
  | { kind: 'act'; street: Street; toAct: Position }
  /** Nobody can bet any more: enter the missing board cards, then showdown. */
  | { kind: 'runout'; missing: number }
  | { kind: 'showdown' }
  | { kind: 'won'; winner: Position };

export interface SeatState {
  pos: Position;
  actor: Actor;
  tracked: boolean;
  stack?: number;
  /** Chips left behind, when the stack is known. */
  behind?: number;
  /** In front of the seat on the current street. */
  streetBet: number;
  /** Total put in so far, antes and dead money included. */
  invested: number;
  folded: boolean;
  allIn: boolean;
  mayRaise: boolean;
}

export interface HandState {
  /**
   * The actions every index below refers to: forced bets first (added when missing), call and
   * all-in amounts refreshed from the betting.
   */
  actions: Action[];
  phase: Phase;
  /** Buttons for the seat to act (spec section 7). */
  buttons: ButtonKind[];
  /** What the seat to act must add to call. */
  toCall: number;
  /** Largest bet on the table this street ("current bet"). */
  currentBet: number;
  /** Smallest legal "raise to"; below it the entry only warns. */
  minRaiseTo: number;
  /** Size of the last full raise, or the opening level before any raise. */
  lastRaiseSize: number;
  /** True once someone has bet or raised above the street opening level. */
  raised: boolean;
  /** Pot including bets still on the table. */
  pot: number;
  players: SeatState[];
  /** Untracked seats that can still be added without breaking the actions already entered. */
  addable: Position[];
  warnings: Notice[];
  /** Actions that no longer fit the betting. They stay in the array and are ignored. */
  invalid: number[];
}

export interface Settlement {
  /** Hero net result in chips, before any manual correction. */
  result: number;
  resultBb: number;
  pot: number;
  heroInvested: number;
  outcome: 'win' | 'lose' | 'split';
  warnings: Notice[];
}
