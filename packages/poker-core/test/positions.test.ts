import { describe, expect, it } from 'vitest';
import { POSITIONS, normalizePosition } from '../src/index';

describe('normalizePosition', () => {
  it('accepts every canonical position', () => {
    for (const p of POSITIONS) expect(normalizePosition(p)).toBe(p);
  });

  it.each([
    ['btn', 'BTN'],
    ['BU', 'BTN'],
    ['+1', 'UTG+1'],
    ['U+1', 'UTG+1'],
    ['UTG1', 'UTG+1'],
    ['SB:', 'SB'],
    ['SB,', 'SB'],
    ['co', 'CO'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizePosition(input)).toBe(expected);
  });

  it('rejects non-positions', () => {
    expect(normalizePosition('H')).toBeNull();
    expect(normalizePosition('UTG+2')).toBeNull();
    expect(normalizePosition('')).toBeNull();
  });
});
