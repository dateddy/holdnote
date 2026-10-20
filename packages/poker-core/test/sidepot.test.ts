import { describe, expect, it } from 'vitest';
import { buildPots, chipUnit, settlePots, splitPot } from '../src/index';

const e = (seat: string, invested: number, folded = false) => ({ seat, invested, folded });

describe('buildPots', () => {
  it('everyone in for the same amount: one pot', () => {
    expect(buildPots([e('A', 100), e('B', 100), e('C', 100)])).toEqual([
      { amount: 300, eligible: ['A', 'B', 'C'] },
    ]);
  });

  it('3 players, one short all-in', () => {
    expect(buildPots([e('A', 1000), e('B', 3000), e('C', 3000)])).toEqual([
      { amount: 3000, eligible: ['A', 'B', 'C'] },
      { amount: 4000, eligible: ['B', 'C'] },
    ]);
  });

  it('4 players, two all-in levels', () => {
    const pots = buildPots([e('A', 500), e('B', 1500), e('C', 3000), e('D', 3000)]);
    expect(pots).toEqual([
      { amount: 2000, eligible: ['A', 'B', 'C', 'D'] },
      { amount: 3000, eligible: ['B', 'C', 'D'] },
      { amount: 3000, eligible: ['C', 'D'] },
    ]);
    expect(pots.reduce((s, p) => s + p.amount, 0)).toBe(8000);
  });

  it('a folded player has paid into the pot but cannot win it', () => {
    expect(buildPots([e('A', 1000), e('B', 3000), e('C', 3000), e('D', 200, true)])).toEqual([
      { amount: 3200, eligible: ['A', 'B', 'C'] },
      { amount: 4000, eligible: ['B', 'C'] },
    ]);
  });

  it('dead money above the short stack is shared by the pots it reaches', () => {
    // D folded after putting in 2000: 1000 into the main pot, 1000 into the side pot.
    expect(buildPots([e('A', 1000), e('B', 3000), e('C', 3000), e('D', 2000, true)])).toEqual([
      { amount: 4000, eligible: ['A', 'B', 'C'] },
      { amount: 5000, eligible: ['B', 'C'] },
    ]);
  });

  it('a lone survivor takes everything, folded money included', () => {
    expect(buildPots([e('A', 300), e('B', 100, true), e('C', 50, true)])).toEqual([
      { amount: 450, eligible: ['A'] },
    ]);
  });
});

describe('chipUnit and splitPot', () => {
  it('whole chips: unit 1; cents anywhere: unit 0.01', () => {
    expect(chipUnit([25, 50, 1000])).toBe(1);
    expect(chipUnit([0.25, 0.5, 10])).toBe(0.01);
  });

  it('an even split', () => {
    expect(splitPot(100, ['A', 'B'], ['A', 'B', 'C'], 1)).toEqual({ A: 50, B: 50 });
  });

  it('the odd chip goes to the winner closest to the left of the button', () => {
    expect(splitPot(101, ['B', 'C'], ['A', 'B', 'C'], 1)).toEqual({ B: 51, C: 50 });
    expect(splitPot(101, ['C', 'B'], ['A', 'B', 'C'], 1)).toEqual({ B: 51, C: 50 });
  });

  it('three-way split leaves two odd chips for the first two in order', () => {
    expect(splitPot(100, ['A', 'B', 'C'], ['A', 'B', 'C'], 1)).toEqual({ A: 34, B: 33, C: 33 });
    expect(splitPot(101, ['A', 'B', 'C'], ['A', 'B', 'C'], 1)).toEqual({ A: 34, B: 34, C: 33 });
  });

  it('cent unit for NL2: 0.25 blinds', () => {
    expect(splitPot(0.5, ['A', 'B', 'C'], ['A', 'B', 'C'], 0.01)).toEqual({
      A: 0.17,
      B: 0.17,
      C: 0.16,
    });
  });

  it('one winner takes the pot', () => {
    expect(splitPot(777, ['B'], ['A', 'B'], 1)).toEqual({ B: 777 });
  });
});

describe('settlePots', () => {
  const order = ['A', 'B', 'C'];

  it('pays each pot to its winners', () => {
    const r = settlePots(
      [e('A', 1000), e('B', 3000), e('C', 3000)],
      (_, pot) => (pot.eligible.length === 3 ? ['A'] : ['C']),
      order,
      1,
    );
    expect(r.pots.map((p) => p.winners)).toEqual([['A'], ['C']]);
    expect(r.payouts).toEqual({ A: 3000, C: 4000 });
  });

  it('splits a pot and gives the odd chip to the first seat in order', () => {
    const r = settlePots([e('A', 5), e('B', 5), e('C', 5)], () => ['B', 'A'], order, 1);
    expect(r.payouts).toEqual({ A: 8, B: 7 });
  });

  it('leaves a pot without winners unpaid', () => {
    const r = settlePots([e('A', 100), e('B', 100)], () => null, order, 1);
    expect(r.pots[0]?.winners).toBeNull();
    expect(r.payouts).toEqual({});
  });
});
