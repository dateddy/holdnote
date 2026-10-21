import { describe, expect, it } from 'vitest';
import { act, forcedBets, type Action } from 'poker-core';
import { comparePractice, SAMPLE, SAMPLE_SESSION } from '@/lib/onboarding/sample';
import {
  deriveHand,
  emptyDraft,
  fromHandRow,
  rotatePos,
  stripForced,
  toHandRow,
  type HandSession,
} from './build';
import { boardInput, draftToSetup } from './setup';

const cash: HandSession = {
  kind: 'cash',
  mode: 'live',
  sb: 25,
  bb: 50,
  straddle: null,
  ante_mode: 'none',
  ante: null,
  buyin: 18000,
  seats: 9,
  mtt: null,
};

function draft(over: Partial<ReturnType<typeof emptyDraft>> = {}) {
  return {
    ...emptyDraft(cash, null),
    slots: ['Ah', 'Kd', '', '', '', '', ''],
    heroPos: 'BTN',
    villPos: 'BB',
    heroStack: '5000',
    villStack: '5000',
    ...over,
  };
}

describe('draftToSetup', () => {
  it('needs both positions at the table', () => {
    expect(draftToSetup(cash, draft({ heroPos: '' }), 50)).toBeNull();
    expect(draftToSetup(cash, draft({ heroPos: 'UTG', playersDealt: '6' }), 50)).toBeNull();
    expect(draftToSetup(cash, draft({ villPos: 'BTN' }), 50)).toBeNull();
  });

  it('carries blinds, stacks and straddles; MTT ignores straddles', () => {
    const s = draftToSetup(cash, draft({ straddles: ['100', '200'] }), 50);
    expect(s).toMatchObject({
      seats: 9,
      sb: 25,
      bb: 50,
      straddles: [100, 200],
      stacks: { BTN: 5000, BB: 5000 },
    });
    const mtt = { ...cash, kind: 'mtt', mtt: {} };
    expect(draftToSetup(mtt, draft({ straddles: ['100'], levelSb: '40' }), 100)).toMatchObject({
      sb: 40,
      bb: 100,
    });
    expect(draftToSetup(mtt, draft({ straddles: ['100'] }), 100)?.straddles).toBeUndefined();
  });

  it('boardInput lists the picked board cards', () => {
    const d = draft({ slots: ['Ah', 'Kd', '7c', '8d', '2s', '', ''] });
    expect(boardInput(d)).toEqual({ cards: ['7c', '8d', '2s'] });
  });
});

describe('next hand defaults', () => {
  it('moves both positions one seat forward', () => {
    expect(rotatePos(9, 'MP')).toBe('LJ');
    expect(rotatePos(9, 'BB')).toBe('UTG');
    expect(rotatePos(2, 'BTN')).toBe('BB');
    expect(rotatePos(6, 'MP')).toBe('CO'); // saved under the old 6-max names: MP = HJ
    expect(rotatePos(9, '')).toBe('');
  });

  it('takes positions, straddles and stage from the previous hand', () => {
    const next = emptyDraft(cash, {
      hero_stack: 5000,
      result: 100,
      hero_pos: 'BTN',
      villain_pos: 'SB',
      straddles: [100],
      stage: 'bubble',
    });
    expect(next).toMatchObject({
      heroPos: 'SB',
      villPos: '',
      opponents: [],
      straddles: ['100'],
      stage: 'bubble',
      heroStack: '5100',
    });
  });

  it('starts with the session straddle on a first cash hand', () => {
    expect(emptyDraft({ ...cash, straddle: 100 }, null).straddles).toEqual(['100']);
    expect(emptyDraft(cash, null).straddles).toEqual([]);
  });
});

describe('several opponents (5.1c-5)', () => {
  const picked = (list: [string, string][]) =>
    draft({
      heroPos: 'MP',
      villPos: '',
      opponents: list.map(([pos, stack]) => ({ pos, stack, opponentId: '' })),
    });

  it('the first picked is villain, the rest are followed; only listed seats play', () => {
    const s = draftToSetup(
      cash,
      picked([
        ['BTN', '4000'],
        ['CO', '3000'],
      ]),
      50,
    );
    expect(s).toMatchObject({
      villPos: 'BTN',
      tracked: ['CO'],
      listedOnly: true,
      stacks: { BTN: 4000, CO: 3000 },
    });
  });

  it('needs at least one opponent', () => {
    expect(draftToSetup(cash, picked([]), 50)).toBeNull();
  });

  it('the main opponent moves on when the first picked folds; saved as villain', () => {
    const d = picked([
      ['BTN', '4000'],
      ['CO', '3000'],
    ]);
    d.heroPos = 'SB';
    const setup = draftToSetup(cash, d, 50);
    if (!setup) throw new Error('setup');
    let actions = forcedBets(setup);
    // CO opens, BTN folds, hero (SB) calls, BB folds -> hero vs CO
    for (const input of [
      { act: 'open', to: 150, seat: 'CO' },
      { act: 'fold' },
      { act: 'call' },
      { act: 'fold' },
    ] as const) {
      actions = act(setup, actions, input).actions;
    }
    d.actions = stripForced(actions);
    const derived = deriveHand(cash, d);
    expect(derived.primary?.pos).toBe('CO');
    const row = toHandRow(cash, d, 1);
    expect(row.villain_pos).toBe('CO');
    expect(row.villain_stack).toBe(3000);
    expect(row.opponents).toEqual([
      { pos: 'BTN', stack: 4000 },
      { pos: 'CO', stack: 3000 },
    ]);
    const co = (row.actions as unknown as Action[]).find(
      (a) => a.pos === 'CO' && a.act === 'raise',
    );
    expect(co?.actor).toBe('villain');
  });
});

