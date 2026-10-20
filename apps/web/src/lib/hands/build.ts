import {
  computeEff,
  computePot,
  computeResult,
  computeSpr,
  forcedBets,
  isCard,
  isPostAct,
  legacySeat,
  boardCheck,
  canonPos,
  primaryOpponent,
  replay,
  showdown,
  tableOrder,
  nextStack,
  parseAmount,
  resolveActions,
  roundMoney,
  toBb,
  POSITIONS,
  STREETS,
  type Action,
  type BoardInput,
  type Blinds,
  type Card,
  type HandSetup,
  type EffStack,
  type HandInput,
  type BoardCheck,
  type HandState,
  type Outcome,
  type Position,
  type ShowdownResult,
  type StreetSpr,
} from 'poker-core';
import { isOneOf } from '@/lib/sessions/form';
import { applyLevel, sessionLevels, startLevel } from './level';
import { boardInput, draftToSetup } from './setup';

export const OUTCOMES = ['win', 'lose', 'fold', 'split'] as const;

/** Slots of the card grid: 2 hero cards, flop (3), turn, river. */
export const SLOT_COUNT = 7;
export const HERO_SLOTS = [0, 1] as const;
export const BOARD_SLOTS = [2, 3, 4, 5, 6] as const;

/** The session columns the hand screens need. */
export type HandSession = {
  kind: string;
  mode: string;
  sb: number | null;
  bb: number | null;
  straddle: number | null;
  ante_mode: string;
  ante: number | null;
  buyin: number | null;
  seats: number | null;
  mtt: unknown;
};

export const HAND_SESSION_COLUMNS =
  'kind, mode, sb, bb, straddle, ante_mode, ante, buyin, seats, mtt';

/** What the previous hand of the session passes on. */
export type PreviousHand = {
  hero_stack: number | null;
  result: number | null;
  level_bb?: number | null;
  /** MTT: the level number, and the SB and ante type the hand was played with. */
  level?: number | null;
  sb?: number | null;
  ante_mode?: string | null;
  players_dealt?: number | null;
  ante?: number | null;
  hero_pos?: string | null;
  villain_pos?: string | null;
  stage?: string | null;
  /** Straddle levels of the previous hand, in chips. */
  straddles?: number[];
};

/** An opponent picked on the mini table (5.1c-5): seat, his stack as typed, the saved opponent. */
export type DraftOpponent = {
  pos: string;
  stack: string;
  opponentId: string;
  /** Hole cards shown at showdown (`''` / missing = unknown). */
  cards?: string[];
};

/** The two hole cards of a picked opponent, `''` where unknown. */
export const opponentCards = (o: DraftOpponent): [string, string] => [
  o.cards?.[0] ?? '',
  o.cards?.[1] ?? '',
];

/** Everything typed on the Ghi nhanh screen. Strings stay raw until {@link deriveHand}. */
export type HandDraft = {
  /** Seven card slots, `''` when empty. */
  slots: string[];
  /** Cards of the opponent when no opponent list is picked (shorthand without seats). */
  villCards: string[];
  heroPos: string;
  /** First opponent picked (mirror of `opponents[0]`); the main opponent is found by {@link deriveHand}. */
  villPos: string;
  opponentId: string;
  /** Every opponent picked, in the order picked. Empty = only `villPos` (hands built without it). */
  opponents: DraftOpponent[];
  actions: Action[];
  rawLine: string;
  /** Winner of each pot the player picked, main pot first; null = not picked. Seat names. */
  potWinners: (string[] | null)[];
  outcome: string;
  /** Manual result, signed. Empty = use the computed one. */
  resultText: string;
  heroStack: string;
  villStack: string;
  levelBb: string;
  playersDealt: string;
  /** Ante of this level: typed for online MTT hands (DEC-034), or filled from the blind structure. */
  ante: string;
  /** MTT level number from the blind structure; `''` = unknown or no structure. */
  level: string;
  /** Ante type of this level (`none`/`each`/`bb`); `''` = the session's rule (DEC-034). */
  anteMode: string;
  thought: string;
  flagged: boolean;
  /** Straddle levels in chips, first straddler first. Cash only; empty = no straddle. */
  straddles: string[];
  /** Small blind of this level when it is not half the big blind (MTT). */
  levelSb: string;
  /** MTT stage label (`hands.stage`). */
  stage: string;
  /**
   * Hand saved before forced bets became actions (DEC-045): `actions` has no `post_*` and the blinds
   * come from the session. New hands add `forcedBets(setup)` in front of `actions` when deriving.
   */
  legacy: boolean;
};

