import { describe, expect, it } from 'vitest';
import {
  act,
  boardCheck,
  computeEff,
  computePot,
  computeResult,
  edit,
  forcedBets,
  formatShorthand,
  nextStack,
  parseShorthand,
  replay,
  showdown,
  resolveActions,
  settle,
  tableOrder,
  toBb,
  undo,
  type Action,
} from '../src/index';
import { NO_ANTE, play, setup, toAct } from './helpers';

const BOARD = ['Ah', 'Kd', '7c', '2s', '9h'] as const;
const FULL_BOARD = { cards: [...BOARD] };
const BLINDS = { sb: 25, bb: 50, ante: NO_ANTE };

describe('tableOrder and forcedBets', () => {
  it('lists seats in preflop order for every table size', () => {
    expect(tableOrder(9)).toEqual(['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
    expect(tableOrder(6)).toEqual(['LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
    expect(tableOrder(3)).toEqual(['BTN', 'SB', 'BB']);
    expect(tableOrder(2)).toEqual(['BTN', 'BB']);
  });

  it('posts ante first, then SB, BB, straddles', () => {
    const posts = forcedBets(setup({ ante: { mode: 'bb', amount: 50 }, straddles: [100] }));
    expect(posts.map((a) => [a.act, a.pos, a.amount])).toEqual([
      ['post_ante', 'BB', 50],
      ['post_sb', 'SB', 25],
      ['post_bb', 'BB', 50],
      ['post_straddle', 'UTG', 100],
    ]);
  });
});

describe('computePot understands forced bets in actions', () => {
  const hu = { heroPos: 'BTN', villPos: 'BB' } as const;
  const base = { blinds: BLINDS, ...hu } as const;
  const line = parseShorthand('H o150 V c / V x H b100 V c', hu).actions;

  it('gives the same pot with or without posts', () => {
    const without = computePot({ ...base, actions: line });
    const withPosts = computePot({ ...base, actions: [...forcedBets(setup(hu)), ...line] });
    expect(withPosts.pot).toBe(without.pot);
    expect(withPosts.invested).toEqual(without.invested);
  });

  it('counts per-player ante as dead money outside the bet level', () => {
    const s = setup({ ...hu, ante: { mode: 'each', amount: 10 } });
    const p = computePot({ ...base, actions: [...forcedBets(s), ...line] });
    expect(p.pot).toBe(325 + 200 + 90);
    const open = p.steps.find((x) => x.action.actor === 'hero' && x.action.act === 'raise');
    expect(open?.toCall).toBe(50);
  });

  it('formatShorthand ignores posts and dead money', () => {
    const dead: Action = { street: 'preflop', actor: 'other', pos: 'CO', act: 'dead', amount: 50 };
    expect(formatShorthand([...forcedBets(setup(hu)), dead, ...line])).toBe(formatShorthand(line));
  });
});

describe('spec 15: 24 required cases', () => {
  it('1. heads-up: open, call, check down to river, showdown', () => {
    const s = setup({ seats: 2, heroPos: 'SB', villPos: 'BB' });
    const r = play(
      s,
      [
        { act: 'open', to: 100 },
        { act: 'call' },
        { act: 'check' }, // BB first postflop
        { act: 'check' },
        { act: 'check' },
        { act: 'check' },
        { act: 'check' },
        { act: 'check' },
      ],
      FULL_BOARD,
    );
    expect(r.state.phase).toEqual({ kind: 'showdown' });
    expect(r.state.pot).toBe(200);
    expect(r.actions.filter((a) => a.street === 'flop').map((a) => a.actor)).toEqual([
      'villain',
      'hero',
    ]);
  });

  it('2. golden hand through the machine: -360bb, eff 360bb, stack after 0', () => {
    const s = setup({ stacks: { MP: 18000, BTN: 20000 } });
    const line = 'H lp V o500 H c / H x V b500 H c / H x V b1k H c / H b5000 V ai H c';
    const { actions, errors } = parseShorthand(line, { heroPos: 'MP', villPos: 'BTN' });
    expect(errors).toEqual([]);
    const st = replay(s, actions);
    expect(st.invalid).toEqual([]);
    expect(st.phase).toEqual({ kind: 'showdown' });
    expect(st.pot).toBe(36075);
    const r = settle(s, actions, 'villain');
    expect(r.result).toBe(-18000);
    expect(toBb(r.result ?? 0, 50)).toBe(-360);
    expect(r.resultBb).toBe(-360);
    expect(computeEff(18000, 20000, 50)?.bb).toBe(360);
    expect(nextStack(18000, r.result ?? 0)).toBe(0);
  });

  it('3. fold before any open: hand ends, hero loses the blind', () => {
    const sb = setup({ heroPos: 'SB', villPos: 'BB' });
    const a = play(sb, [{ act: 'fold' }]);
    expect(a.state.phase).toEqual({ kind: 'won', winner: 'BB' });
    expect(settle(sb, a.actions, 'villain').result).toBe(-25);

    const bb = setup({ heroPos: 'BB', villPos: 'UTG' });
    const b = play(bb, [{ act: 'fold' }]);
    expect(b.state.phase).toEqual({ kind: 'won', winner: 'BB' });
    expect(settle(bb, b.actions, 'hero').result).toBe(25);
  });

  it('4. limp, BB checks the option, goes to the flop', () => {
    const s = setup({ heroPos: 'BTN', villPos: 'BB' });
    const a = play(s, [{ act: 'call' }]);
    expect(a.actions.at(-1)).toMatchObject({ act: 'call', verb: 'limp', amount: 50 });
    expect(toAct(a.state)).toBe('BB');
    expect(a.state.buttons).toEqual(['check', 'open', 'all-in']);
    const b = play(s, [{ act: 'call' }, { act: 'check' }]);
    expect(b.state.phase).toMatchObject({ kind: 'act', street: 'flop' });
  });

  it('5. limp, BB raises: limper gets fold / call / raise / all-in', () => {
    const s = setup({ heroPos: 'BTN', villPos: 'BB' });
    const r = play(s, [{ act: 'call' }, { act: 'open', to: 200 }]);
    expect(toAct(r.state)).toBe('BTN');
    expect(r.state.buttons).toEqual(['fold', 'call', 'raise', 'all-in']);
    expect(r.state.toCall).toBe(150);
  });

  it('6. open, 3bet, 4bet, 5bet all-in, call: board runs out', () => {
    const s = setup({ heroPos: 'CO', villPos: 'BTN', stacks: { CO: 10000, BTN: 10000 } });
    const r = play(s, [
      { act: 'open', to: 150 },
      { act: 'raise', to: 450 },
      { act: 'raise', to: 1350 },
      { act: 'all-in' },
      { act: 'call' },
    ]);
    expect(r.state.phase).toEqual({ kind: 'runout', missing: 5 });
    expect(r.state.pot).toBe(20075);
    expect(r.actions.at(-1)).toMatchObject({ act: 'call', amount: 10000 });
  });

  it('7. one straddle: order and the straddler may check', () => {
    const s = setup({
      straddles: [100],
      heroPos: 'MP',
      villPos: 'UTG',
      tracked: ['UTG+1', 'CO'],
    });
    const seen: (string | null)[] = [];
    let actions: Action[] = [];
    for (let i = 0; i < 3; i++) {
      seen.push(toAct(replay(s, actions)));
      actions = act(s, actions, { act: 'call' }).actions;
    }
    const last = replay(s, actions);
    seen.push(toAct(last));
    expect(seen).toEqual(['UTG+1', 'MP', 'CO', 'UTG']);
    expect(last.buttons).toContain('check');
    expect(last.currentBet).toBe(100);
  });

  it('8. three straddles 100/200/400: order, level 400, min raise to 800', () => {
    const s = setup({ straddles: [100, 200, 400], heroPos: 'LJ', villPos: 'MP' });
    const st = replay(s, []);
    expect(toAct(st)).toBe('LJ');
    expect(st.currentBet).toBe(400);
    expect(st.minRaiseTo).toBe(800);
    const r = play(s, [{ act: 'call' }]);
    expect(toAct(r.state)).toBe('MP');
    expect(r.state.buttons).toContain('check');
  });

  it('9. no straddle reaches the button', () => {
    const six = forcedBets(
      setup({ seats: 6, straddles: [100, 200, 400, 800], heroPos: 'LJ', villPos: 'BB' }),
    );
    expect(six.filter((a) => a.act === 'post_straddle').map((a) => a.pos)).toEqual([
      'LJ',
      'HJ',
      'CO',
    ]);
    const four = forcedBets(
      setup({ seats: 4, straddles: [100, 200], heroPos: 'CO', villPos: 'BB' }),
    );
    expect(four.filter((a) => a.act === 'post_straddle').map((a) => a.pos)).toEqual(['CO']);
  });

  it('10. hero sits in the straddle seat and acts last with a check', () => {
    const s = setup({ straddles: [100], heroPos: 'UTG', villPos: 'CO' });
    const r = play(s, [{ act: 'call' }]);
    expect(toAct(r.state)).toBe('UTG');
    expect(r.state.buttons).toContain('check');
  });

  it('11. postflop: SB first, button last, folded seats skipped', () => {
    const s = setup({ heroPos: 'SB', villPos: 'BB', tracked: ['UTG', 'CO', 'BTN'] });
    const pre = play(
      s,
      [
        { act: 'open', to: 150 }, // UTG
        { act: 'fold' }, // CO
        { act: 'call' }, // BTN
        { act: 'call' }, // SB
        { act: 'call' }, // BB
      ],
      FULL_BOARD,
    );
    const order: (string | null)[] = [];
    let actions = pre.actions;
    for (let i = 0; i < 3; i++) {
      order.push(toAct(replay(s, actions, FULL_BOARD)));
      actions = act(s, actions, { act: 'check' }, FULL_BOARD).actions;
    }
    order.push(toAct(replay(s, actions, FULL_BOARD)));
    expect(order).toEqual(['SB', 'BB', 'UTG', 'BTN']);
  });

  it('12. per-player ante: pot is right and the ante is not part of the call', () => {
    const s = setup({ ante: { mode: 'each', amount: 10 }, heroPos: 'UTG', villPos: 'BB' });
    const st = replay(s, []);
    expect(st.pot).toBe(90 + 25 + 50);
    expect(st.toCall).toBe(50);
    expect(st.currentBet).toBe(50);
  });

  it('13. BB ante: posted before the blinds, pot is right', () => {
    const s = setup({ ante: { mode: 'bb', amount: 50 }, heroPos: 'BTN', villPos: 'BB' });
    const forced = forcedBets(s);
    expect(forced[0]).toMatchObject({ act: 'post_ante', pos: 'BB', amount: 50 });
    expect(forced[1]).toMatchObject({ act: 'post_sb' });
    const st = replay(s, []);
    expect(st.pot).toBe(125);
    const folded = play(s, [{ act: 'fold' }]);
    const p = computePot({
      blinds: { sb: 25, bb: 50, ante: { mode: 'bb', amount: 50 } },
      heroPos: 'BTN',
      villPos: 'BB',
      actions: folded.actions,
    });
    expect(p.pot).toBe(100); // BB gets the uncalled half of the big blind back
  });

  it('14. level change: bb follows each hand level', () => {
    const lose = (bb: number) => {
      const s = setup({ sb: bb / 2, bb, heroPos: 'BTN', villPos: 'BB' });
      const r = play(s, [{ act: 'open', to: 300 }, { act: 'call' }]);
      return settle(s, r.actions, 'villain');
    };
    expect(lose(100).resultBb).toBe(-3);
    expect(lose(200).resultBb).toBe(-1.5);
  });

  it('15. short all-in: players who already acted only get fold / call', () => {
    const s = setup({ heroPos: 'CO', villPos: 'BTN', tracked: ['SB'], stacks: { SB: 300 } });
    const r = play(s, [
      { act: 'open', to: 200 }, // CO
      { act: 'call' }, // BTN
      { act: 'all-in' }, // SB: 300 total is +100 on 200, below the 150 step
    ]);
    expect(toAct(r.state)).toBe('CO');
    expect(r.state.buttons).toEqual(['fold', 'call']);
    expect(r.state.toCall).toBe(100);
  });

  it('16. raise below the minimum warns but is saved', () => {
    const s = setup({ heroPos: 'BTN', villPos: 'BB' });
    const r = play(s, [
      { act: 'open', to: 200 },
      { act: 'raise', to: 250 },
    ]);
    expect(r.notices.map((n) => n.code)).toContain('below_min_raise');
    expect(r.state.warnings.map((n) => n.code)).toContain('below_min_raise');
    expect(r.actions.at(-1)).toMatchObject({ act: 'raise', amount: 250 });
  });

  it('17. bet above the stack becomes an all-in', () => {
    const s = setup({ heroPos: 'BTN', villPos: 'BB', stacks: { BTN: 3000, BB: 3000 } });
    const r = play(
      s,
      [{ act: 'open', to: 100 }, { act: 'call' }, { act: 'check' }, { act: 'bet', to: 5000 }],
      FULL_BOARD,
    );
    expect(r.actions.at(-1)).toMatchObject({ act: 'all-in', amount: 2900 });
    expect(r.notices.map((n) => n.code)).toContain('auto_all_in');
  });

  it('18. untracked seats fold on their own; a third player can be added mid-hand', () => {
    const s = setup({ heroPos: 'MP', villPos: 'BTN' });
    expect(replay(s, []).addable).toContain('UTG');
    const open = play(s, [{ act: 'open', to: 150 }]);
    expect(open.actions.some((a) => a.act === 'fold')).toBe(false);
    expect(open.state.addable).toContain('CO');
    expect(open.state.addable).toContain('LJ');
    expect(open.state.addable).not.toContain('UTG');

    const added = act(s, open.actions, { seat: 'CO', act: 'call' });
    expect(added.accepted).toBe(true);
    expect(toAct(added.state)).toBe('BTN');
    expect(added.actions.at(-1)).toMatchObject({ actor: 'other', pos: 'CO' });

    const done = act(s, added.actions, { act: 'call' });
    expect(done.state.phase).toMatchObject({ kind: 'act', street: 'flop' });
    expect(done.state.addable).not.toContain('LJ');
  });

  it('19. three players with uneven all-ins make two pots (no side_pot warning any more)', () => {
    const uneven = setup({
      heroPos: 'BTN',
      villPos: 'SB',
      tracked: ['BB'],
      stacks: { BTN: 1000, SB: 3000, BB: 5000 },
    });
    const r = play(uneven, [{ act: 'all-in' }, { act: 'all-in' }, { act: 'call' }]);
    expect(r.state.warnings.map((n) => n.code)).not.toContain('side_pot');
    const sd = showdown(uneven, r.actions, { cards: [] }, { hole: {} });
    expect(sd?.pots.map((p) => p.amount)).toEqual([3000, 4000]);
  });

  it('20. "+ other money": a limper who folds later still adds to the pot', () => {
    const s = setup({ heroPos: 'BTN', villPos: 'BB' });
    const before = play(s, [{ seat: 'CO', act: 'dead', to: 50 }]);
    expect(before.state.currentBet).toBe(50);
    expect(before.state.toCall).toBe(50);

    const r = play(s, [
      { seat: 'CO', act: 'dead', to: 50 },
      { act: 'open', to: 150 },
      { act: 'call' },
    ]);
    expect(r.actions[forcedBets(s).length]).toMatchObject({ act: 'dead', pos: 'CO', amount: 50 });
    expect(r.state.pot).toBe(50 + 25 + 150 + 150);
    const p = computePot({ blinds: BLINDS, heroPos: 'BTN', villPos: 'BB', actions: r.actions });
    expect(p.pot).toBe(375);
  });

  it('21. split pot: hero result matches computeResult', () => {
    const s = setup({ heroPos: 'BTN', villPos: 'BB' });
    const r = play(s, [{ act: 'open', to: 150 }, { act: 'call' }]);
    expect(settle(s, r.actions, 'split').result).toBe(12.5);
    expect(
      computeResult({
        blinds: BLINDS,
        heroPos: 'BTN',
        villPos: 'BB',
        outcome: 'split',
        actions: r.actions,
      }),
    ).toBe(12.5);
  });

  it('22. editing an old action flags later actions instead of deleting them', () => {
    const s = setup({ heroPos: 'BTN', villPos: 'BB' });
    const r = play(
      s,
      [{ act: 'open', to: 150 }, { act: 'call' }, { act: 'check' }, { act: 'bet', to: 100 }],
      FULL_BOARD,
    );
    const first = forcedBets(s).length;
    const e = edit(s, r.actions, first, { act: 'fold' }, FULL_BOARD);
    expect(e.actions).toHaveLength(r.actions.length);
    expect(e.state.phase).toEqual({ kind: 'won', winner: 'BB' });
    expect(e.state.invalid).toEqual([first + 1, first + 2, first + 3]);
  });

  it('23. no board entered: the hand goes on and the board is reported as missing', () => {
    const s = setup({ heroPos: 'BTN', villPos: 'BB' });
    const r = play(s, [{ act: 'open', to: 150 }, { act: 'call' }, { act: 'check' }]);
    expect(r.state.phase).toMatchObject({ kind: 'act', street: 'flop', toAct: 'BTN' });
    const c = boardCheck(r.state, ['', '', '', '', '']);
    expect(c).toMatchObject({ needed: 3, missing: 3 });
  });

  it('24. shorthand and button entry give the identical actions array', () => {
    const hu = { heroPos: 'MP', villPos: 'BTN' } as const;
    const s = setup({ ...hu, stacks: { MP: 18000, BTN: 20000 } });
    const fromButtons = play(
      s,
      [
        { act: 'call' },
        { act: 'open', to: 500 },
        { act: 'call' },
        { act: 'check' },
        { act: 'bet', to: 500 },
        { act: 'call' },
      ],
      FULL_BOARD,
    ).actions;
    const parsed = parseShorthand('H lp V o500 H c / H x V b500 H c', hu).actions;
    const fromShorthand = resolveActions({
      blinds: BLINDS,
      ...hu,
      heroStack: 18000,
      villStack: 20000,
      actions: [...forcedBets(s), ...parsed],
    });
    expect(fromButtons).toEqual(fromShorthand);
  });
});

describe('undo', () => {
  it('removes the last player action and never a forced bet', () => {
    const s = setup({ heroPos: 'BTN', villPos: 'BB' });
    const r = play(s, [{ act: 'open', to: 150 }]);
    const back = undo(r.actions);
    expect(back).toEqual(forcedBets(s));
    expect(undo(back)).toEqual(forcedBets(s));
  });
});