describe('hands recorded by action', () => {
  function played() {
    const d = draft();
    const setup = draftToSetup(cash, d, 50);
    if (!setup) throw new Error('setup');
    let actions = forcedBets(setup);
    for (const input of [{ act: 'open', to: 150 }, { act: 'call' }] as const) {
      actions = act(setup, actions, input).actions;
    }
    return { d: { ...d, actions: stripForced(actions) }, actions };
  }

  it('saves the forced bets inside actions and a result that matches the pot', () => {
    const { d } = played();
    d.outcome = 'lose';
    const row = toHandRow(cash, d, 1);
    const acts = row.actions as unknown as { act: string }[];
    expect(acts.slice(0, 2).map((a) => a.act)).toEqual(['post_sb', 'post_bb']);
    expect(row.result).toBe(-150);
  });

  it('round trips: forced bets leave the draft, straddles and blinds come back', () => {
    const d = draft({ straddles: ['100'] });
    const setup = draftToSetup(cash, d, 50);
    if (!setup) throw new Error('setup');
    const actions = act(setup, forcedBets(setup), { act: 'call' }).actions;
    const row = toHandRow(cash, { ...d, actions: stripForced(actions), outcome: 'win' }, 3);
    const back = fromHandRow(cash, {
      ...row,
      stage: null,
      actions: row.actions,
    } as Parameters<typeof fromHandRow>[1]);
    expect(back.legacy).toBe(false);
    expect(back.straddles).toEqual(['100']);
    expect(back.actions.some((a) => a.act.startsWith('post_'))).toBe(false);
    expect(deriveHand(cash, back).actions).toEqual(row.actions);
  });

  it('a hand saved without forced bets is read by the state machine (5.1d-3)', () => {
    const back = fromHandRow(cash, {
      hero_cards: ['Ah', 'Kd'],
      board: [],
      villain_cards: null,
      hero_pos: 'BTN',
      villain_pos: 'BB',
      opponent_id: null,
      actions: [{ street: 'preflop', actor: 'hero', pos: 'BTN', act: 'raise', amount: 150 }],
      raw_line: 'H o150',
      outcome: null,
      result: null,
      hero_stack: null,
      villain_stack: null,
      level_bb: null,
      players_dealt: null,
      ante: null,
      stage: null,
      thought: null,
      flagged: false,
    });
    expect(back.legacy).toBe(false);
    expect(back.rawLine).toBe('');
    expect(deriveHand(cash, back).machine).not.toBeNull();
  });

  it('a board missing for the street reached marks the hand as missing data', () => {
    const { d } = played();
    const base = { ...d, outcome: 'lose', heroStack: '5000', villStack: '5000' };
    // nothing entered yet: preflop needs no board
    expect(deriveHand(cash, { ...base, actions: [] }).board).toMatchObject({ needed: 0 });
    // open and call: the hand is on the flop and no board is entered
    const derived = deriveHand(cash, base);
    expect(derived.board).toMatchObject({ needed: 3, missing: 3 });
    expect(derived.missing).toBe(true);
    // the flop is entered, plus a turn card the hand has not reached
    const full = { ...base, slots: ['Ah', 'Kd', '7c', '8d', '2s', '9h', ''] };
    expect(deriveHand(cash, full).board).toMatchObject({ missing: 0, extra: 1 });
  });

  it('hero folding settles the hand without an outcome button', () => {
    const d = draft({ heroPos: 'SB', villPos: 'BB' });
    const setup = draftToSetup(cash, d, 50);
    if (!setup) throw new Error('setup');
    const actions = act(setup, forcedBets(setup), { act: 'fold' }).actions;
    const derived = deriveHand(cash, { ...d, actions: stripForced(actions) });
    expect(derived.outcome).toBe('fold');
    expect(derived.result).toBe(-25);
  });

  it('actions that no longer fit are left out of the money', () => {
    const { d } = played();
    // Hero folds first; the rest of the hand is flagged invalid and not counted.
    const bad = {
      ...d,
      actions: [{ ...d.actions[0]!, act: 'fold' as const }, ...d.actions.slice(1)],
    };
    delete bad.actions[0]!.amount;
    const derived = deriveHand(cash, bad);
    expect(derived.machine?.invalid.length).toBeGreaterThan(0);
    expect(derived.potFinal).toBe(50); // the big blind gets the uncalled half back
  });
});

describe('onboarding practice', () => {
  it('the sample hand entered by action matches the sample actions', () => {
    const d = {
      ...emptyDraft(SAMPLE_SESSION, null),
      slots: [...SAMPLE.heroCards, ...SAMPLE.board],
      heroPos: SAMPLE.heroPos,
      villPos: SAMPLE.villPos,
      heroStack: String(SAMPLE.heroStack),
      villStack: String(SAMPLE.villStack),
      outcome: SAMPLE.outcome,
    };
    const setup = draftToSetup(SAMPLE_SESSION, d, 50);
    if (!setup) throw new Error('setup');
    const board = boardInput(d);
    let actions = forcedBets(setup);
    const inputs = [
      { act: 'open', to: 150 },
      { act: 'call' },
      { act: 'check' },
      { act: 'bet', to: 100 },
      { act: 'call' },
      { act: 'check' },
      { act: 'check' },
      { act: 'bet', to: 300 },
      { act: 'call' },
    ] as const;
    for (const input of inputs) {
      const r = act(setup, actions, input, board);
      expect(r.accepted).toBe(true);
      actions = r.actions;
    }
    const checked = comparePractice(d, stripForced(actions));
    expect(checked).toEqual({
      cards: true,
      board: true,
      positions: true,
      actions: true,
      outcome: true,
    });
  });
});