export type HandDerived = {
  input: HandInput | null;
  /** Actions with call / all-in amounts filled in. */
  actions: Action[];
  bb: number | null;
  potFinal: number | null;
  result: number | null;
  resultBb: number | null;
  eff: EffStack | null;
  spr: StreetSpr[];
  missing: boolean;
  /** Where the betting stands (turn, buttons, warnings). Null for legacy hands or missing setup. */
  machine: HandState | null;
  /** Board slots against the betting (missing, extra). Null without a state machine. */
  board: BoardCheck | null;
  /** Outcome the betting decides by itself (hero folded, or everyone else did); else the draft's. */
  outcome: string;
  /** The opponent the hand is about: first picked who has not folded (spec 11). */
  primary: DraftOpponent | null;
  /** Pots, winners and hand names; null while the hand goes on, in shorthand mode or for old hands. */
  showdown: ShowdownResult | null;
  /** The betting alone settled the hand (hero folded, or everyone else did). */
  decided: boolean;
};

export function emptyDraft(session: HandSession, prev: PreviousHand | null): HandDraft {
  return {
    slots: Array<string>(SLOT_COUNT).fill(''),
    villCards: ['', ''],
    opponentId: '',
    opponents: [],
    actions: [],
    rawLine: '',
    potWinners: [],
    outcome: '',
    resultText: '',
    villStack: '',
    thought: '',
    flagged: false,
    legacy: false,
    ...nextHandDefaults(session, prev),
  };
}

/** The seat the same player takes on the next hand: the button moves one place, names move forward. */
export function rotatePos(seats: number, pos: string | null | undefined): string {
  const order = tableOrder(seats);
  const i = order.findIndex((p) => p === legacySeat(seats, pos ?? ''));
  return i < 0 ? '' : (order[(i + 1) % order.length] ?? '');
}

/** The opponents picked, first picked first. */
export function pickedOpponents(draft: HandDraft): DraftOpponent[] {
  if (draft.opponents.length > 0) return draft.opponents;
  return draft.villPos
    ? [
        {
          pos: draft.villPos,
          stack: draft.villStack,
          opponentId: draft.opponentId,
          cards: draft.villCards,
        },
      ]
    : [];
}

/** Set the opponents and keep the first-picked mirror fields in step. */
export function withOpponents(draft: HandDraft, list: DraftOpponent[]): HandDraft {
  const first = list[0];
  return {
    ...draft,
    opponents: list,
    villPos: first?.pos ?? '',
    villStack: first?.stack ?? '',
    opponentId: first?.opponentId ?? '',
  };
}

/** Fields that carry over from the previous hand: stack, level, head count. */
export function nextHandDefaults(
  session: HandSession,
  prev: PreviousHand | null,
): Pick<
  HandDraft,
  | 'heroStack'
  | 'levelBb'
  | 'levelSb'
  | 'level'
  | 'anteMode'
  | 'playersDealt'
  | 'ante'
  | 'heroPos'
  | 'villPos'
  | 'straddles'
  | 'stage'
> {
  const stack = startingStack(session, prev);
  const level = prev?.level_bb ?? (session.kind === 'mtt' ? session.bb : null);
  const dealt = prev?.players_dealt ?? session.seats;
  const seats = prev?.players_dealt ?? session.seats ?? 9;
  const straddles = prev
    ? (prev.straddles ?? [])
    : session.kind === 'cash' && session.straddle
      ? [session.straddle]
      : [];
  const mtt = session.kind === 'mtt';
  const common = {
    heroPos: rotatePos(seats, prev?.hero_pos),
    // The opponents change from hand to hand: they are picked again (5.1c-5).
    villPos: '',
    straddles: session.kind === 'cash' ? straddles.map(String) : [],
    stage: prev?.stage ?? '',
    heroStack: stack == null ? '' : String(stack),
    playersDealt: dealt == null ? '' : String(dealt),
  };
  // The SB, BB and ante of the previous hand carry on as they were played (MTT). A blind structure
  // decides the first hand, and what "Lên level" / "Lùi level" fill in.
  const carried = {
    levelBb: mtt && level != null ? String(level) : '',
    levelSb: mtt && prev?.sb != null ? String(prev.sb) : '',
    level: '',
    anteMode: '',
    ante: levelAnte(session) === 'typed' ? String(prev?.ante ?? session.ante ?? '') : '',
  };

  const levels = sessionLevels(session);
  if (levels.length === 0) return { ...common, ...carried };
  if (!prev) {
    const first = startLevel(session, levels);
    return first
      ? { ...common, ...applyLevel(carried as HandDraft, first) }
      : { ...common, ...carried };
  }
  if (prev.level == null) return { ...common, ...carried };
  return {
    ...common,
    ...carried,
    level: String(prev.level),
    anteMode: prev.ante_mode ?? 'none',
    ante: prev.ante != null && prev.ante > 0 ? String(prev.ante) : '',
  };
}

