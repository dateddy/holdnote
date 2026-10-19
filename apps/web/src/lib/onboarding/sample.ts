import { parseShorthand, type Action, type Position } from 'poker-core';
import type { HandDraft, HandSession } from '@/lib/hands/build';

/**
 * The sample hand of onboarding step 3 (spec 3.2): a live 25/50 cash hand, already reviewed. The
 * player looks at it, then records it again in practice mode (nothing is saved, DEC-042).
 * The review text lives in the messages (`onboarding.sample_*`), so it follows the language.
 */
export const SAMPLE_SESSION: HandSession & { currency: string } = {
  kind: 'cash',
  mode: 'live',
  sb: 25,
  bb: 50,
  straddle: null,
  ante_mode: 'none',
  ante: null,
  buyin: 5000,
  seats: 9,
  mtt: null,
  currency: 'CHIP',
};

export const SAMPLE = {
  heroCards: ['As', 'Qs'],
  board: ['Ks', '7d', '2c', '9h', '4c'],
  heroPos: 'BTN' as Position,
  villPos: 'BB' as Position,
  heroStack: 5000,
  villStack: 5000,
  line: 'H o150 V c / V x H b100 V c / V x H x / V b300 H c',
  outcome: 'lose',
  /** Hero put in 150 + 100 + 300. */
  result: -550,
  errorTags: ['call_too_loose'],
  evVerdict: 'mistake',
} as const;

export const SAMPLE_ACTIONS: Action[] = parseShorthand(SAMPLE.line, {
  heroPos: SAMPLE.heroPos,
  villPos: SAMPLE.villPos,
}).actions;

export const PRACTICE_PARTS = ['cards', 'board', 'positions', 'actions', 'outcome'] as const;
export type PracticePart = (typeof PRACTICE_PARTS)[number];

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

/** The fields that matter when comparing actions: who, what, how much, on which street. */
const actionKey = (a: Action) =>
  // Calls take their amount from the betting, so only bets, raises and all-ins compare amounts.
  `${a.street}|${a.actor}|${a.act}|${a.act === 'call' ? '' : (a.amount ?? '')}`;

/** Which parts of a practice hand match the sample. Card order inside hole cards does not matter. */
export function comparePractice(
  draft: Pick<HandDraft, 'slots' | 'heroPos' | 'villPos' | 'outcome'>,
  actions: Action[],
): Record<PracticePart, boolean> {
  const hero = draft.slots.slice(0, 2).filter(Boolean);
  const board = draft.slots.slice(2).filter(Boolean);
  return {
    cards: sameSet(hero, SAMPLE.heroCards),
    board:
      board.length === SAMPLE.board.length &&
      sameSet(board.slice(0, 3), SAMPLE.board.slice(0, 3)) &&
      board.slice(3).every((c, i) => c === SAMPLE.board[3 + i]),
    positions: draft.heroPos === SAMPLE.heroPos && draft.villPos === SAMPLE.villPos,
    actions:
      actions.length === SAMPLE_ACTIONS.length &&
      actions.every((a, i) => actionKey(a) === actionKey(SAMPLE_ACTIONS[i]!)),
    outcome: draft.outcome === SAMPLE.outcome,
  };
}
