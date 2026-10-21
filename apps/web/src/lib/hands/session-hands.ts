import {
  actionChips,
  POSITIONS,
  wentToShowdown,
  type ActionChip,
  type PotType,
  type Street,
  toBb,
} from 'poker-core';
import type { HandReviewInfo } from '@/lib/review/review';
import { isOneOf } from '@/lib/sessions/form';
import { buildReplayHand, type ReplayHand } from './replay';
import {
  deriveHand,
  fromHandRow,
  HAND_EDIT_COLUMNS,
  type HandRowIn,
  type HandSession,
} from './build';

/** Columns of one row of the hand table: the editable hand plus what the row shows. */
export const HAND_ROW_COLUMNS = `${HAND_EDIT_COLUMNS}, missing_data, created_at`;

export type HandRowDb = HandRowIn & {
  id: string;
  num: number;
  session_id: string;
  missing_data: boolean;
  created_at: string;
};

export type { HandReviewInfo };

export const POT_TYPES = ['limped', 'iso', 'single_raised', 'three_bet', 'four_bet_plus'] as const;

/** One row of the hand table (phone and desktop), everything ready to draw. */
export type HandRow = {
  id: string;
  num: number;
  createdAt: string;
  heroCards: string[];
  board: string[];
  heroPos: string | null;
  /** Main opponent's seat. */
  villPos: string | null;
  /** Opponents in the hand (2+ = multiway). */
  opponents: number;
  potType: PotType | null;
  chips: Record<Street, ActionChip[]>;
  /** Result in session money. */
  result: number | null;
  resultBb: number | null;
  potBb: number | null;
  showdown: boolean;
  flagged: boolean;
  /** The current review is accepted. */
  accepted: boolean;
  /** ⚑ and no accepted review yet. */
  needsReview: boolean;
  aiReviewed: boolean;
  missing: boolean;
  thought: string;
  level: number | null;
  stage: string | null;
  /** What the replayer plays; null when the hand has no big blind to price it with. */
  replay: ReplayHand | null;
  /** Effective stack in session money and in bb. */
  eff: { amount: number; bb: number } | null;
  /** Only the cross-session hand list sets it: where the hand was played. */
  sessionLabel?: string;
};

const NO_CHIPS = (): Record<Street, ActionChip[]> => ({
  preflop: [],
  flop: [],
  turn: [],
  river: [],
});

/** Rows of a session's hands. The chips and pot come from poker-core; nothing is computed here. */
export function buildHandRows(
  session: HandSession,
  hands: readonly HandRowDb[],
  reviews: ReadonlyMap<string, HandReviewInfo>,
): HandRow[] {
  return hands.map((h) => {
    const draft = fromHandRow(session, h);
    const derived = deriveHand(session, draft);
    const bb = h.level_bb ?? derived.bb ?? session.bb ?? null;
    const chips = derived.input && bb ? actionChips(derived.input, bb) : null;
    const review = reviews.get(h.id);
    const dealt = derived.machine?.players.filter((p) => p.actor !== 'hero' && p.tracked).length;
    // The stored result wins: it is what the totals add up, and it may have been typed by hand.
    const result = h.result ?? derived.result;
    return {
      id: h.id,
      num: h.num,
      createdAt: h.created_at,
      heroCards: h.hero_cards ?? [],
      board: h.board ?? [],
      heroPos: h.hero_pos,
      villPos: h.villain_pos,
      opponents: Math.max(dealt ?? 0, h.villain_pos ? 1 : 0),
      potType: chips?.potType ?? null,
      chips: chips?.streets ?? NO_CHIPS(),
      result,
      resultBb: result == null || !bb ? null : toBb(result, bb),
      potBb: derived.potFinal == null || !bb ? null : toBb(derived.potFinal, bb),
      showdown: derived.input ? wentToShowdown(derived.input) : false,
      replay: buildReplayHand(h.players_dealt ?? session.seats ?? 9, draft, derived),
      eff: derived.eff,
      flagged: h.flagged,
      accepted: review?.accepted === true,
      needsReview: h.flagged && !review?.accepted,
      aiReviewed: review?.hasAi === true,
      missing: h.missing_data,
      thought: (h.thought ?? '').trim(),
      level: h.level ?? null,
      stage: h.stage,
    };
  });
}