/**
 * How the ante of an MTT hand is set (DEC-034): `bb` = the BB posts an ante equal to the level BB;
 * `typed` = online per-player ante that changes every level. Otherwise the session value applies.
 */
export function levelAnte(session: HandSession): 'bb' | 'typed' | null {
  if (session.kind !== 'mtt') return null;
  if (session.ante_mode === 'bb') return 'bb';
  if (session.ante_mode === 'each' && session.mode === 'online') return 'typed';
  return null;
}

/** Hero stack at the start of the next hand: the buy-in first, then last stack plus last result. */
export function startingStack(session: HandSession, prev: PreviousHand | null): number | null {
  if (prev) {
    return prev.hero_stack == null || prev.result == null
      ? null
      : nextStack(prev.hero_stack, prev.result);
  }
  if (session.kind === 'mtt') {
    const start = (session.mtt as { start_stack?: unknown } | null)?.start_stack;
    if (typeof start === 'number') return start;
  }
  return session.buyin;
}

/** Minimum to save (spec 3.5): both hero cards, or the flag. */
export function canSave(draft: HandDraft): boolean {
  return draft.flagged || heroCards(draft).length === 2;
}

export function heroCards(draft: HandDraft): string[] {
  return draft.slots.slice(0, 2).filter(isCard);
}

export function boardCards(draft: HandDraft): string[] {
  return draft.slots.slice(2, SLOT_COUNT).filter(isCard);
}

/** Big blind of this hand: the level for MTT, the session BB for cash. */
export function handBb(session: HandSession, draft: HandDraft): number | null {
  if (session.kind === 'mtt') {
    const level = parseAmount(draft.levelBb);
    if (level != null && level > 0) return level;
  }
  return session.bb;
}

/**
 * Blinds of a hand. `anteMode` is the level's own ante type (blind structure); when it is empty the
 * session's rule decides (DEC-034).
 */
export function blindsFor(session: HandSession, bb: number, anteText = '', anteMode = ''): Blinds {
  const sb = bb === session.bb && session.sb != null ? session.sb : roundMoney(bb / 2);
  const straddle =
    session.kind === 'cash' && session.straddle ? { straddle: session.straddle } : {};

  if (isOneOf(['none', 'each', 'bb'] as const, anteMode)) {
    const typed = parseAmount(anteText);
    const amount = anteMode === 'bb' ? (typed != null && typed > 0 ? typed : bb) : (typed ?? 0);
    return {
      sb,
      bb,
      ...straddle,
      ante: anteMode === 'none' || amount <= 0 ? { mode: 'none' } : { mode: anteMode, amount },
    };
  }

  const mode = isOneOf(['each', 'bb'] as const, session.ante_mode) ? session.ante_mode : 'none';
  const kind = levelAnte(session);
  const typed = kind === 'typed' ? parseAmount(anteText) : null;
  const ante = kind === 'bb' ? bb : typed != null && typed > 0 ? typed : (session.ante ?? 0);
  return {
    sb,
    bb,
    ...straddle,
    ante: mode === 'none' || ante <= 0 ? { mode: 'none' } : { mode, amount: ante },
  };
}

const num = (raw: string): number | undefined => {
  const n = parseAmount(raw);
  return n == null ? undefined : n;
};

const position = (raw: string): Position | undefined => (isOneOf(POSITIONS, raw) ? raw : undefined);

