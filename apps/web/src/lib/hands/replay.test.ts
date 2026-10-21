import { describe, expect, it } from 'vitest';
import { deriveHand } from './build';
import { CASH, MTT, goldenDraft, mttDraft, sidePotDraft } from './fixtures';
import { replayFrames } from 'poker-core';
import { buildReplayHand } from './replay';

const replay = (session: typeof CASH, draft: ReturnType<typeof goldenDraft>, seats = 9) => {
  const r = buildReplayHand(seats, draft, deriveHand(session, draft));
  if (!r) throw new Error('no replay');
  return r;
};

describe('buildReplayHand', () => {
  it('golden hand: -360 bb, hero and villain seats, cards and the hand names', () => {
    const r = replay(CASH, goldenDraft());
    expect(r.bb).toBe(50);
    expect(r.resultBb).toBe(-360);
    expect(r.result).toBe(-18000);
    expect(r.heroCards).toEqual(['Ah', 'Kd']);
    expect(r.board).toEqual(['7c', '8d', '2s', 'Jh', '3c']);
    expect(r.shown).toEqual({ villain: ['9d', '9s'] });
    expect(r.ranks).toEqual({ hero: 'high_card', villain: 'pair' });
    expect(r.pots).toHaveLength(1);
    expect(r.pots[0]!.winners).toEqual(['villain']);
    expect(r.opponents).toBe(1);
  });

  it('the table lists every seat once, button last in the list order of the table', () => {
    const r = replay(CASH, goldenDraft());
    expect(r.table).toHaveLength(9);
    expect(r.table.find((s) => s.pos === 'MP')).toMatchObject({ key: 'hero', role: 'hero' });
    expect(r.table.find((s) => s.pos === 'BTN')).toMatchObject({
      key: 'villain',
      role: 'opponent',
    });
    expect(r.table.filter((s) => s.role === 'other')).toHaveLength(7);
  });

  it('side pot: two pots, the right winners, three opponents-or-hero seats', () => {
    const r = replay(CASH, sidePotDraft(), 3);
    expect(r.table.map((s) => s.pos).sort()).toEqual(['BB', 'BTN', 'SB']);
    expect(r.pots.map((p) => p.amount)).toEqual([3000, 4000]);
    expect(r.pots[0]!.winners).toEqual(['hero']);
    // The main opponent (key `villain`) is the BB, the last one still in; SB keeps its position.
    expect(r.pots[1]!.winners).toEqual(['SB']);
    expect(r.pots[1]!.eligible.sort()).toEqual(['SB', 'villain']);
    expect(r.shown).toEqual({ SB: ['Kh', 'Kd'], villain: ['Tc', '3c'] });
    expect(r.opponents).toBe(2);
    expect(r.resultBb).toBe(40); // +2000 at 50
  });

  it('MTT: every number in bb of the hand level', () => {
    const r = replay(MTT, mttDraft());
    expect(r.bb).toBe(1000);
    expect(r.resultBb).toBe(-5);
    expect(r.result).toBe(-5000);
    expect(r.shown).toEqual({});
  });

  it('the last frame ends on the same pot and stacks as the hand itself', () => {
    const cases = [
      [CASH, goldenDraft(), 9],
      [CASH, sidePotDraft(), 3],
      [MTT, mttDraft(), 9],
    ] as const;
    for (const [session, draft, seats] of cases) {
      const derived = deriveHand(session, draft);
      const r = buildReplayHand(seats, draft, derived)!;
      const end = replayFrames(r.input).at(-1)!;
      expect(end.pot).toBe(derived.potFinal);
      expect(end.final).toBe(true);
    }
  });

  it('other opponents bring their stacks, so a short all-in is a real one', () => {
    const r = replay(CASH, sidePotDraft(), 3);
    expect(r.input.seatStacks).toEqual({ SB: 3000 });
    const end = replayFrames(r.input).at(-1)!;
    expect(end.seats.SB?.stack).toBe(0);
    expect(end.seats.SB?.allIn).toBe(true);
  });

  describe('pots of a hand saved before the pots were stored (legacy)', () => {
    const legacy = (over: Partial<ReturnType<typeof goldenDraft>> = {}) => ({
      ...goldenDraft(),
      legacy: true,
      opponents: [],
      outcome: 'lose',
      ...over,
    });

    it('heads-up: one pot, paid by the saved outcome', () => {
      const r = replay(CASH, legacy());
      expect(r.potStatus).toBe('known');
      expect(r.pots).toEqual([
        { amount: 36075, eligible: ['hero', 'villain'], winners: ['villain'] },
      ]);
      expect(replay(CASH, legacy({ outcome: 'win' })).pots[0]!.winners).toEqual(['hero']);
      expect(replay(CASH, legacy({ outcome: 'split' })).pots[0]!.winners).toEqual([
        'hero',
        'villain',
      ]);
    });

    it('a hand that ended without a showdown says so', () => {
      const r = replay(CASH, legacy({ outcome: 'fold' }));
      expect(r.pots).toEqual([]);
      expect(r.potStatus).toBe('noShowdown');
    });

    it('a hand with a third player, or without the stacks to price it, has no pot data', () => {
      const withOther = legacy();
      withOther.actions = [
        ...withOther.actions,
        { street: 'preflop', actor: 'other', pos: 'CO', act: 'call' },
      ];
      expect(replay(CASH, withOther).potStatus).toBe('unknown');
      expect(replay(CASH, legacy({ heroStack: '', villStack: '' })).potStatus).toBe('unknown');
    });
  });

  it('a hand with a showdown knows its pots', () => {
    expect(replay(CASH, goldenDraft()).potStatus).toBe('known');
  });

  it('a hand without a big blind cannot be replayed', () => {
    const noBlind = { ...CASH, bb: null };
    const draft = goldenDraft();
    expect(buildReplayHand(9, draft, deriveHand(noBlind, draft))).toBeNull();
  });
});
