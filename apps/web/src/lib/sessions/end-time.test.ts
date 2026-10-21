import { describe, expect, it } from 'vitest';
import { resolveEndAt, toLocalInput, fromLocalInput } from './end-time';

const start = '2026-10-20T10:00:00.000Z';
const now = '2026-10-21T10:00:00.000Z';

describe('resolveEndAt', () => {
  it('no value: now', () => {
    expect(resolveEndAt(null, start, now)).toBe(now);
    expect(resolveEndAt('', start, now)).toBe(now);
  });
  it('a valid time between start and now is kept', () => {
    expect(resolveEndAt('2026-10-20T18:15:00.000Z', start, now)).toBe('2026-10-20T18:15:00.000Z');
  });
  it('garbage, before the start or in the future: now', () => {
    expect(resolveEndAt('nope', start, now)).toBe(now);
    expect(resolveEndAt('2026-10-20T09:00:00.000Z', start, now)).toBe(now);
    expect(resolveEndAt('2026-10-22T00:00:00.000Z', start, now)).toBe(now);
  });
  it('no start recorded: only the future check applies', () => {
    expect(resolveEndAt('2026-10-20T09:00:00.000Z', null, now)).toBe('2026-10-20T09:00:00.000Z');
  });
});

describe('local input value', () => {
  it('round-trips through the minute', () => {
    const iso = '2026-10-20T18:15:00.000Z';
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso);
  });
  it('rejects an empty or invalid value', () => {
    expect(fromLocalInput('')).toBeNull();
    expect(fromLocalInput('x')).toBeNull();
  });
});
