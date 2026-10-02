import { describe, expect, it } from 'vitest';
import { parseShorthand, type Action } from '../src/index';

const GOLDEN = 'H lp V o500 H c / H x V b500 H c / H x V b1k H c / H b5000 V ai H c';

/** Compact view: "street actor act amount". */
const brief = (actions: Action[]) =>
  actions.map((a) => [a.street, a.pos ?? a.who ?? a.actor, a.act, a.amount ?? ''].join(' ').trim());

describe('parseShorthand: verbs', () => {
  it.each([
    ['o600', 'raise', 'open', 600],
    ['lp', 'call', 'limp', undefined],
    ['x', 'check', undefined, undefined],
    ['b800', 'bet', undefined, 800],
    ['c', 'call', undefined, undefined],
    ['r1200', 'raise', undefined, 1200],
    ['3b1800', 'raise', '3bet', 1800],
    ['4b4000', 'raise', '4bet', 4000],
    ['5b9000', 'raise', '5bet', 9000],
    ['l300', 'bet', 'lead', 300],
    ['cr900', 'raise', 'check-raise', 900],
    ['ai', 'all-in', undefined, undefined],
    ['ai5000', 'all-in', undefined, 5000],
    ['f', 'fold', undefined, undefined],
    ['d200', 'bet', 'donk', 200],
  ])('H %s -> %s', (token, act, verb, amount) => {
    const { actions, errors } = parseShorthand(`H ${token}`);
    expect(errors).toEqual([]);
    expect(actions).toEqual([
      {
        street: 'preflop',
        actor: 'hero',
        act,
        ...(verb ? { verb } : {}),
        ...(amount !== undefined ? { amount } : {}),
      },
    ]);
  });

  it.each([
    ['limp', 'call', 'limp', undefined],
    ['iso80', 'raise', undefined, 80],
    ['sq350', 'raise', '3bet', 350],
    ['shove1.73', 'all-in', undefined, 1.73],
    ['allin', 'all-in', undefined, undefined],
    ['call', 'call', undefined, undefined],
    ['fold', 'fold', undefined, undefined],
    ['check', 'check', undefined, undefined],
    ['bet50', 'bet', undefined, 50],
    ['raise90', 'raise', undefined, 90],
  ])('accepts alias %s', (token, act, verb, amount) => {
    const { actions, errors } = parseShorthand(`V ${token}`);
    expect(errors).toEqual([]);
    expect(actions[0]).toMatchObject({ actor: 'villain', act });
    expect(actions[0]?.verb).toBe(verb);
    expect(actions[0]?.amount).toBe(amount);
  });

  it('reads amounts with k suffix and decimals', () => {
    const { actions } = parseShorthand('H o1k5 V 3b4k H c / V b0.06');
    expect(actions.map((a) => a.amount)).toEqual([1500, 4000, undefined, 0.06]);
  });

  it('ignores amounts written on calls (a call always matches the bet)', () => {
    expect(parseShorthand('H lp1000').actions[0]).toEqual({
      street: 'preflop',
      actor: 'hero',
      act: 'call',
      verb: 'limp',
    });
  });

  it('treats all-in / all in as ai', () => {
    expect(parseShorthand('H all-in').actions[0]?.act).toBe('all-in');
    expect(parseShorthand('H all in').actions[0]?.act).toBe('all-in');
    expect(parseShorthand('H All-In3000').actions[0]).toMatchObject({
      act: 'all-in',
      amount: 3000,
    });
  });
});

describe('parseShorthand: actors', () => {
  it('maps H and V to hero/villain with their positions', () => {
    const { actions } = parseShorthand('H o600 V c', { heroPos: 'BTN', villPos: 'BB' });
    expect(actions).toEqual([
      { street: 'preflop', actor: 'hero', pos: 'BTN', act: 'raise', verb: 'open', amount: 600 },
      { street: 'preflop', actor: 'villain', pos: 'BB', act: 'call' },
    ]);
  });

  it('maps other positions to other players, with aliases', () => {
    const { actions } = parseShorthand('UTG f +1 c BU r100 SB: f');
    expect(brief(actions)).toEqual([
      'preflop UTG fold',
      'preflop UTG+1 call',
      'preflop BTN raise 100',
      'preflop SB fold',
    ]);
    expect(actions.every((a) => a.actor === 'other')).toBe(true);
  });

  it('treats a position equal to heroPos/villPos as hero/villain', () => {
    const { actions } = parseShorthand('BTN o600 BB c', { heroPos: 'BTN', villPos: 'BB' });
    expect(actions.map((a) => a.actor)).toEqual(['hero', 'villain']);
  });

  it('supports the POS-action prefix form', () => {
    const { actions, errors } = parseShorthand('BTN-o600 SB-c UTG-c HJ-c');
    expect(errors).toEqual([]);
    expect(brief(actions)).toEqual([
      'preflop BTN raise 600',
      'preflop SB call',
      'preflop UTG call',
      'preflop HJ call',
    ]);
  });

  it('labels extra villains V1..V9 as other players', () => {
    const { actions, errors } = parseShorthand('V1 limp H iso0.12 V c V1 c');
    expect(errors).toEqual([]);
    expect(actions[0]).toEqual({
      street: 'preflop',
      actor: 'other',
      who: 'V1',
      act: 'call',
      verb: 'limp',
    });
    expect(actions.map((a) => a.actor)).toEqual(['other', 'hero', 'villain', 'other']);
  });

  it('accepts checks and folds without an actor', () => {
    const { actions, errors } = parseShorthand('H o6 V c / x x H x');
    expect(errors).toEqual([]);
    expect(brief(actions)).toEqual([
      'preflop hero raise 6',
      'preflop villain call',
      'flop other check',
      'flop other check',
      'flop hero check',
    ]);
  });

  it('needs one actor per action (actor does not carry over)', () => {
    const { actions, errors } = parseShorthand('H o600 c');
    expect(actions).toHaveLength(1);
    expect(errors).toEqual([{ street: 'preflop', index: 2, token: 'c', code: 'missing_actor' }]);
  });
});