export function deriveHand(session: HandSession, draft: HandDraft): HandDerived {
  const bb = handBb(session, draft);
  const blank: HandDerived = {
    input: null,
    actions: draft.actions,
    bb,
    potFinal: null,
    result: null,
    resultBb: null,
    eff: null,
    spr: [],
    missing: true,
    machine: null,
    board: null,
    outcome: draft.outcome,
    primary: pickedOpponents(draft)[0] ?? null,
    showdown: null,
    decided: false,
  };
  if (bb == null) return blank;

  // New hands: forced bets are actions in front of the player's actions (DEC-045).
  const setup = draft.legacy ? null : draftToSetup(session, draft, bb);
  const withForced = setup ? [...forcedBets(setup), ...draft.actions] : draft.actions;
  const machine = setup ? replay(setup, withForced, boardInput(draft)) : null;
  // Button entry drops actions that no longer fit; the shorthand line is taken as typed.
  const invalid = new Set(draft.rawLine.trim() ? [] : (machine?.invalid ?? []));
  const picked = pickedOpponents(draft);
  const seats = setup?.seats ?? 9;
  // Main opponent: the first picked who has not folded; he is 'villain' in everything saved.
  const primaryPos =
    machine && picked.length > 0
      ? primaryOpponent(
          machine,
          picked.map((o) => canonPos(seats, o.pos as Position)),
        )
      : null;
  const primary =
    (primaryPos && picked.find((o) => canonPos(seats, o.pos as Position) === primaryPos)) ||
    picked[0] ||
    null;
  const casted = machine && primary ? castVillain(withForced, seats, primary.pos) : withForced;
  const actions = casted.filter((_, i) => !invalid.has(i));
  const auto = machine ? autoOutcome(machine) : '';
  const board = machine ? boardCheck(machine, draft.slots.slice(2)) : null;

  const input: HandInput = {
    blinds: blindsFor(session, bb, draft.ante, draft.anteMode),
    actions,
    ...(num(draft.playersDealt) !== undefined && { playersDealt: num(draft.playersDealt) }),
    ...(position(draft.heroPos) && { heroPos: position(draft.heroPos) }),
    ...(position(primary?.pos ?? draft.villPos) && {
      villPos: position(primary?.pos ?? draft.villPos),
    }),
    ...(num(draft.heroStack) !== undefined && { heroStack: num(draft.heroStack) }),
    ...(num(primary?.stack ?? draft.villStack) !== undefined && {
      villStack: num(primary?.stack ?? draft.villStack),
    }),
    ...(isOneOf(OUTCOMES, auto || draft.outcome) && {
      outcome: (auto || draft.outcome) as Outcome,
    }),
  };

  // Buttons mode: the pots and their winners come from `showdown`. A typed shorthand line, or a
  // hand without seats, goes through `computeResult` (which pays the pots with the same code).
  const sd =
    setup && machine && !draft.rawLine.trim()
      ? settleHand(setup, withForced, boardInput(draft), draft, picked, primaryPos, auto)
      : null;
  const outcome = auto || (sd ? outcomeOf(sd, setup) : '') || draft.outcome;
  if (sd && isOneOf(OUTCOMES, outcome)) input.outcome = outcome as Outcome;

  const pot = computePot(input);
  const manual = draft.resultText.trim() ? num(draft.resultText) : undefined;
  const result =
    manual !== undefined ? roundMoney(manual) : sd ? sd.heroResult : computeResult(input);
  const eff = computeEff(input.heroStack, input.villStack, bb);

  return {
    input,
    actions: resolveActions(input),
    bb,
    potFinal: pot.exact ? pot.pot : null,
    result,
    resultBb: result == null ? null : toBb(result, bb),
    eff,
    spr: computeSpr(input),
    missing: result == null || eff == null || (board?.missing ?? 0) > 0,
    machine,
    board,
    outcome,
    primary,
    showdown: sd,
    decided: auto !== '',
  };
}

/** Hole cards by seat for `showdown`: hero's from the slots, each picked opponent's as shown. */
function holeCards(
  setup: HandSetup,
  draft: HandDraft,
  picked: readonly DraftOpponent[],
): Partial<Record<Position, Card[]>> {
  const hole: Partial<Record<Position, Card[]>> = {};
  const hero = heroCards(draft) as Card[];
  if (hero.length === 2) hole[canonPos(setup.seats, setup.heroPos)] = hero;
  for (const o of picked) {
    const cards = opponentCards(o).filter(isCard) as Card[];
    if (cards.length === 2) hole[canonPos(setup.seats, o.pos as Position)] = cards;
  }
  return hole;
}

