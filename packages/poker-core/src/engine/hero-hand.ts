import { STREETS, type Card, type Street } from '../types';
import { compareRanks, evaluate, type HandRank } from './evaluate';

export type PostflopStreet = Exclude<Street, 'preflop'>;

export interface StreetHand {
  street: PostflopStreet;
  rank: HandRank;
  /** River only: the five board cards alone are as good, so Hero's cards add nothing. */
  playsBoard: boolean;
}

const BOARD_SIZE: Record<PostflopStreet, number> = { flop: 3, turn: 4, river: 5 };

/**
 * Hero's best hand at each street that was dealt, through `through` (the street Hero left the
 * hand on; default: all). Empty when Hero's two cards are not both known.
 */
export function heroHandByStreet(
  hole: readonly Card[],
  board: readonly Card[],
  through: Street = 'river',
): StreetHand[] {
  if (hole.length !== 2) return [];
  const last = STREETS.indexOf(through);
  const out: StreetHand[] = [];
  for (const street of ['flop', 'turn', 'river'] as const) {
    if (STREETS.indexOf(street) > last || board.length < BOARD_SIZE[street]) break;
    const cards = board.slice(0, BOARD_SIZE[street]);
    const rank = evaluate([...hole, ...cards]);
    if (!rank) break;
    const boardRank = street === 'river' ? evaluate(cards) : null;
    out.push({ street, rank, playsBoard: !!boardRank && compareRanks(rank, boardRank) === 0 });
  }
  return out;
}

const NAME: Record<number, [string, string]> = {
  2: ['two', 'twos'],
  3: ['three', 'threes'],
  4: ['four', 'fours'],
  5: ['five', 'fives'],
  6: ['six', 'sixes'],
  7: ['seven', 'sevens'],
  8: ['eight', 'eights'],
  9: ['nine', 'nines'],
  10: ['ten', 'tens'],
  11: ['jack', 'jacks'],
  12: ['queen', 'queens'],
  13: ['king', 'kings'],
  14: ['ace', 'aces'],
};
const one = (v: number | undefined) => NAME[v ?? 0]?.[0] ?? '?';
const many = (v: number | undefined) => NAME[v ?? 0]?.[1] ?? '?';

/** Plain English for a rank, as the AI context says it: "full house, queens full of aces". */
export function describeRank(rank: HandRank): string {
  const [, a, b] = rank.values;
  switch (rank.category) {
    case 'high_card':
      return `high card ${one(a)}`;
    case 'pair':
      return `pair of ${many(a)}`;
    case 'two_pair':
      return `two pair, ${many(a)} and ${many(b)}`;
    case 'trips':
      return `three of a kind, ${many(a)}`;
    case 'straight':
      return `straight, ${one(a)} high`;
    case 'flush':
      return `flush, ${one(a)} high`;
    case 'full_house':
      return `full house, ${many(a)} full of ${many(b)}`;
    case 'quads':
      return `four of a kind, ${many(a)}`;
    case 'straight_flush':
      return `straight flush, ${one(a)} high`;
    case 'royal_flush':
      return 'royal flush';
  }
}
