import { describe, expect, it } from 'vitest';
import { describeRank, evaluate, heroHandByStreet, parseCards } from '../src/index';

const hands = (hole: string, board: string, through?: Parameters<typeof heroHandByStreet>[2]) =>
  heroHandByStreet(parseCards(hole), parseCards(board), through).map(
    (h) => `${h.street}: ${describeRank(h.rank)}${h.playsBoard ? ' (board)' : ''}`,
  );

describe('heroHandByStreet', () => {
  it('A♦Q♦: pair of queens on the flop, two pair on the turn, full house on the river', () => {
    expect(hands('Ad Qd', 'Qc 7s 2h Ah Qh')).toEqual([
      'flop: pair of queens',
      'turn: two pair, aces and queens',
      'river: full house, queens full of aces',
    ]);
  });

  it('only the streets that were dealt', () => {
    expect(hands('Ad Qd', '')).toEqual([]);
    expect(hands('Ad Qd', 'Qc 7s 2h')).toEqual(['flop: pair of queens']);
    expect(hands('Ad Qd', 'Kd 7d 2d 5c')).toEqual([
      'flop: flush, ace high',
      'turn: flush, ace high',
    ]);
  });

  it('stops at the street Hero left the hand', () => {
    expect(hands('Ad Qd', 'Qc 7s 2h Ah Qh', 'flop')).toEqual(['flop: pair of queens']);
    expect(hands('Ad Qd', 'Qc 7s 2h Ah Qh', 'preflop')).toEqual([]);
    expect(hands('Ad Qd', 'Qc 7s 2h Ah Qh', 'river')).toHaveLength(3);
  });

  it('marks a river where the board alone is the best hand', () => {
    expect(hands('2c 3d', '9h 8d 7c 6s 5h')).toContain('river: straight, nine high (board)');
    expect(hands('Tc 3d', '9h 8d 7c 6s 5h')).toContain('river: straight, ten high');
  });

  it('nothing when a card is unknown, missing or repeated', () => {
    expect(hands('Ad', 'Qc 7s 2h')).toEqual([]);
    expect(heroHandByStreet(parseCards('Ad Q?'), parseCards('Qc 7s 2h'))).toEqual([]);
    expect(hands('Ad Qd', 'Qd 7s 2h')).toEqual([]);
  });
});

describe('describeRank', () => {
  const say = (cards: string) => describeRank(evaluate(parseCards(cards))!);
  it.each([
    ['Ah Kd 9c 7s 4h', 'high card ace'],
    ['9h 9d Ac 7s 4h', 'pair of nines'],
    ['6h 6d 6c As 4h', 'three of a kind, sixes'],
    ['5h 4d 3c 2s Ah', 'straight, five high'],
    ['Ah Ad As Ac 9h', 'four of a kind, aces'],
    ['9h 8h 7h 6h 5h', 'straight flush, nine high'],
    ['Ah Kh Qh Jh Th', 'royal flush'],
    ['2h 2d 2c 3s 3h', 'full house, twos full of threes'],
  ])('%s → %s', (cards, text) => {
    expect(say(cards)).toBe(text);
  });
});
