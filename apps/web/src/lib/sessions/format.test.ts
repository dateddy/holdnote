import { describe, expect, it } from 'vitest';
import { compactAmount, formatDay, formatDuration, formatMonth, signedNumber } from './format';

describe('compactAmount', () => {
  it.each([
    [500, '500'],
    [1500, '1.5k'],
    [500_000, '500k'],
    [1_000_000, '1M'],
    [2_500_000, '2.5M'],
    [0.25, '0.25'],
  ])('%s -> %s', (n, text) => {
    expect(compactAmount(n)).toBe(text);
  });
});

describe('formatDuration', () => {
  it.each([
    [2.5, '2h30'],
    [0.75, '0h45'],
    [3, '3h00'],
    [12.999, '13h00'],
  ])('%s -> %s', (hours, text) => {
    expect(formatDuration(hours)).toBe(text);
  });
  it('is empty without hours', () => {
    expect(formatDuration(null)).toBe('');
  });
});

describe('formatDay and formatMonth', () => {
  it('day without year, with year', () => {
    expect(formatDay('2026-10-14', false)).toBe('14/10');
    expect(formatDay('2026-10-14', true)).toBe('14/10/2026');
  });
  it('keeps the calendar day as written', () => {
    expect(formatDay('2026-01-01', true)).toBe('01/01/2026');
  });
  it('month heading', () => {
    expect(formatMonth('2026-10', 'en-US')).toBe('October 2026');
  });
});

describe('signedNumber', () => {
  it('plus sign for gains, minus for losses, none for zero', () => {
    expect(signedNumber(12.5, 'en-US')).toBe('+12.5');
    expect(signedNumber(-3, 'en-US')).toBe('-3');
    expect(signedNumber(0, 'en-US')).toBe('0');
  });
});
