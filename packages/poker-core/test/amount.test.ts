import { describe, expect, it } from 'vitest';
import { parseAmount, roundMoney, toBb } from '../src/index';

describe('parseAmount', () => {
  it.each([
    ['600', 600],
    ['0.06', 0.06],
    ['0,25', 0.25],
    ['1k5', 1500],
    ['1k25', 1250],
    ['2k', 2000],
    ['1.5k', 1500],
    ['1,5k', 1500],
    ['18k', 18000],
    ['18.000', 18000],
    ['1.234.567', 1234567],
    ['18,000', 18000],
    ['18.000,50', 18000.5],
    ['18,000.50', 18000.5],
    ['0.250', 0.25],
    ['1.50', 1.5],
    [' 1 500 ', 1500],
    ['-500', -500],
    ['+2k', 2000],
    ['-1k5', -1500],
    ['1K5', 1500],
  ])('%s -> %d', (input, expected) => {
    expect(parseAmount(input)).toBeCloseTo(expected, 10);
  });

  it.each([[''], ['   '], ['abc'], ['12x'], ['k5'], ['1k5k'], ['1..2'], [null], [undefined]])(
    'rejects %s',
    (input) => {
      expect(parseAmount(input)).toBeNull();
    },
  );

  it('passes finite numbers through', () => {
    expect(parseAmount(42)).toBe(42);
    expect(parseAmount(Number.NaN)).toBeNull();
  });
});

describe('roundMoney', () => {
  it('rounds to 2 decimals like numeric(14,2)', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(-1.005)).toBe(-1.01);
    expect(roundMoney(18000)).toBe(18000);
  });
});

describe('toBb', () => {
  it('converts money to big blinds', () => {
    expect(toBb(-18000, 50)).toBe(-360);
    expect(toBb(0.25, 0.02)).toBe(12.5);
  });
});
