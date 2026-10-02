import { roundMoney, toBb } from 'poker-core';

export const HAND_FILTERS = ['all', 'flagged', 'missing', 'unreviewed', 'reviewed'] as const;
export type HandFilter = (typeof HAND_FILTERS)[number];

/** One row of the hand list: hand columns plus whether its current review is accepted. */
export type ListHand = {
  id: string;
  num: number;
  hero_cards: string[] | null;
  board: string[] | null;
  hero_pos: string | null;
  villain_pos: string | null;
  eff_stack: number | null;
  result: number | null;
  level_bb: number | null;
  flagged: boolean;
  missing_data: boolean;
  reviewed: boolean;
};

export const LIST_COLUMNS =
  'id, num, hero_cards, board, hero_pos, villain_pos, eff_stack, result, level_bb, flagged, missing_data';

export function filterHands(hands: ListHand[], filter: HandFilter): ListHand[] {
  switch (filter) {
    case 'flagged':
      return hands.filter((h) => h.flagged);
    case 'missing':
      return hands.filter((h) => h.missing_data);
    case 'reviewed':
      return hands.filter((h) => h.reviewed);
    case 'unreviewed':
      return hands.filter((h) => !h.reviewed);
    default:
      return hands;
  }
}

/** Big blind of a hand: MTT hands carry their own level, cash uses the session BB. */
export function handBbOf(
  hand: Pick<ListHand, 'level_bb'>,
  sessionBb: number | null,
): number | null {
  return hand.level_bb ?? sessionBb;
}

export function summarize(hands: ListHand[], sessionBb: number | null) {
  let totalBb = 0;
  for (const h of hands) {
    const bb = handBbOf(h, sessionBb);
    if (h.result != null && bb) totalBb += h.result / bb;
  }
  return {
    count: hands.length,
    totalBb: roundMoney(totalBb),
    missing: hands.filter((h) => h.missing_data).length,
    reviewed: hands.filter((h) => h.reviewed).length,
  };
}

export const resultBb = (result: number | null, bb: number | null): number | null =>
  result == null || !bb ? null : toBb(result, bb);
