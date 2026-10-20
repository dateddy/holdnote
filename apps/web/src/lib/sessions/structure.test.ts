import { describe, expect, it } from 'vitest';
import { readBlindLevels } from 'poker-core';
import { withBlindLevels } from './structure';

const rows = [
  { level: 7, sb: 200, bb: 400, ante: 400, ante_mode: 'bb', minutes: 20 },
  { level: 8, sb: 300, bb: 600, ante: 600, ante_mode: 'bb', minutes: 20 },
];

describe('withBlindLevels', () => {
  const current = { name: 'Sunday', start_stack: 20000, place: 12, blind_levels: rows };

  it('replaces only blind_levels', () => {
    const edited = readBlindLevels(rows).map((l) =>
      l.level === 8 ? { ...l, sb: 400, bb: 800 } : l,
    );
    const next = withBlindLevels(current, edited);
    expect(next).toMatchObject({ name: 'Sunday', start_stack: 20000, place: 12 });
    expect(readBlindLevels(next.blind_levels).find((l) => l.level === 8)).toMatchObject({
      sb: 400,
      bb: 800,
    });
  });
  it('an empty list removes the structure and keeps the rest', () => {
    expect(withBlindLevels(current, [])).toEqual({ name: 'Sunday', start_stack: 20000, place: 12 });
  });
  it('starts from nothing when mtt is null or junk', () => {
    expect(withBlindLevels(null, [])).toEqual({});
    expect(withBlindLevels([1], readBlindLevels(rows))).toHaveProperty('blind_levels');
  });
});
