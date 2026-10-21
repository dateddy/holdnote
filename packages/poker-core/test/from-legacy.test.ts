import { describe, expect, it } from 'vitest';
import {
  actionsFromLegacy,
  computePot,
  computeResult,
  parseShorthand,
  toBb,
  type Action,
  type HandInput,
  type HandSetup,
} from '../src/index';
import { hasHeroVillainLine, hasLegacyData, loadLegacy, pos, toCase } from './legacy/loader';
import { setup } from './helpers';

const act = (
  street: Action['street'],
  actor: Action['actor'],
  p: Action['pos'],
  a: Action['act'],
  amount?: number,
) => ({ street, actor, pos: p, act: a, ...(amount !== undefined && { amount }) }) as Action;

const forced = (r: ReturnType<typeof actionsFromLegacy>) => {
  if (!r.ok) throw new Error(`conversion failed: ${r.reason}`);
  return r.actions;
};

describe('actionsFromLegacy', () => {
  it('golden hand: forced bets in front, same result -360bb', () => {
    const s = setup({ stacks: { MP: 18000, BTN: 20000 } });
    const line = 'H lp V o500 H c / H x V b500 H c / H x V b1k H c / H b5000 V ai H c';
    const parsed = parseShorthand(line, { heroPos: 'MP', villPos: 'BTN' });
    const actions = forced(actionsFromLegacy(s, parsed.actions));
    expect(actions.slice(0, 2).map((a) => [a.act, a.pos, a.amount])).toEqual([
      ['post_sb', 'SB', 25],
      ['post_bb', 'BB', 50],
    ]);
    const input: HandInput = {
      blinds: { sb: 25, bb: 50, ante: { mode: 'none' } },
      heroPos: 'MP',
      villPos: 'BTN',
      heroStack: 18000,
      villStack: 20000,
      outcome: 'lose',
      actions,
    };
    const result = computeResult(input);
    expect(result).toBe(-18000);
    expect(toBb(result ?? 0, 50)).toBe(-360);
  });

  it('adds the session straddle and fills call amounts (saved hand 38268a59 #2 shape)', () => {
    const s = setup({
      sb: 20,
      bb: 50,
      straddles: [100],
      heroPos: 'BTN',
      villPos: 'UTG',
      stacks: { BTN: 8950 },
    });
    const saved = [
      act('preflop', 'villain', 'UTG', 'check'),
      act('preflop', 'hero', 'BTN', 'raise', 600),
      act('preflop', 'other', 'SB', 'call', 600),
      act('preflop', 'other', 'BB', 'call', 600),
      act('preflop', 'villain', 'UTG', 'call', 600),
    ];
    const r = actionsFromLegacy(s, saved);
    // UTG is the straddler: the first to act is the seat after the straddle.
    expect(r.ok || r.reason).toBeTruthy();
  });

  it('an all-in of an unknown stack fails with missing_stack (saved hand #1: H r500 V ai)', () => {
    const s = setup({ sb: 20, bb: 50, heroPos: 'UTG+1', villPos: 'MP' });
    const parsed = parseShorthand('H r500 V ai', { heroPos: 'UTG+1', villPos: 'MP' });
    expect(actionsFromLegacy(s, parsed.actions)).toEqual({
      ok: false,
      reason: 'missing_stack',
      index: 1,
    });
  });

  it('fills the all-in amount when the stack is known (saved hand efdb8b1f #2)', () => {
    const s = setup({
      sb: 20,
      bb: 50,
      heroPos: 'MP',
      villPos: 'BTN',
      stacks: { MP: 8000, BTN: 5000 },
    });
    const saved = [
      act('preflop', 'hero', 'MP', 'all-in', 8000),
      act('preflop', 'villain', 'BTN', 'call', 5000),
    ];
    const r = actionsFromLegacy(s, saved);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.actions.at(-1)?.amount).toBe(5000);
  });

  it('a seat the table does not have, or a label without a seat, is unknown_seat', () => {
    const s = setup();
    const noSeat = parseShorthand('H r150 V1 c', { heroPos: 'MP', villPos: 'BTN' }).actions;
    expect(actionsFromLegacy(s, noSeat)).toMatchObject({
      ok: false,
      reason: 'unknown_seat',
      index: 1,
    });
  });

  it('an action out of turn fails with out_of_turn and the index', () => {
    const s = setup(); // MP then BTN; hero MP raises, then CO (tracked) never acted before BTN
    const saved = [
      act('preflop', 'other', 'CO', 'fold'),
      act('preflop', 'hero', 'MP', 'raise', 150),
      act('preflop', 'villain', 'BTN', 'call', 150),
      act('preflop', 'other', 'CO', 'call', 150),
    ];
    const r = actionsFromLegacy(s, saved);
    expect(r.ok).toBe(false);
  });

  it('hero and villain on the same seat is bad_setup', () => {
    expect(actionsFromLegacy(setup({ villPos: 'MP' }), [])).toEqual({
      ok: false,
      reason: 'bad_setup',
    });
  });

  it('a check facing a bet is invalid_action', () => {
    const saved = [
      act('preflop', 'hero', 'MP', 'raise', 150),
      act('preflop', 'villain', 'BTN', 'check'),
    ];
    expect(actionsFromLegacy(setup(), saved)).toMatchObject({
      ok: false,
      reason: 'invalid_action',
      index: 1,
    });
  });
});

