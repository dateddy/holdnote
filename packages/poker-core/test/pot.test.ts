import { describe, expect, it } from 'vitest';
import { computePot, resolveActions } from '../src/index';
import { hand } from './helpers';

const BTN_VS_BB = { heroPos: 'BTN', villPos: 'BB' } as const;

describe('computePot: blinds and preflop', () => {
  it('returns the uncalled half of the big blind when everyone folds', () => {
    const p = computePot(hand('H f', { heroPos: 'UTG' }));
    expect(p.pot).toBe(50);
    expect(p.heroInvested).toBe(0);
    expect(p.exact).toBe(true);
  });

  it('open and call from the big blind', () => {
    const p = computePot(hand('H o150 V c', BTN_VS_BB));
    expect(p.pot).toBe(325);
    expect(p.heroInvested).toBe(150);
    expect(p.villainInvested).toBe(150);
  });

  it('charges the hero blind when hero sits in the small blind', () => {
    const p = computePot(hand('V o150 H c', { heroPos: 'SB', villPos: 'BTN' }));
    expect(p.pot).toBe(350);
    expect(p.heroInvested).toBe(150);
  });

  it('limped pot', () => {
    const p = computePot(hand('UTG lp H lp V x', BTN_VS_BB));
    expect(p.pot).toBe(175);
    expect(p.heroInvested).toBe(50);
  });

  it('straddle sets the price to call', () => {
    const p = computePot(
      hand('H c V c', {
        heroPos: 'CO',
        villPos: 'BTN',
        blinds: { sb: 25, bb: 50, straddle: 100, ante: { mode: 'none' } },
      }),
    );
    expect(p.pot).toBe(375);
    expect(p.heroInvested).toBe(100);
  });
});

describe('computePot: uncalled bets', () => {
  it('returns a bet nobody called', () => {
    const p = computePot(hand('H o150 V c / V x H b200 V f', BTN_VS_BB));
    expect(p.pot).toBe(325);
    expect(p.heroInvested).toBe(150);
  });

  it('returns the uncalled part of a 3-bet', () => {
    const p = computePot(hand('H o150 V 3b450 H f', BTN_VS_BB));
    expect(p.pot).toBe(325);
    expect(p.villainInvested).toBe(150);
  });

  it('caps a call at the caller stack and returns the excess', () => {
    const p = computePot(
      hand('H o150 V ai H c', { ...BTN_VS_BB, heroStack: 1000, villStack: 5000 }),
    );
    expect(p.pot).toBe(2025);
    expect(p.villainInvested).toBe(1000);
    expect(p.heroInvested).toBe(1000);
  });
});

describe('resolveActions', () => {
  it('fills call and all-in amounts from the betting state and stacks', () => {
    const actions = resolveActions(
      hand('H o150 V 3b450 H ai V c', { ...BTN_VS_BB, heroStack: 1000, villStack: 5000 }),
    );
    expect(actions.map((a) => a.amount)).toEqual([150, 450, 1000, 1000]);
  });

  it('keeps checks and folds without amounts', () => {
    const actions = resolveActions(hand('H o150 V c / V x H b200 V f', BTN_VS_BB));
    expect(actions.map((a) => a.amount)).toEqual([150, 150, undefined, 200, undefined]);
  });

  it('is idempotent', () => {
    const input = hand('H o150 V 3b450 H ai V c', {
      ...BTN_VS_BB,
      heroStack: 1000,
      villStack: 5000,
    });
    const once = resolveActions(input);
    expect(resolveActions({ ...input, actions: once })).toEqual(once);
  });
});

describe('computePot: multiway', () => {
  it('keeps chips of players who fold later', () => {
    const p = computePot(hand('H o150 CO c V c / V x H b300 CO c V f / H b600 CO f', BTN_VS_BB));
    expect(p.pot).toBe(1075);
    expect(p.heroInvested).toBe(450);
    expect(p.invested.CO).toBe(450);
  });
});