/**
 * Winners of every pot. Cards decide where all hands are known; the player's picks (`potWinners`)
 * override them; a pot nobody decided takes the typed outcome (win = hero, lose = main opponent,
 * split = both), which is how hands saved before 5.1c-6b read.
 */
function settleHand(
  setup: HandSetup,
  actions: readonly Action[],
  board: BoardInput,
  draft: HandDraft,
  picked: readonly DraftOpponent[],
  primaryPos: Position | null,
  auto: string,
): ShowdownResult | null {
  const hole = holeCards(setup, draft, picked);
  const seat = (p: string) => canonPos(setup.seats, p as Position);
  const choices: (Position[] | null)[] = draft.potWinners.map((w) => (w ? w.map(seat) : null));
  const first = showdown(setup, actions, board, { hole, choices });
  if (!first || !first.needsChoice) return first;

  const hero = seat(setup.heroPos);
  const out = auto || draft.outcome;
  const villain = primaryPos ?? seat(setup.villPos);
  const filled = first.pots.map((p, i): Position[] | null => {
    if (p.winners) return choices[i] ?? null;
    if (out === 'win') return p.eligible.includes(hero) ? [hero] : null;
    if (out === 'lose') return p.eligible.includes(villain) ? [villain] : null;
    if (out === 'split') {
      const both = [hero, villain].filter((s) => p.eligible.includes(s));
      return both.length > 0 ? both : null;
    }
    return null;
  });
  return showdown(setup, actions, board, { hole, choices: filled });
}

/** win / lose / split for the `hands.outcome` column, from who took which pot. */
function outcomeOf(sd: ShowdownResult, setup: HandSetup | null): string {
  if (!setup || sd.needsChoice) return '';
  const hero = canonPos(setup.seats, setup.heroPos);
  if (!(sd.payouts[hero] ?? 0)) return 'lose';
  const sole = sd.pots.every(
    (p) => !p.eligible.includes(hero) || (p.winners?.length === 1 && p.winners[0] === hero),
  );
  return sole ? 'win' : 'split';
}

/** Actions with 'villain' on the main opponent's seat; the first picked, if he is not it, is 'other'. */
function castVillain(actions: readonly Action[], seats: number, pos: string): Action[] {
  const main = canonPos(seats, pos as Position);
  return actions.map((a) => {
    const here = a.pos ? canonPos(seats, a.pos) === main : a.actor === 'villain';
    if (here) return a.actor === 'villain' ? a : { ...a, actor: 'villain' };
    return a.actor === 'villain' ? { ...a, actor: 'other' } : a;
  });
}

/** When the betting alone settles the hand: hero folded, or everyone but one folded. */
export function autoOutcome(machine: HandState): string {
  const hero = machine.players.find((p) => p.actor === 'hero');
  if (hero?.folded) return 'fold';
  if (machine.phase.kind === 'won') {
    return machine.phase.winner === hero?.pos ? 'win' : 'lose';
  }
  return '';
}

/** Player actions without the forced bets that `deriveHand` puts in front. */
export const stripForced = (actions: readonly Action[]): Action[] =>
  actions.filter((a) => !isPostAct(a.act));