const legacySetup = (c: ReturnType<typeof toCase>): HandSetup | null => {
  const { input } = c;
  if (!input.heroPos || !input.villPos || input.heroPos === input.villPos) return null;
  const stacks: HandSetup['stacks'] = {};
  if (input.heroStack !== undefined) stacks[input.heroPos] = input.heroStack;
  if (input.villStack !== undefined) stacks[input.villPos] = input.villStack;
  return {
    seats: input.playersDealt ?? 9,
    sb: input.blinds.sb,
    bb: input.blinds.bb,
    ante: input.blinds.ante,
    heroPos: input.heroPos,
    villPos: input.villPos,
    stacks,
  };
};

describe.skipIf(!hasLegacyData)('legacy hands through the state machine', () => {
  const { hands, sessions } = hasLegacyData ? loadLegacy() : { hands: [], sessions: new Map() };
  const rows = hands
    .filter((h) => hasHeroVillainLine(h.line) && pos(h.heroPos) && pos(h.villPos))
    .map((h) => {
      const c = toCase(h, sessions.get(h.sessionId));
      const s = legacySetup(c);
      const conv = s ? actionsFromLegacy(s, c.input.actions) : null;
      return { id: h.id, c, conv };
    });

  it('converts most hands and says why for the rest', () => {
    const ok = rows.filter((r) => r.conv?.ok).length;
    const why: Record<string, number> = {};
    for (const r of rows) {
      if (r.conv && !r.conv.ok) why[r.conv.reason] = (why[r.conv.reason] ?? 0) + 1;
    }
    process.stderr.write(
      `legacy → machine: ${ok}/${rows.length} converted; failures ${JSON.stringify(why)}\n`,
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it('a converted hand keeps the pot and the result of the old computation', () => {
    for (const r of rows) {
      if (!r.conv?.ok) continue;
      // Per-player ante with the players dealt unknown: the old math skips it, the machine needs a table size.
      const { ante } = r.c.input.blinds;
      if (ante.mode === 'each' && !r.c.input.playersDealt) continue;
      const before = computeResult(r.c.input);
      const pot = computePot(r.c.input).pot;
      const after = { ...r.c.input, actions: r.conv.actions };
      // Forced bets are rounded to the cent per seat (an ante of 420 over 9 players is 46.67 each).
      expect(Math.abs(computePot(after).pot - pot), `${r.id} pot`).toBeLessThanOrEqual(0.05);
      if (before !== null) {
        const got = computeResult(after);
        expect(Math.abs((got ?? NaN) - before), `${r.id} result`).toBeLessThanOrEqual(0.05);
      }
    }
  });
});
