import { describe, expect, it } from 'vitest';
import { foldText, hasName, matchNames, opponentLabel } from './labels';

describe('opponentLabel', () => {
  it('adds the seat from two opponents on', () => {
    expect(opponentLabel('Đối thủ', 'BTN', 1)).toBe('Đối thủ');
    expect(opponentLabel('Đối thủ', 'BTN', 2)).toBe('Đối thủ · BTN');
  });
});

describe('matchNames', () => {
  const options = [
    { id: '1', name: 'Anh râu', sameVenue: false },
    { id: '2', name: 'Áo đỏ', sameVenue: true },
    { id: '3', name: 'Áo xanh', sameVenue: false },
  ];
  it('ignores accents and case', () => {
    expect(foldText('Đỏ ÁO')).toBe('do ao');
    expect(matchNames(options, 'AO').map((o) => o.id)).toEqual(['2', '3']);
    expect(matchNames(options, 'rau').map((o) => o.id)).toEqual(['1']);
  });
  it('puts the venue first and lists everyone for an empty query', () => {
    expect(matchNames(options, '').map((o) => o.id)).toEqual(['2', '1', '3']);
  });
  it('knows an exact name', () => {
    expect(hasName(options, 'ao DO')).toBe(true);
    expect(hasName(options, 'ao')).toBe(false);
  });
});
