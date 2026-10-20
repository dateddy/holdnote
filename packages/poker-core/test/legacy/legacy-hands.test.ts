import { describe, expect, it } from 'vitest';
import { computePot, computeResult } from '../../src/index';
import { KNOWN_MISMATCHES } from './known-mismatches';
import { hasHeroVillainLine, hasLegacyData, loadLegacy, toCase } from './loader';

/** Old results were stored rounded to 0.1bb, then converted back to money. */
const tolerance = (bb: number) => Math.max(0.05 * bb, 0.005) + 1e-9;

describe.skipIf(!hasLegacyData)('legacy hands: computeResult vs saved result', () => {
  const { hands, sessions } = hasLegacyData ? loadLegacy() : { hands: [], sessions: new Map() };
  const cases = hands
    .filter((h) => hasHeroVillainLine(h.line))
    .map((h) => {
      const c = toCase(h, sessions.get(h.sessionId));
      const computed = computeResult(c.input);
      const matches =
        computed !== null &&
        c.recorded !== undefined &&
        Math.abs(computed - c.recorded) <= tolerance(c.bb);
      return { id: h.id, ...c, computed, matches };
    });

  it.each(cases.map((c) => [c.id, c] as const))('%s', (id, c) => {
    const known = KNOWN_MISMATCHES[id];
    if (known) {
      expect(c.matches, `${id} now matches; remove it from KNOWN_MISMATCHES`).toBe(false);
      expect(c.computed).toBe(known.expected);
      expect(c.recorded).toBeCloseTo(known.recorded, 6);
    } else {
      expect(c.matches, `${id}: computed ${c.computed}, saved ${c.recorded} (bb ${c.bb})`).toBe(
        true,
      );
    }
  });

  it('lists every known mismatch id among the real hands', () => {
    const ids = new Set(cases.map((c) => c.id));
    for (const id of Object.keys(KNOWN_MISMATCHES)) expect(ids.has(id)).toBe(true);
  });

  it('prints a summary', () => {
    const matched = cases.filter((c) => c.matches).length;
    const rows = cases
      .filter((c) => !c.matches)
      .map((c) => {
        const pot = computePot(c.input).pot;
        const diff =
          c.computed === null || c.recorded === undefined
            ? '-'
            : `${(((c.computed - c.recorded) / pot) * 100).toFixed(1)}% pot`;
        return `${c.id}\t${c.input.outcome}\tsaved ${c.recorded}\tcomputed ${c.computed}\tpot ${pot}\tdiff ${diff}`;
      });
    process.stderr.write(`legacy hands: ${matched}/${cases.length} match\n${rows.join('\n')}\n`);
  });
});