describe('computePot: antes', () => {
  const blinds = (ante: { mode: 'each' | 'bb'; amount: number }) => ({ sb: 50, bb: 100, ante });

  it('each player: pot depends on players dealt this hand', () => {
    const line = 'H o250 V c';
    const nine = computePot(
      hand(line, { ...BTN_VS_BB, blinds: blinds({ mode: 'each', amount: 10 }), playersDealt: 9 }),
    );
    const seven = computePot(
      hand(line, { ...BTN_VS_BB, blinds: blinds({ mode: 'each', amount: 10 }), playersDealt: 7 }),
    );
    expect(nine.pot).toBe(640);
    expect(seven.pot).toBe(620);
    expect(nine.heroInvested).toBe(260);
    expect(seven.heroInvested).toBe(260);
  });

  it('each player without players dealt is not exact', () => {
    const p = computePot(
      hand('H o250 V c', { ...BTN_VS_BB, blinds: blinds({ mode: 'each', amount: 10 }) }),
    );
    expect(p.exact).toBe(false);
    expect(p.issues).toContain('missing_players_for_ante');
    // Hero still knows what hero put in.
    expect(p.heroExact).toBe(true);
    expect(p.heroInvested).toBe(260);
  });

  it('big blind ante is paid by the hero only when hero is BB', () => {
    const asBb = computePot(
      hand('V o250 H c', {
        heroPos: 'BB',
        villPos: 'BTN',
        blinds: blinds({ mode: 'bb', amount: 100 }),
      }),
    );
    expect(asBb.pot).toBe(650);
    expect(asBb.heroInvested).toBe(350);

    const asBtn = computePot(
      hand('H o250 V c', { ...BTN_VS_BB, blinds: blinds({ mode: 'bb', amount: 100 }) }),
    );
    expect(asBtn.pot).toBe(650);
    expect(asBtn.heroInvested).toBe(250);
    expect(asBtn.villainInvested).toBe(350);
  });

  it('ante comes off the stack before an all-in', () => {
    const p = computePot(
      hand('H ai V c', {
        ...BTN_VS_BB,
        blinds: blinds({ mode: 'each', amount: 10 }),
        playersDealt: 8,
        heroStack: 1000,
        villStack: 5000,
      }),
    );
    expect(
      resolveActions(
        hand('H ai', {
          heroStack: 1000,
          blinds: blinds({ mode: 'each', amount: 10 }),
          playersDealt: 8,
        }),
      )[0]?.amount,
    ).toBe(990);
    expect(p.heroInvested).toBe(1000);
    expect(p.pot).toBe(50 + 990 + 990 + 80);
  });
});

describe('computePot: missing data', () => {
  it('all-in without amount or stack is not exact', () => {
    const p = computePot(hand('H o150 V ai H c', BTN_VS_BB));
    expect(p.exact).toBe(false);
    expect(p.issues).toContain('all_in_without_stack');
  });

  it('bet without amount is not exact', () => {
    const p = computePot({
      blinds: { sb: 25, bb: 50, ante: { mode: 'none' } },
      actions: [{ street: 'preflop', actor: 'hero', act: 'raise' }],
    });
    expect(p.exact).toBe(false);
    expect(p.issues).toContain('missing_amount');
  });

  it('records whether hero acted', () => {
    expect(computePot(hand('V o150', BTN_VS_BB)).heroSeen).toBe(false);
    expect(computePot(hand('H f', BTN_VS_BB)).heroSeen).toBe(true);
  });
});

describe('computePot: steps and streets', () => {
  it('reports pot before/after and price to call for each action', () => {
    const p = computePot(hand('H o150 V c', BTN_VS_BB));
    expect(p.steps.map((s) => [s.potBefore, s.potAfter, s.toCall])).toEqual([
      [75, 225, 50],
      [225, 325, 100],
    ]);
  });

  it('reports pot at the start and end of each street that has actions', () => {
    const p = computePot(hand('H o150 V c / V x H b200 V c / V x H x', BTN_VS_BB));
    expect(p.streets.map((s) => [s.street, s.potStart, s.potEnd])).toEqual([
      ['preflop', 0, 325],
      ['flop', 325, 725],
      ['turn', 725, 725],
    ]);
  });

  it('works with cents', () => {
    const p = computePot(
      hand('H o0.06 V c / V x H b0.1 V c', {
        ...BTN_VS_BB,
        blinds: { sb: 0.01, bb: 0.02, ante: { mode: 'none' } },
      }),
    );
    expect(p.pot).toBe(0.33);
    expect(p.heroInvested).toBe(0.16);
  });
});
