import { describe, expect, it } from 'vitest';
import { parseShorthand } from 'poker-core';
import { emptyDraft, type HandSession } from './build';
import { applyShorthand, backspaceToken, insertToken } from './shorthand';

const cash: HandSession = {
  kind: 'cash',
  sb: 25,
  bb: 50,
  straddle: null,
  ante_mode: 'none',
  ante: null,
  buyin: 18000,
  seats: 9,
  mtt: null,
};

describe('insertToken', () => {
  it('adds tokens separated by one space', () => {
    expect(insertToken('', 'H')).toBe('H ');
    expect(insertToken('H ', 'o600')).toBe('H o600 ');
    expect(insertToken('H o600', 'V')).toBe('H o600 V ');
  });

  it('puts the street separator with spaces on both sides', () => {
    expect(insertToken('H o600 V c ', '/')).toBe('H o600 V c / ');
    expect(insertToken('H o600 V c', '/')).toBe('H o600 V c / ');
  });
});

describe('backspaceToken', () => {
  it('removes the last token', () => {
    expect(backspaceToken('H o600 V c ')).toBe('H o600 V ');
    expect(backspaceToken('H o600 V c / ')).toBe('H o600 V c ');
    expect(backspaceToken('H ')).toBe('');
    expect(backspaceToken('')).toBe('');
  });
});

describe('applyShorthand', () => {
  it('fills only empty board slots from the line', () => {
    const draft = emptyDraft(cash, null);
    draft.slots = ['Ah', 'Kd', '', '', '', '', ''];
    const parsed = parseShorthand('H o150 V c / 8sQhJh V x H b100 V c / 2c V x H x', {});
    const out = applyShorthand(draft, parsed);
    expect(out.slots).toEqual(['Ah', 'Kd', '8s', 'Qh', 'Jh', '2c', '']);
    expect(out.actions).toEqual(parsed.actions);
  });

  it('keeps cards already picked', () => {
    const draft = emptyDraft(cash, null);
    draft.slots = ['Ah', 'Kd', 'As', '', '', '', ''];
    const parsed = parseShorthand('H o150 V c / 8sQhJh V x', {});
    expect(applyShorthand(draft, parsed).slots.slice(2, 5)).toEqual(['As', 'Qh', 'Jh']);
  });
});
