import { describe, expect, it } from 'vitest';
import {
  computePot,
  computeResult,
  replay,
  showdown,
  type ActInput,
  type Ante,
  type HandSetup,
} from '../src/index';
import { play, setup } from './helpers';

const NO_BOARD = { cards: [] };

/**
 * Play a hand and read the result both ways: the state machine (`showdown`, `replay().pot`) and
 * the money engine used when saving (`computePot` / `computeResult`).
 */
function both(s: HandSetup, inputs: ActInput[], outcome: 'win' | 'lose' = 'win') {
  const r = play(s, inputs);
  const machine = showdown(s, r.actions, NO_BOARD, { hole: {} });
  const input = {
    blinds: { sb: s.sb, bb: s.bb, ante: s.ante },
    heroPos: s.heroPos,
    villPos: s.villPos,
    actions: r.actions,
    outcome,
  } as const;
  return {
    state: r.state,
    machineResult: machine?.heroResult ?? null,
    machinePot: replay(s, r.actions).pot,
    enginePot: computePot(input).pot,
    engineResult: computeResult(input),
  };
}

describe('uncalled chips never go back to a folded seat (5.1c-6a-fix)', () => {
  it.each(['UTG', 'CO', 'BTN'] as const)('open from %s, everyone folds: +SB+BB', (hero) => {
    const s = setup({ heroPos: hero, villPos: 'BB', tracked: ['SB'], listedOnly: true });
    const x = both(s, [{ act: 'open', to: 150 }, { act: 'fold' }, { act: 'fold' }]);
    expect(x.state.phase.kind).toBe('won');
    expect(x.machineResult).toBe(75);
    expect(x.engineResult).toBe(75);
    expect(x.machinePot).toBe(125);
    expect(x.enginePot).toBe(125);
  });

  it('open from SB, BB folds: +BB (the 25 was already hers)', () => {
    const s = setup({ heroPos: 'SB', villPos: 'BB', listedOnly: true });
    const x = both(s, [{ act: 'open', to: 150 }, { act: 'fold' }]);
    expect(x.machineResult).toBe(50);
    expect(x.engineResult).toBe(50);
    expect(x.machinePot).toBe(100);
    expect(x.enginePot).toBe(100);
  });

  it('every picked opponent folds before hero acts: hero takes both blinds', () => {
    const s = setup({ heroPos: 'BTN', villPos: 'CO', listedOnly: true });
    const x = both(s, [{ act: 'fold' }]);
    expect(x.state.phase).toEqual({ kind: 'won', winner: 'BTN' });
    expect(x.machineResult).toBe(75);
    expect(x.machinePot).toBe(75);
    expect(x.enginePot).toBe(75);
  });

  it('walk to the BB: the BB gets back what is above the SB, +SB', () => {
    const s = setup({ heroPos: 'BB', villPos: 'SB', listedOnly: true });
    const x = both(s, [{ act: 'fold' }]);
    expect(x.state.phase).toEqual({ kind: 'won', winner: 'BB' });
    expect(x.machineResult).toBe(25);
    expect(x.machinePot).toBe(50);
    expect(x.enginePot).toBe(50);
  });

  it('3bet, the opener folds: hero gets back the uncalled part', () => {
    const s = setup({ heroPos: 'BTN', villPos: 'CO', listedOnly: true });
    const x = both(s, [{ act: 'open', to: 150 }, { act: 'raise', to: 450 }, { act: 'fold' }]);
    // CO's 150 + both blinds; 300 of hero's 450 comes back.
    expect(x.machineResult).toBe(225);
    expect(x.engineResult).toBe(225);
    expect(x.machinePot).toBe(375);
    expect(x.enginePot).toBe(375);
  });

  it('a straddle nobody calls stays in the pot when its owner is out', () => {
    const s = setup({ heroPos: 'BTN', villPos: 'CO', straddles: [100], listedOnly: true });
    const before = both(s, [{ act: 'fold' }]);
    expect(before.machineResult).toBe(175);
    expect(before.machinePot).toBe(175);
    expect(before.enginePot).toBe(175);

    const raised = both(s, [{ act: 'call' }, { act: 'raise', to: 400 }, { act: 'fold' }]);
    // CO called 100 then folded: 100 + straddle 100 + blinds 75.
    expect(raised.machineResult).toBe(275);
    expect(raised.engineResult).toBe(275);
  });

  it.each<[string, Ante, number]>([
    ['per-player ante 10 at 9 seats (hero paid one of them)', { mode: 'each', amount: 10 }, 155],
    ['BB ante 50', { mode: 'bb', amount: 50 }, 125],
  ])('MTT %s: the ante is dead money, hero takes it too', (_, ante, won) => {
    const s = setup({ heroPos: 'CO', villPos: 'BB', tracked: ['SB'], ante, listedOnly: true });
    const x = both(s, [{ act: 'open', to: 150 }, { act: 'fold' }, { act: 'fold' }]);
    expect(x.machineResult).toBe(won);
    expect(x.engineResult).toBe(won);
    expect(x.machinePot).toBe(x.enginePot);
  });

  it('the biggest all-in still in the hand gets its excess back', () => {
    const s = setup({
      heroPos: 'BTN',
      villPos: 'SB',
      tracked: ['BB'],
      listedOnly: true,
      stacks: { BTN: 1000, SB: 3000, BB: 5000 },
    });
    const r = play(s, [{ act: 'all-in' }, { act: 'all-in' }, { act: 'all-in' }], {
      cards: [],
    });
    expect(replay(s, r.actions).pot).toBe(7000);
    expect(r.state.players.find((p) => p.pos === 'BB')?.invested).toBe(3000);
  });

  it('hero folds: the loss is what hero put in, whatever the others did', () => {
    const s = setup({ heroPos: 'SB', villPos: 'BB', listedOnly: true });
    const x = both(s, [{ act: 'fold' }], 'lose');
    expect(x.machineResult).toBe(-25);
    expect(x.engineResult).toBe(-25);
  });
});
