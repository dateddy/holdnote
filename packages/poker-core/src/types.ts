export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;
export type Rank = (typeof RANKS)[number];

export const SUITS = ['s', 'h', 'd', 'c'] as const;
/** `?` = the player does not remember the suit. */
export type Suit = (typeof SUITS)[number] | '?';

/** Two-character card such as `Ah` or `K?`. */
export type Card = `${Rank}${Suit}`;

export const STREETS = ['preflop', 'flop', 'turn', 'river'] as const;
export type Street = (typeof STREETS)[number];

/** 9-max seat names, first to act preflop first. */
export const POSITIONS = ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const;
export type Position = (typeof POSITIONS)[number];

export type Actor = 'hero' | 'villain' | 'other';

/** What a player chooses to do. */
export type PlayerAct = 'check' | 'bet' | 'call' | 'raise' | 'fold' | 'all-in';

/** Forced bets, stored as actions (DEC-045). They sit at the head of the preflop actions. */
export type PostAct = 'post_ante' | 'post_sb' | 'post_bb' | 'post_straddle';

/** Every value `Action.act` can hold. `dead` = money in the pot that is not a bet ("+ other"). */
export type ActKind = PlayerAct | PostAct | 'dead';

export const POST_ACTS: readonly PostAct[] = ['post_ante', 'post_sb', 'post_bb', 'post_straddle'];

export function isPostAct(act: ActKind): act is PostAct {
  return (POST_ACTS as readonly string[]).includes(act);
}

/** Shorthand nuance kept for review context. Never changes the math. */
export type Verb = 'open' | 'limp' | '3bet' | '4bet' | '5bet' | 'lead' | 'check-raise' | 'donk';

/** One entry of `hands.actions` (spec 4.2). */
export interface Action {
  street: Street;
  actor: Actor;
  pos?: Position;
  /** Label for a player without a known position, e.g. `V1`. */
  who?: string;
  act: ActKind;
  /** Total the player has put in on this street after the action ("raise to"). */
  amount?: number;
  verb?: Verb;
}

export type Ante =
  | { mode: 'none' }
  /** Every player dealt in posts `amount`. Needs `HandInput.playersDealt`. */
  | { mode: 'each'; amount: number }
  /** Big-blind ante: the player in the BB posts `amount` for the table. */
  | { mode: 'bb'; amount: number };

export interface Blinds {
  sb: number;
  bb: number;
  /** Live straddle, posted by `straddlePos` (default UTG). */
  straddle?: number;
  straddlePos?: Position;
  ante: Ante;
}

export type Outcome = 'win' | 'lose' | 'fold' | 'split';

export interface HandInput {
  blinds: Blinds;
  /** Players dealt in this hand. Changes hand to hand as people join or leave. */
  playersDealt?: number;
  heroPos?: Position;
  villPos?: Position;
  /** Stacks at the start of the hand, in session money units. */
  heroStack?: number;
  villStack?: number;
  /** Stacks of other seats, when known (state machine setups). Hero and villain use the fields above. */
  seatStacks?: Partial<Record<Position, number>>;
  outcome?: Outcome;
  actions: Action[];
}
