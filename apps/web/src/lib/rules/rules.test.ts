import { describe, expect, it } from 'vitest';
import { moveId, parseRuleText } from './rules';

describe('parseRuleText', () => {
  it('trims and rejects empty or too long text', () => {
    expect(parseRuleText('  Open 3bb ')).toBe('Open 3bb');
    expect(parseRuleText('   ')).toBeNull();
    expect(parseRuleText('x'.repeat(301))).toBeNull();
    expect(parseRuleText(null)).toBeNull();
  });
});

describe('moveId', () => {
  const ids = ['a', 'b', 'c'];
  it('swaps with the neighbour', () => {
    expect(moveId(ids, 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveId(ids, 'b', 1)).toEqual(['a', 'c', 'b']);
  });
  it('leaves the list alone at the ends or for unknown ids', () => {
    expect(moveId(ids, 'a', -1)).toEqual(ids);
    expect(moveId(ids, 'c', 1)).toEqual(ids);
    expect(moveId(ids, 'z', 1)).toEqual(ids);
  });
});