// --- filter and sort --------------------------------------------------------------------------

export const HAND_SORTS = ['latest', 'won', 'lost', 'pot'] as const;
export type HandSort = (typeof HAND_SORTS)[number];

export type HandListFilter = {
  /** Only hands that need another look. */
  review: boolean;
  showdown: boolean;
  /** Hero's seat, or empty. */
  pos: string;
  pot: PotType | '';
  /** MTT stage code, or empty. */
  stage: string;
  sort: HandSort;
};

export const EMPTY_HAND_FILTER: HandListFilter = {
  review: false,
  showdown: false,
  pos: '',
  pot: '',
  stage: '',
  sort: 'latest',
};

export const isHandFiltering = (f: HandListFilter): boolean =>
  f.review || f.showdown || f.pos !== '' || f.pot !== '' || f.stage !== '';

type Query = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseHandFilter(q: Query): HandListFilter {
  const pot = first(q.pot);
  const sort = first(q.sort);
  return {
    review: first(q.review) === '1',
    showdown: first(q.sd) === '1',
    pos: (first(q.pos) ?? '').trim().slice(0, 8),
    pot: isOneOf(POT_TYPES, pot) ? pot : '',
    stage: (first(q.stage) ?? '').trim().slice(0, 20),
    sort: isOneOf(HAND_SORTS, sort) ? sort : 'latest',
  };
}

/** Query string without the leading `?`; defaults are left out. */
export function serializeHandFilter(f: HandListFilter): string {
  const p = new URLSearchParams();
  if (f.review) p.set('review', '1');
  if (f.showdown) p.set('sd', '1');
  if (f.pos) p.set('pos', f.pos);
  if (f.pot) p.set('pot', f.pot);
  if (f.stage) p.set('stage', f.stage);
  if (f.sort !== 'latest') p.set('sort', f.sort);
  return p.toString();
}

export function filterHandRows(rows: readonly HandRow[], f: HandListFilter): HandRow[] {
  return rows.filter(
    (r) =>
      (!f.review || r.needsReview) &&
      (!f.showdown || r.showdown) &&
      (!f.pos || r.heroPos === f.pos) &&
      (!f.pot || r.potType === f.pot) &&
      (!f.stage || r.stage === f.stage),
  );
}

/** Sorted copy. Rows with no value go last whichever way the sort runs; ties keep the newest first. */
export function sortHandRows(rows: readonly HandRow[], sort: HandSort): HandRow[] {
  const key = (r: HandRow): number | null =>
    sort === 'won'
      ? r.resultBb == null
        ? null
        : -r.resultBb
      : sort === 'lost'
        ? r.resultBb
        : sort === 'pot'
          ? r.potBb == null
            ? null
            : -r.potBb
          : -r.num;
  return [...rows].sort((a, b) => {
    const x = key(a);
    const y = key(b);
    if (x == null && y == null) return b.num - a.num;
    if (x == null) return 1;
    if (y == null) return -1;
    return x - y || b.num - a.num;
  });
}

/** What the position and stage menus offer: only values that exist in this session. */
export function handOptions(rows: readonly HandRow[]): { positions: string[]; stages: string[] } {
  const positions = new Set<string>();
  const stages = new Set<string>();
  for (const r of rows) {
    if (r.heroPos) positions.add(r.heroPos);
    if (r.stage) stages.add(r.stage);
  }
  const order = (p: string) => POSITIONS.indexOf(p as (typeof POSITIONS)[number]);
  return { positions: [...positions].sort((a, b) => order(a) - order(b)), stages: [...stages] };
}
