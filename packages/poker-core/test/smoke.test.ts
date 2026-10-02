import { describe, expect, it } from 'vitest';
import { POKER_CORE_VERSION } from '../src/index';

describe('poker-core', () => {
  it('exports a version', () => {
    expect(POKER_CORE_VERSION).toBe('0.1.0');
  });
});
