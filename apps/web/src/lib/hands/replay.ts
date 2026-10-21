import { canonPos, tableOrder, toBb, type HandInput, type Position } from 'poker-core';
import {
  boardCards,
  heroCards,
  opponentCards,
  pickedOpponents,
  type HandDerived,
  type HandDraft,
} from './build';

export type ReplayRole = 'hero' | 'opponent' | 'other';

export type ReplaySeatInfo = {
  pos: Position;
  /** Key of this seat in `replayFrames`: `hero`, `villain` or the position. */
  key: string;
  /** Hero green, a picked opponent orange, anyone else neutral. */
  role: ReplayRole;
};

/** Everything the replayer needs about one hand, as plain data (it crosses from server to client). */
export type ReplayHand = {
  /** Big blind of the hand (the level's, for a tournament). */
  bb: number;
  input: HandInput;
  /** Every seat of the table in order, the button at the bottom. */
  table: ReplaySeatInfo[];
  /** Opponents picked for the hand (2 or more = multiway). */
  opponents: number;
  heroCards: string[];
  board: string[];
  /** Hole cards shown at showdown, by seat key. */
  shown: Record<string, string[]>;
  /** Name of each known hand (`pair`, `full_house`...), by seat key. */
  ranks: Record<string, string>;
  /** Pots, main first, with the seat keys that won each. */
  pots: { amount: number; eligible: string[]; winners: string[] }[];
  result: number | null;
  resultBb: number | null;
};

/** The replayer's view of a derived hand; null when the hand cannot be priced (no big blind). */
export function buildReplayHand(
  seats: number,
  draft: HandDraft,
  derived: HandDerived,
): ReplayHand | null {
  const { input, bb } = derived;
  if (!input || !bb) return null;

  const canon = (pos: string) => canonPos(seats, pos as Position);
  const heroSeat = input.heroPos ? canon(input.heroPos) : null;
  const villSeat = input.villPos ? canon(input.villPos) : null;
  const picked = pickedOpponents(draft);
  const opponentSeats = new Set(picked.map((o) => canon(o.pos)));

  const keyOf = (pos: Position): string =>
    pos === heroSeat ? 'hero' : pos === villSeat ? 'villain' : pos;
  const table = tableOrder(seats).map((pos): ReplaySeatInfo => ({
    pos,
    key: keyOf(pos),
    role:
      pos === heroSeat ? 'hero' : opponentSeats.has(pos) || pos === villSeat ? 'opponent' : 'other',
  }));

  const shown: Record<string, string[]> = {};
  for (const o of picked) {
    const cards = opponentCards(o).filter(Boolean);
    if (cards.length === 2) shown[keyOf(canon(o.pos))] = cards;
  }

  const sd = derived.showdown;
  const ranks: Record<string, string> = {};
  for (const [pos, rank] of Object.entries(sd?.ranks ?? {})) {
    if (rank) ranks[keyOf(pos as Position)] = rank.category;
  }

  // The other opponents' stacks (picked on the table panel) let their all-ins show on the replay.
  const seatStacks = { ...input.seatStacks };
  for (const o of picked) {
    const stack = Number(o.stack);
    const seat = canon(o.pos);
    if (o.stack !== '' && Number.isFinite(stack) && seat !== villSeat && seat !== heroSeat) {
      seatStacks[seat] ??= stack;
    }
  }

  return {
    bb,
    input: Object.keys(seatStacks).length > 0 ? { ...input, seatStacks } : input,
    table,
    opponents: picked.length,
    heroCards: heroCards(draft),
    board: boardCards(draft),
    shown,
    ranks,
    pots: (sd?.pots ?? []).map((p) => ({
      amount: p.amount,
      eligible: p.eligible.map(keyOf),
      winners: (p.winners ?? []).map(keyOf),
    })),
    result: derived.result,
    resultBb: derived.result == null ? null : toBb(derived.result, bb),
  };
}
