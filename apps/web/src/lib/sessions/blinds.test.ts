import { describe, expect, it } from 'vitest';
import type { BlindLevel } from 'poker-core';
import { levelFromFields, levelRowText, nextRowFields, rowFields } from './blinds';

const row = (over: Partial<BlindLevel> = {}): BlindLevel => ({
  level: 8,
  sb: 300,
  bb: 600,
  ante: 600,
  anteMode: 'bb',
  minutes: 20,
  ...over,
});

const fields = (over = {}) => ({
  level: '8',
  sb: '300',
  bb: '600',
  ante: '600',
  anteMode: 'bb',
  minutes: '20',
  ...over,
});

describe('levelFromFields', () => {
  it('builds a row from typed fields', () => {
    expect(levelFromFields(fields())).toEqual(row());
  });
  it('accepts k and separators', () => {
    expect(levelFromFields(fields({ sb: '1k', bb: '2,000', ante: '2k' }))).toMatchObject({
      sb: 1000,
      bb: 2000,
      ante: 2000,
    });
  });
  it('minutes are optional', () => {
    expect(levelFromFields(fields({ minutes: '' }))?.minutes).toBeNull();
  });
  it('"none" means no ante, whatever is typed', () => {
    expect(levelFromFields(fields({ anteMode: 'none', ante: '600' }))).toMatchObject({
      ante: 0,
      anteMode: 'none',
    });
  });
  it('a BB ante with no amount is the BB', () => {
    expect(levelFromFields(fields({ ante: '' }))).toMatchObject({ ante: 600, anteMode: 'bb' });
  });
  it('a per-player ante needs an amount', () => {
    expect(levelFromFields(fields({ anteMode: 'each', ante: '' }))).toBeNull();
    expect(levelFromFields(fields({ anteMode: 'each', ante: '75' }))).toMatchObject({
      ante: 75,
      anteMode: 'each',
    });
  });
  it('rejects a bad level, blinds or minutes', () => {
    expect(levelFromFields(fields({ level: '0' }))).toBeNull();
    expect(levelFromFields(fields({ level: '' }))).toBeNull();
    expect(levelFromFields(fields({ level: '2.5' }))).toBeNull();
    expect(levelFromFields(fields({ sb: '700' }))).toBeNull();
    expect(levelFromFields(fields({ bb: '0', sb: '0' }))).toBeNull();
    expect(levelFromFields(fields({ bb: '' }))).toBeNull();
    expect(levelFromFields(fields({ minutes: 'x' }))).toBeNull();
    expect(levelFromFields(fields({ minutes: '0' }))).toBeNull();
  });
  it('an SB of 0 is fine (some structures start with no SB)', () => {
    expect(levelFromFields(fields({ sb: '0' }))?.sb).toBe(0);
  });
});

describe('rowFields', () => {
  it('gives back the typed form of a row', () => {
    expect(rowFields(row())).toEqual(fields());
    expect(rowFields(row({ ante: 0, anteMode: 'none', minutes: null }))).toEqual(
      fields({ ante: '', anteMode: 'none', minutes: '' }),
    );
  });
  it('round-trips', () => {
    expect(levelFromFields(rowFields(row()))).toEqual(row());
  });
});

describe('nextRowFields', () => {
  it('copies the last row with the next level number', () => {
    expect(nextRowFields([row({ level: 3 }), row({ level: 7 })])).toEqual(fields({ level: '8' }));
  });
  it('starts at level 1 with nothing filled when the list is empty', () => {
    expect(nextRowFields([])).toEqual({
      level: '1',
      sb: '',
      bb: '',
      ante: '',
      anteMode: 'none',
      minutes: '',
    });
  });
});

describe('levelRowText', () => {
  it('Lv n · sb/bb (ante)', () => {
    expect(levelRowText(row({ minutes: null }))).toBe('Lv 8 · 300/600 (600)');
  });
  it('no ante, no brackets', () => {
    expect(levelRowText(row({ ante: 0, anteMode: 'none', minutes: null }))).toBe('Lv 8 · 300/600');
  });
  it('adds the length when it is given', () => {
    expect(levelRowText(row(), (n) => `${n} phút`)).toBe('Lv 8 · 300/600 (600) · 20 phút');
  });
});
