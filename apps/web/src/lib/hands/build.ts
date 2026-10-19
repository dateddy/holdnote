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
  tableOrder,
  nextStack,
  parseAmount,
  resolveActions,
  roundMoney,
  toBb,
  POSITIONS,
  STREETS,
  type Action,
  type Blinds,
  type EffStack,
  type HandInput,
  type BoardCheck,
  type HandState,
  type Outcome,
  type Position,
  type StreetSpr,
} from 'poker-core';
import { isOneOf } from '@/lib/sessions/form';
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
  players_dealt?: number | null;
  ante?: number | null;
  hero_pos?: string | null;
  villain_pos?: string | null;
  stage?: string | null;
  /** Straddle levels of the previous hand, in chips. */
  straddles?: number[];
};

/** An opponent picked on the mini table (5.1c-5): seat, his stack as typed, the saved opponent. */
export type DraftOpponent = { pos: string; stack: string; opponentId: string };

/** Everything typed on the Ghi nhanh screen. Strings stay raw until {@link deriveHand}. */
export type HandDraft = {
  /** Seven card slots, `''` when empty. */
  slots: string[];
  villCards: string[];
  heroPos: string;
  /** First opponent picked (mirror of `opponents[0]`); the main opponent is found by {@link deriveHand}. */
  villPos: string;
  opponentId: string;
  /** Every opponent picked, in the order picked. Empty = only `villPos` (hands built without it). */
  opponents: DraftOpponent[];
  actions: Action[];
  rawLine: string;
  outcome: string;
  /** Manual result, signed. Empty = use the computed one. */
  resultText: string;
  heroStack: string;
  villStack: string;
  levelBb: string;
  playersDealt: string;
  /** Per-player ante of this level, typed for online MTT hands (DEC-034). */
  ante: string;
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
};

export function emptyDraft(session: HandSession, prev: PreviousHand | null): HandDraft {
  return {
    slots: Array<string>(SLOT_COUNT).fill(''),
    villCards: ['', ''],
    opponentId: '',
    opponents: [],
    actions: [],
    rawLine: '',
    outcome: '',
    resultText: '',
    villStack: '',
    thought: '',
    flagged: false,
    legacy: false,
    levelSb: '',
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
    ? [{ pos: draft.villPos, stack: draft.villStack, opponentId: draft.opponentId }]
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
  'heroStack' | 'levelBb' | 'playersDealt' | 'ante' | 'heroPos' | 'villPos' | 'straddles' | 'stage'
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
  return {
    heroPos: rotatePos(seats, prev?.hero_pos),
    // The opponents change from hand to hand: they are picked again (5.1c-5).
    villPos: '',
    straddles: session.kind === 'cash' ? straddles.map(String) : [],
    stage: prev?.stage ?? '',
    heroStack: stack == null ? '' : String(stack),
    levelBb: session.kind === 'mtt' && level != null ? String(level) : '',
    playersDealt: dealt == null ? '' : String(dealt),
    ante: levelAnte(session) === 'typed' ? String(prev?.ante ?? session.ante ?? '') : '',
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

export function blindsFor(session: HandSession, bb: number, anteText = ''): Blinds {
  const sb = bb === session.bb && session.sb != null ? session.sb : roundMoney(bb / 2);
  const mode = isOneOf(['each', 'bb'] as const, session.ante_mode) ? session.ante_mode : 'none';
  const kind = levelAnte(session);
  const typed = kind === 'typed' ? parseAmount(anteText) : null;
  const ante = kind === 'bb' ? bb : typed != null && typed > 0 ? typed : (session.ante ?? 0);
  return {
    sb,
    bb,
    ...(session.kind === 'cash' && session.straddle ? { straddle: session.straddle } : {}),
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
  const outcome = (machine && autoOutcome(machine)) || draft.outcome;
  const board = machine ? boardCheck(machine, draft.slots.slice(2)) : null;

  const input: HandInput = {
    blinds: blindsFor(session, bb, draft.ante),
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
    ...(isOneOf(OUTCOMES, outcome) && { outcome: outcome as Outcome }),
  };

  const pot = computePot(input);
  const manual = draft.resultText.trim() ? num(draft.resultText) : undefined;
  const result = manual !== undefined ? roundMoney(manual) : computeResult(input);
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
  };
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
  const villCards = draft.villCards.filter(isCard);
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
            },
          ]
        : [];
    }) as unknown as never,
    actions: d.actions as unknown as never,
    raw_line: draft.rawLine.trim() || null,
    outcome: isOneOf(OUTCOMES, d.outcome) ? d.outcome : null,
    result: d.result,
    pot_final: d.potFinal,
    hero_stack: num(draft.heroStack) ?? null,
    villain_stack: num(d.primary?.stack ?? draft.villStack) ?? null,
    eff_stack: d.eff?.amount ?? null,
    level_bb: session.kind === 'mtt' ? d.bb : null,
    ...levelAnteColumns(session, d),
    players_dealt: integerOrNull(draft.playersDealt),
    stage: session.kind === 'mtt' ? draft.stage || null : null,
    thought: draft.thought.trim() || null,
    flagged: draft.flagged,
    tags: draft.resultText.trim() ? ['manual_result'] : [],
    missing_data: d.missing,
  };
}

function integerOrNull(raw: string): number | null {
  const n = Number(raw.trim());
  return raw.trim() && Number.isInteger(n) && n >= 2 && n <= 10 ? n : null;
}

/** Columns of a saved hand that {@link fromHandRow} reads. */
export const HAND_EDIT_COLUMNS =
  'id, num, session_id, hero_cards, board, villain_cards, hero_pos, villain_pos, opponent_id, actions, raw_line, outcome, result, hero_stack, villain_stack, level_bb, players_dealt, ante, stage, thought, flagged, opponents';

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
  players_dealt: number | null;
  ante: number | null;
  stage: string | null;
  thought: string | null;
  flagged: boolean;
  /** `hands.opponents`: [{ pos, stack?, opponent_id? }] in the order picked. */
  opponents?: unknown;
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
    const x = o as { pos?: unknown; stack?: unknown; opponent_id?: unknown } | null;
    return x && typeof x.pos === 'string'
      ? [
          {
            pos: rename(x.pos),
            stack: str(x.stack),
            opponentId: typeof x.opponent_id === 'string' ? x.opponent_id : '',
          },
        ]
      : [];
  });
  if (fromColumn.length > 0) return fromColumn;

  const list: DraftOpponent[] = [];
  if (row.villain_pos) {
    list.push({
      pos: rename(row.villain_pos),
      stack: str(row.villain_stack),
      opponentId: row.opponent_id ?? '',
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
    outcome: row.outcome ?? '',
    resultText: '',
    heroStack: str(row.hero_stack),
    villStack: opponents[0]?.stack ?? str(row.villain_stack),
    levelBb: str(row.level_bb),
    playersDealt: str(row.players_dealt),
    ante: levelAnte(session) === 'typed' ? str(row.ante) : '',
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
