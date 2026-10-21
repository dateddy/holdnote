import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { computePot, replayFrames, type Action, type HandInput } from '../src/index';
import { BLINDS_25_50, hand } from './helpers';

type FixtureFrame = {
  index: number | null;
  street: string;
  final: boolean;
  pot: number;
  hero: number;
  villain: number;
};
const golden = JSON.parse(
  readFileSync(new URL('./fixtures/golden-frames.json', import.meta.url), 'utf8'),
) as { line: string; heroStack: number; villStack: number; frames: FixtureFrame[] };

const goldInput = (): HandInput =>
  hand(golden.line, {
    heroPos: 'MP',
    villPos: 'BTN',
    heroStack: golden.heroStack,
    villStack: golden.villStack,
  });

describe('replayFrames', () => {
  it('golden hand: pot and both stacks at every step match the fixture', () => {
    const frames = replayFrames(goldInput());
    expect(
      frames.map((f) => ({
        index: f.index,
        street: f.street,
        final: f.final,
        pot: f.pot,
        hero: f.seats.hero?.stack,
        villain: f.seats.villain?.stack,
      })),
    ).toEqual(golden.frames);
  });

  it('street bets: what each seat has in front of it this street, reset on a new street', () => {
    const frames = replayFrames(goldInput());
    expect(frames[0]!.seats.BB?.streetBet).toBe(50);
    expect(frames[0]!.seats.SB?.streetBet).toBe(25);
    expect(frames[2]!.seats.villain?.streetBet).toBe(500);
    expect(frames[4]!.seats.villain?.streetBet).toBe(0); // flop check: new street
    expect(frames[5]!.seats.villain?.streetBet).toBe(500);
    expect(frames.at(-1)!.seats.villain?.streetBet).toBe(0);
  });

  it('all-in and fold flags follow the hand', () => {
    const frames = replayFrames(goldInput());
    expect(frames[11]!.seats.villain?.allIn).toBe(true);
    expect(frames[10]!.seats.villain?.allIn).toBe(false);
    const fold = replayFrames(hand('V o500 H f', { heroPos: 'MP', villPos: 'BTN' }));
    expect(fold.at(-1)!.seats.hero?.folded).toBe(true);
    expect(fold.at(-1)!.seats.villain?.folded).toBe(false);
  });

  it('unknown stacks stay unknown; the final pot is the pot after the uncalled bet', () => {
    const input = hand('V o500 H f', { heroPos: 'MP', villPos: 'BTN' });
    const frames = replayFrames(input);
    expect(frames[0]!.seats.hero?.stack).toBeUndefined();
    expect(frames.at(-1)!.pot).toBe(computePot(input).pot);
    expect(frames.at(-1)!.final).toBe(true);
  });

  it('posted blinds and antes form the first frame; posts are not steps', () => {
    const actions: Action[] = [
      { street: 'preflop', actor: 'other', pos: 'SB', act: 'post_ante', amount: 10 },
      { street: 'preflop', actor: 'hero', pos: 'BTN', act: 'post_ante', amount: 10 },
      { street: 'preflop', actor: 'villain', pos: 'BB', act: 'post_ante', amount: 10 },
      { street: 'preflop', actor: 'other', pos: 'SB', act: 'post_sb', amount: 25 },
      { street: 'preflop', actor: 'villain', pos: 'BB', act: 'post_bb', amount: 50 },
      { street: 'preflop', actor: 'hero', pos: 'BTN', act: 'raise', amount: 150 },
      { street: 'preflop', actor: 'other', pos: 'SB', act: 'fold' },
      { street: 'preflop', actor: 'villain', pos: 'BB', act: 'call' },
    ];
    const frames = replayFrames({
      blinds: { ...BLINDS_25_50, ante: { mode: 'each', amount: 10 } },
      heroPos: 'BTN',
      villPos: 'BB',
      heroStack: 5000,
      villStack: 5000,
      playersDealt: 3,
      actions,
    });
    expect(frames.map((f) => f.index)).toEqual([null, 5, 6, 7, null]);
    expect(frames[0]!.pot).toBe(105); // 3 antes + 25 + 50
    expect(frames[0]!.seats.hero?.stack).toBe(4990);
    expect(frames[0]!.seats.villain?.streetBet).toBe(50);
    expect(frames[3]!.pot).toBe(355);
    expect(frames[3]!.seats.villain?.stack).toBe(4840);
  });

  it('multiway with a short all-in: stacks never go below zero', () => {
    const actions: Action[] = [
      { street: 'preflop', actor: 'hero', pos: 'CO', act: 'raise', amount: 150 },
      { street: 'preflop', actor: 'other', pos: 'BTN', act: 'all-in' },
      { street: 'preflop', actor: 'villain', pos: 'BB', act: 'raise', amount: 3000 },
      { street: 'preflop', actor: 'hero', pos: 'CO', act: 'call' },
    ];
    const frames = replayFrames({
      blinds: BLINDS_25_50,
      heroPos: 'CO',
      villPos: 'BB',
      heroStack: 5000,
      villStack: 6000,
      seatStacks: { BTN: 1000 },
      actions,
    });
    const last = frames.at(-1)!;
    expect(last.seats.BTN?.stack).toBe(0);
    expect(last.seats.BTN?.allIn).toBe(true);
    expect(last.seats.hero?.stack).toBe(2000);
    expect(last.seats.villain?.stack).toBe(3000);
    expect(last.pot).toBe(
      computePot({
        blinds: BLINDS_25_50,
        actions,
        heroPos: 'CO',
        villPos: 'BB',
        heroStack: 5000,
        villStack: 6000,
        seatStacks: { BTN: 1000 },
      }).pot,
    );
  });
});
