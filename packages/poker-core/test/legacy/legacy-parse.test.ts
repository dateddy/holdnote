import { describe, expect, it } from 'vitest';
import { formatShorthand, parseShorthand } from '../../src/index';
import { hasHeroVillainLine, hasLegacyData, loadLegacy, pos } from './loader';

/** Free-text words players typed inside lines ("fold tới SB" = "fold to SB"). */
const FREE_TEXT_WORDS = new Set(['tới']);

describe.skipIf(!hasLegacyData)('legacy lines: parseShorthand', () => {
  const hands = hasLegacyData ? loadLegacy().hands.filter((h) => hasHeroVillainLine(h.line)) : [];

  it('finds the 69 hands written with H/V', () => {
    expect(hands).toHaveLength(69);
  });

  it.each(hands.map((h) => [h.id, h] as const))('%s parses', (_id, h) => {
    const { actions, errors, boardFromLine } = parseShorthand(h.line ?? '', {
      heroPos: pos(h.heroPos),
      villPos: pos(h.villPos),
    });

    // Only known free-text words may be left over.
    for (const e of errors) {
      expect(e.code).toBe('unknown_token');
      expect(FREE_TEXT_WORDS.has(e.token)).toBe(true);
    }
    expect(actions.some((a) => a.actor === 'hero')).toBe(true);

    // Board written in the line agrees with the board saved on the hand.
    if (boardFromLine.flop) expect(boardFromLine.flop.join('')).toBe(h.flop);
    if (boardFromLine.turn) expect(boardFromLine.turn).toBe(h.turn);
    if (boardFromLine.river) expect(boardFromLine.river).toBe(h.river);
  });
});

describe.skipIf(!hasLegacyData)('legacy lines: formatShorthand round trip', () => {
  const hands = hasLegacyData ? loadLegacy().hands.filter((h) => hasHeroVillainLine(h.line)) : [];

  it.each(hands.map((h) => [h.id, h] as const))('%s survives format then parse', (_id, h) => {
    const ctx = { heroPos: pos(h.heroPos), villPos: pos(h.villPos) };
    const first = parseShorthand(h.line ?? '', ctx);
    const again = parseShorthand(formatShorthand(first.actions), ctx);
    expect(again.actions).toEqual(first.actions);
  });
});
