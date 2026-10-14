import { describe, expect, it } from 'vitest';
import { emptyDraft, deriveHand } from '@/lib/hands/build';
import { comparePractice, SAMPLE, SAMPLE_ACTIONS, SAMPLE_SESSION } from './sample';

const slots = (hero: string[], board: string[]) => [
  ...hero,
  ...board,
  ...Array(5 - board.length).fill(''),
];

const perfect = {
  slots: slots(['Qs', 'As'], ['7d', 'Ks', '2c', '9h', '4c']),
  heroPos: 'BTN',
  villPos: 'BB',
  outcome: 'lose',
};

describe('sample hand', () => {
  it('parses cleanly into 9 actions', () => {
    expect(SAMPLE_ACTIONS).toHaveLength(9);
    expect(SAMPLE_ACTIONS[0]).toMatchObject({ street: 'preflop', actor: 'hero', amount: 150 });
  });

  it('computes the stated result: -550 (-11 bb)', () => {
    const draft = {
      ...emptyDraft(SAMPLE_SESSION, null),
      ...perfect,
      actions: SAMPLE_ACTIONS,
      heroStack: String(SAMPLE.heroStack),
      villStack: String(SAMPLE.villStack),
    };
    const d = deriveHand(SAMPLE_SESSION, draft);
    expect(d.result).toBe(SAMPLE.result);
    expect(d.resultBb).toBe(-11);
  });
});

describe('comparePractice', () => {
  it('accepts the same hand, hole cards and flop in any order', () => {
    expect(comparePractice(perfect, SAMPLE_ACTIONS)).toEqual({
      cards: true,
      board: true,
      positions: true,
      actions: true,
      outcome: true,
    });
  });

  it('flags each part that differs', () => {
    const wrong = comparePractice(
      {
        slots: slots(['As', 'Qh'], ['Ks', '7d', '2c', '4c', '9h']),
        heroPos: 'CO',
        villPos: 'BB',
        outcome: 'win',
      },
      SAMPLE_ACTIONS.slice(0, 8),
    );
    expect(wrong).toEqual({
      cards: false,
      board: false,
      positions: false,
      actions: false,
      outcome: false,
    });
  });

  it('a different bet size is a wrong action', () => {
    const changed = SAMPLE_ACTIONS.map((a, i) => (i === 3 ? { ...a, amount: 200 } : a));
    expect(comparePractice(perfect, changed).actions).toBe(false);
  });
});