/** `hands` insert row (without `session_id`; the caller adds it). */
export function toHandRow(session: HandSession, draft: HandDraft, num_: number) {
  const d = deriveHand(session, draft);
  const heroPos = position(draft.heroPos);
  const villPos = position(draft.villPos);
  const villCards = d.primary ? opponentCards(d.primary).filter(isCard) : [];
  return {
    num: num_,
    hero_cards: heroCards(draft),
    board: boardCards(draft),
    villain_cards: villCards.length === 2 ? villCards : null,
    hero_pos: heroPos ?? null,
    villain_pos: position(d.primary?.pos ?? '') ?? villPos ?? null,
    opponent_id: d.primary?.opponentId || null,
    opponents: pickedOpponents(draft).flatMap((o) => {
      const stack = num(o.stack);
      return position(o.pos)
        ? [
            {
              pos: o.pos,
              ...(stack !== undefined && { stack }),
              ...(o.opponentId && { opponent_id: o.opponentId }),
              ...(opponentCards(o).filter(isCard).length === 2 && {
                cards: opponentCards(o).filter(isCard),
              }),
            },
          ]
        : [];
    }) as unknown as never,
    actions: d.actions as unknown as never,
    pot_winners: draft.potWinners as unknown as never,
    raw_line: draft.rawLine.trim() || null,
    outcome: isOneOf(OUTCOMES, d.outcome) ? d.outcome : null,
    result: d.result,
    pot_final: d.potFinal,
    hero_stack: num(draft.heroStack) ?? null,
    villain_stack: num(d.primary?.stack ?? draft.villStack) ?? null,
    eff_stack: d.eff?.amount ?? null,
    level_bb: session.kind === 'mtt' ? d.bb : null,
    level: session.kind === 'mtt' ? levelNumber(draft.level) : null,
    ...levelAnteColumns(session, d),
    players_dealt: integerOrNull(draft.playersDealt),
    stage: session.kind === 'mtt' ? draft.stage || null : null,
    thought: draft.thought.trim() || null,
    flagged: draft.flagged,
    tags: draft.resultText.trim() ? ['manual_result'] : [],
    missing_data: d.missing,
  };
}

function levelNumber(raw: string): number | null {
  const n = Number(raw.trim());
  return raw.trim() && Number.isInteger(n) && n > 0 && n <= 32767 ? n : null;
}

function integerOrNull(raw: string): number | null {
  const n = Number(raw.trim());
  return raw.trim() && Number.isInteger(n) && n >= 2 && n <= 10 ? n : null;
}

/** Columns of a saved hand that {@link fromHandRow} reads. */
export const HAND_EDIT_COLUMNS =
  'id, num, session_id, hero_cards, board, villain_cards, hero_pos, villain_pos, opponent_id, actions, raw_line, outcome, result, hero_stack, villain_stack, level_bb, level, players_dealt, ante, ante_mode, stage, thought, flagged, opponents, pot_winners';

export type HandRowIn = {
  hero_cards: string[] | null;
  board: string[] | null;
  villain_cards: string[] | null;
  hero_pos: string | null;
  villain_pos: string | null;
  opponent_id: string | null;
  actions: unknown;
  raw_line: string | null;
  outcome: string | null;
  result: number | null;
  hero_stack: number | null;
  villain_stack: number | null;
  level_bb: number | null;
  level?: number | null;
  players_dealt: number | null;
  ante: number | null;
  ante_mode?: string | null;
  stage: string | null;
  thought: string | null;
  flagged: boolean;
  /** `hands.opponents`: [{ pos, stack?, opponent_id?, cards? }] in the order picked. */
  opponents?: unknown;
  /** `hands.pot_winners`: per pot, the seats that won it (null = not picked). */
  pot_winners?: unknown;
};

const ACTS = [
  'check',
  'bet',
  'call',
  'raise',
  'fold',
  'all-in',
  'post_ante',
  'post_sb',
  'post_bb',
  'post_straddle',
  'dead',
] as const;

const isAction = (x: unknown): x is Action => {
  if (!x || typeof x !== 'object') return false;
  const a = x as Record<string, unknown>;
  return (
    isOneOf(STREETS, a.street) &&
    isOneOf(['hero', 'villain', 'other'] as const, a.actor) &&
    isOneOf(ACTS, a.act)
  );
};

/** Opponents of a saved hand: the column, else the main opponent plus every other seat that acted. */
function rowOpponents(
  row: HandRowIn,
  saved: readonly Action[],
  hero: string,
  rename: (pos: string) => string,
): DraftOpponent[] {
  const str = (n: unknown) => (typeof n === 'number' ? String(n) : '');
  const fromColumn = (Array.isArray(row.opponents) ? row.opponents : []).flatMap((o: unknown) => {
    const x = o as {
      pos?: unknown;
      stack?: unknown;
      opponent_id?: unknown;
      cards?: unknown;
    } | null;
    return x && typeof x.pos === 'string'
      ? [
          {
            pos: rename(x.pos),
            stack: str(x.stack),
            opponentId: typeof x.opponent_id === 'string' ? x.opponent_id : '',
            cards: Array.isArray(x.cards) ? x.cards.map(String) : [],
          },
        ]
      : [];
  });
  // Hands saved with the cards only in `villain_cards`: they belong to the main opponent.
  const shown = row.villain_cards ?? [];
  if (fromColumn.length > 0) {
    return fromColumn.map((o) =>
      (o.cards?.length ?? 0) === 0 && o.pos === rename(row.villain_pos ?? '')
        ? { ...o, cards: shown }
        : o,
    );
  }

  const list: DraftOpponent[] = [];
  if (row.villain_pos) {
    list.push({
      pos: rename(row.villain_pos),
      stack: str(row.villain_stack),
      opponentId: row.opponent_id ?? '',
      cards: shown,
    });
  }
  for (const a of saved) {
    if (!a.pos || a.actor !== 'other' || isPostAct(a.act) || a.act === 'dead') continue;
    if (a.pos !== hero && !list.some((o) => o.pos === a.pos)) {
      list.push({ pos: a.pos, stack: '', opponentId: '' });
    }
  }
  return list;
}

