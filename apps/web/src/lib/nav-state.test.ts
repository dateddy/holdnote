import { describe, expect, it } from 'vitest';
import { NAV_KEY, readNavOpen, writeNavOpen } from './nav-state';

const memory = (initial: Record<string, string> = {}) => {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
};
const blocked = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};

describe('menu open/closed state', () => {
  it('open unless the player closed it', () => {
    expect(readNavOpen(memory())).toBe(true);
    expect(readNavOpen(memory({ [NAV_KEY]: 'closed' }))).toBe(false);
    expect(readNavOpen(memory({ [NAV_KEY]: 'open' }))).toBe(true);
    expect(readNavOpen(memory({ [NAV_KEY]: 'junk' }))).toBe(true);
  });
  it('is remembered', () => {
    const s = memory();
    writeNavOpen(false, s);
    expect(readNavOpen(s)).toBe(false);
    writeNavOpen(true, s);
    expect(readNavOpen(s)).toBe(true);
  });
  it('blocked or missing storage never throws and reads as open', () => {
    expect(readNavOpen(blocked)).toBe(true);
    expect(() => writeNavOpen(false, blocked)).not.toThrow();
    expect(readNavOpen(null)).toBe(true);
    expect(() => writeNavOpen(false, null)).not.toThrow();
  });
});