describe('parseShorthand: streets and board', () => {
  it('splits streets on /', () => {
    const { actions } = parseShorthand('H o600 V c / V x H b800 V c');
    expect(actions.map((a) => a.street)).toEqual(['preflop', 'preflop', 'flop', 'flop', 'flop']);
  });

  it('reads board cards at the start of each street', () => {
    const line = 'UTG f V o1200 H 3b3600 V c / 8sQhJh V x H b2911 V c / Ts V ai34118 H c / 2s';
    const { boardFromLine, errors, actions } = parseShorthand(line);
    expect(errors).toEqual([]);
    expect(boardFromLine).toEqual({ flop: ['8s', 'Qh', 'Jh'], turn: 'Ts', river: '2s' });
    expect(actions.filter((a) => a.street === 'river')).toEqual([]);
  });

  it('accepts board cards split by spaces and rank-only cards', () => {
    expect(parseShorthand('H o6 V c / Ah 9h Td V x').boardFromLine.flop).toEqual([
      'Ah',
      '9h',
      'Td',
    ]);
    expect(parseShorthand('H o6 V c / Q44 x').boardFromLine.flop).toEqual(['Q?', '4?', '4?']);
  });

  it('takes the last card when the whole board is rewritten on turn/river', () => {
    const { boardFromLine } = parseShorthand('H c / K22 x x / K22J x x / K22JK x x');
    expect(boardFromLine).toEqual({ flop: ['K?', '2?', '2?'], turn: 'J?', river: 'K?' });
  });

  it('returns an empty board when no cards are written', () => {
    expect(parseShorthand('H o6 V c / V x').boardFromLine).toEqual({});
  });

  it('reports more than 4 streets', () => {
    const { errors } = parseShorthand('H c / x / x / x / x');
    expect(errors).toEqual([{ street: 'river', index: 0, token: '/', code: 'too_many_streets' }]);
  });
});

describe('parseShorthand: errors', () => {
  it('reports each unknown token and keeps parsing', () => {
    const { actions, errors } = parseShorthand('fold tới SB, V o0.10 H c');
    expect(errors).toEqual([{ street: 'preflop', index: 1, token: 'tới', code: 'unknown_token' }]);
    expect(brief(actions)).toEqual([
      'preflop other fold',
      'preflop villain raise 0.1',
      'preflop hero call',
    ]);
  });

  it('drops the pending actor after an unknown token', () => {
    const { actions, errors } = parseShorthand('H zz c');
    expect(actions).toEqual([]);
    expect(errors.map((e) => e.code)).toEqual(['unknown_token', 'missing_actor']);
  });

  it('reports an unreadable amount', () => {
    const { errors } = parseShorthand('H b1..2');
    expect(errors).toEqual([{ street: 'preflop', index: 1, token: 'b1..2', code: 'bad_amount' }]);
  });

  it('does not treat cards on preflop as board', () => {
    const { errors, boardFromLine } = parseShorthand('AhKd H o6');
    expect(boardFromLine).toEqual({});
    expect(errors[0]?.code).toBe('unknown_token');
  });

  it('handles empty input', () => {
    expect(parseShorthand('')).toEqual({ actions: [], boardFromLine: {}, errors: [] });
    expect(parseShorthand('   ')).toEqual({ actions: [], boardFromLine: {}, errors: [] });
  });
});

describe('parseShorthand: golden hand', () => {
  it('parses the golden line into 12 actions', () => {
    const { actions, errors } = parseShorthand(GOLDEN, { heroPos: 'MP', villPos: 'BTN' });
    expect(errors).toEqual([]);
    expect(brief(actions)).toEqual([
      'preflop MP call',
      'preflop BTN raise 500',
      'preflop MP call',
      'flop MP check',
      'flop BTN bet 500',
      'flop MP call',
      'turn MP check',
      'turn BTN bet 1000',
      'turn MP call',
      'river MP bet 5000',
      'river BTN all-in',
      'river MP call',
    ]);
  });
});