/** Back from a saved row to the editable draft. A manual result is kept as an override. */
export function fromHandRow(session: HandSession, row: HandRowIn): HandDraft {
  const slots = Array<string>(SLOT_COUNT).fill('');
  (row.hero_cards ?? []).slice(0, 2).forEach((c, i) => (slots[i] = c));
  (row.board ?? []).slice(0, 5).forEach((c, i) => (slots[2 + i] = c));
  const str = (n: number | null) => (n == null ? '' : String(n));
  const hasLevel = row.level != null && sessionLevels(session).length > 0;
  // Hands saved under the old position names are read on today's table (5.1c-5).
  const seats = row.players_dealt ?? session.seats ?? 9;
  const rename = (pos: string): string => legacySeat(seats, pos);
  const saved = (Array.isArray(row.actions) ? row.actions.filter(isAction) : []).map((a) =>
    a.pos ? { ...a, pos: rename(a.pos) as Position } : a,
  );
  const posts = saved.filter((a) => isPostAct(a.act));
  const heroSeat = rename(row.hero_pos ?? '');
  const opponents = rowOpponents(row, saved, heroSeat, rename);
  const amounts = (act: Action['act']) =>
    posts.filter((a) => a.act === act && a.amount !== undefined).map((a) => String(a.amount));
  const draft: HandDraft = {
    slots,
    villCards: [row.villain_cards?.[0] ?? '', row.villain_cards?.[1] ?? ''],
    heroPos: heroSeat,
    villPos: opponents[0]?.pos ?? rename(row.villain_pos ?? ''),
    opponentId: opponents[0]?.opponentId ?? row.opponent_id ?? '',
    opponents,
    actions: stripForced(saved),
    rawLine: row.raw_line ?? '',
    potWinners: Array.isArray(row.pot_winners)
      ? row.pot_winners.map((w) => (Array.isArray(w) ? w.map((x) => rename(String(x))) : null))
      : [],
    outcome: row.outcome ?? '',
    resultText: '',
    heroStack: str(row.hero_stack),
    villStack: opponents[0]?.stack ?? str(row.villain_stack),
    levelBb: str(row.level_bb),
    playersDealt: str(row.players_dealt),
    level: str(row.level ?? null),
    // A hand saved at a level of the structure keeps that level's ante type; others follow the session.
    anteMode: hasLevel ? (row.ante_mode ?? 'none') : '',
    ante: hasLevel || levelAnte(session) === 'typed' ? str(row.ante) : '',
    thought: row.thought ?? '',
    flagged: row.flagged,
    straddles: session.kind === 'cash' ? amounts('post_straddle') : [],
    levelSb: session.kind === 'mtt' ? (amounts('post_sb')[0] ?? '') : '',
    stage: row.stage ?? '',
    // No forced bets saved: the hand predates DEC-045 and is read with the session blinds.
    legacy: posts.length === 0,
  };
  // Keep the stored result only when the numbers do not already give it.
  if (row.result != null && deriveHand(session, draft).result !== row.result) {
    draft.resultText = String(row.result);
  }
  return draft;
}

/** Hand-level ante columns: only MTT hands record the ante of their level; null = session default. */
function levelAnteColumns(session: HandSession, d: HandDerived) {
  const ante = d.input?.blinds.ante;
  if (session.kind !== 'mtt' || !ante || ante.mode === 'none') {
    return { ante_mode: null, ante: null };
  }
  return { ante_mode: ante.mode, ante: ante.amount };
}
