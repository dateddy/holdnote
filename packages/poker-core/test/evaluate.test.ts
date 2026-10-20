import { describe, expect, it } from 'vitest';
import { compareRanks, evaluate, parseCards, type HandCategory } from '../src/index';

const rank = (s: string) => {
  const r = evaluate(parseCards(s));
  if (!r) throw new Error(`no rank for ${s}`);
  return r;
};
const beats = (a: string, b: string) => expect(compareRanks(rank(a), rank(b))).toBeGreaterThan(0);
const ties = (a: string, b: string) => expect(compareRanks(rank(a), rank(b))).toBe(0);

describe('evaluate: the ten categories', () => {
  const cases: [HandCategory, string][] = [
    ['high_card', 'Ah Kd 9c 7s 4h 3d 2c'],
    ['pair', 'Ah Ad 9c 7s 4h 3d 2c'],
    ['two_pair', 'Ah Ad 9c 9s 4h 3d 2c'],
    ['trips', 'Ah Ad As 9s 4h 3d 2c'],
    ['straight', '9h 8d 7c 6s 5h Kd 2c'],
    ['flush', 'Ah 9h 7h 4h 2h Kd Qc'],
    ['full_house', 'Ah Ad As 9s 9h 3d 2c'],
    ['quads', 'Ah Ad As Ac 9h 3d 2c'],
    ['straight_flush', '9h 8h 7h 6h 5h Kd 2c'],
    ['royal_flush', 'Ah Kh Qh Jh Th 3d 2c'],
  ];
  it.each(cases)('%s', (category, cards) => {
    expect(rank(cards).category).toBe(category);
  });

  it('each category beats the one below', () => {
    const ordered = cases.map(([, c]) => c);
    for (let i = 1; i < ordered.length; i++) beats(ordered[i]!, ordered[i - 1]!);
  });

  it('the wheel A-2-3-4-5 is a five-high straight, below a six-high', () => {
    expect(rank('Ah 2d 3c 4s 5h Kd 9c').category).toBe('straight');
    beats('2h 3d 4c 5s 6h Kd 9c', 'Ah 2d 3c 4s 5h Kd 9c');
  });

  it('a steel wheel is a straight flush, not a royal', () => {
    expect(rank('Ah 2h 3h 4h 5h Kd 9c').category).toBe('straight_flush');
  });
});

describe('evaluate: kickers', () => {
  it('the same pair: the kickers decide', () => {
    beats('Ah Ad Kc 7s 4h 3d 2c', 'Ac As Qc 7d 4d 3h 2d');
    beats('Ah Ad Kc 8s 4h 3d 2c', 'Ac As Kd 7d 4d 3h 2d');
  });
  it('two pair: the fifth card decides', () => {
    beats('Ah Ad 9c 9s Kh 3d 2c', 'Ac As 9d 9h Qd 3h 2d');
  });
  it('flush: lower cards decide', () => {
    beats('Ah Kh 9h 4h 2h 7d 3c', 'Ad Kd 8d 4d 2d 7c 3s');
  });
  it('a straight flush beats a higher flush', () => {
    beats('5h 4h 3h 2h Ah Kd 9c', 'Kd Qd 9d 7d 2d Ah 3c');
  });
  it('the best five of seven are used', () => {
    ties('Ah Ad Kc Qs Jh 3d 2c', 'Ac As Kd Qh Jd 4d 5c');
  });
});

describe('evaluate: ties and the board', () => {
  it('both play the board', () => {
    // Board is a broadway straight; neither hole pair improves it.
    ties('Ts Jd Qc Kh Ah 2c 3c', 'Ts Jd Qc Kh Ah 4d 5d');
  });
  it('a pair of kings beats a pair of queens on the same board', () => {
    beats('Ah Kd Ks Qd 9c 4h 2s', 'Ac Qh Ks Qd 9c 4h 2s');
  });
  it('board A♣ Q♣ Q♦ 9♠ Q♠: A♥A♦ (full house) loses to Q♥A♠ (quads)', () => {
    const board = 'Ac Qc Qd 9s Qs';
    const hero = rank(`${board} Ah Ad`);
    const villain = rank(`${board} Qh As`);
    expect(hero.category).toBe('full_house');
    expect(villain.category).toBe('quads');
    expect(compareRanks(hero, villain)).toBeLessThan(0);
  });
});

describe('evaluate: not enough to say', () => {
  it('fewer than five cards, duplicates, unknown suits', () => {
    expect(evaluate(parseCards('Ah Kd 9c 7s'))).toBeNull();
    expect(evaluate(parseCards('Ah Ah 9c 7s 4h'))).toBeNull();
    expect(evaluate(parseCards('Ah K? 9c 7s 4h'))).toBeNull();
  });
  it('five and six cards work too', () => {
    expect(rank('Ah Kh Qh Jh Th').category).toBe('royal_flush');
    expect(rank('Ah Ad 9c 9s 4h 3d').category).toBe('two_pair');
  });
});
