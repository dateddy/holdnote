import { describe, expect, it } from 'vitest';
import { safeNextPath } from './next-path';

describe('safeNextPath', () => {
  it.each([
    ['/', '/'],
    ['/sessions/123', '/sessions/123'],
    ['/hands?filter=flag', '/hands?filter=flag'],
  ])('keeps internal path %s', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    [null],
    [''],
    ['https://evil.com'],
    ['//evil.com'],
    ['/\\evil.com'],
    ['javascript:alert(1)'],
    ['evil.com/path'],
  ])('falls back to / for %s', (input) => {
    expect(safeNextPath(input)).toBe('/');
  });

  it('never sends a signed-in user back to the login page', () => {
    expect(safeNextPath('/login')).toBe('/');
    expect(safeNextPath('/login?next=/x')).toBe('/');
  });
});
