import { describe, expect, it } from 'vitest';
import { duplicateCards, isCard, parseCards, takenSuits } from '../src/index';

describe('parseCards', () => {
  it('parses suited cards', () => {
    expect(parseCards('AhKd')).toEqual(['Ah', 'Kd']);
    expect(parseCards('8sQhJh')).toEqual(['8s', 'Qh', 'Jh']);
  });

  it('accepts 10 as T and lowercase input', () => {
    expect(parseCards('10h9c')).toEqual(['Th', '9c']);
    expect(parseCards('ahkd')).toEqual(['Ah', 'Kd']);
    expect(parseCards('tS')).toEqual(['Ts']);
  });

  it('keeps unknown suit as ?', () => {
    expect(parseCards('K?Q?')).toEqual(['K?', 'Q?']);
  });

  it('turns rank-only cards into unknown suit', () => {
    expect(parseCards('K22')).toEqual(['K?', '2?', '2?']);
    expect(parseCards('Q44')).toEqual(['Q?', '4?', '4?']);
  });

  it('ignores separators', () => {
    expect(parseCards('Ah, Kd')).toEqual(['Ah', 'Kd']);
    expect(parseCards('Ah Kd Qc')).toEqual(['Ah', 'Kd', 'Qc']);
  });

  it('returns empty for garbage or empty input', () => {
    expect(parseCards('')).toEqual([]);
    expect(parseCards('xyz')).toEqual([]);
    expect(parseCards(null)).toEqual([]);
  });
});

describe('isCard', () => {
  it('validates card strings', () => {
    expect(isCard('Ah')).toBe(true);
    expect(isCard('K?')).toBe(true);
    expect(isCard('1h')).toBe(false);
    expect(isCard('Ahh')).toBe(false);
    expect(isCard('ah')).toBe(false);
  });
});

describe('duplicate cards and taken suits (5.1c-5)', () => {
  it('flags every copy of a repeated card', () => {
    expect(duplicateCards(['Ah', 'Kd', 'Ah', '7c'])).toEqual([0, 2]);
    expect(duplicateCards(['Ah', 'Kd'])).toEqual([]);
  });

  it('ignores unknown-suit cards and empty slots', () => {
    expect(duplicateCards(['K?', 'K?', '', ''])).toEqual([]);
  });

  it('lists the suits already used for a rank', () => {
    expect(takenSuits('A', ['Ah', 'As', 'Kd', 'A?', ''])).toEqual(['s', 'h']);
    expect(takenSuits('2', ['Ah'])).toEqual([]);
  });
});
