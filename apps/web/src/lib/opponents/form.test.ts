import { describe, expect, it } from 'vitest';
import { opponentFormFrom, parseOpponentForm } from './form';

const base = { name: 'Anh áo đỏ', playerType: 'station', venue: 'Sòng A', notes: 'call mọi thứ' };

describe('parseOpponentForm', () => {
  it('trims and keeps valid values', () => {
    expect(parseOpponentForm({ ...base, name: '  Anh áo đỏ ', venue: ' ' })).toEqual({
      ok: true,
      row: { name: 'Anh áo đỏ', player_type: 'station', venue: null, notes: 'call mọi thứ' },
    });
  });

  it('needs a name, and a known type when one is given', () => {
    expect(parseOpponentForm({ ...base, name: ' ' })).toEqual({
      ok: false,
      errors: { name: 'required' },
    });
    expect(parseOpponentForm({ ...base, playerType: 'fish' })).toEqual({
      ok: false,
      errors: { playerType: 'invalid' },
    });
    const none = parseOpponentForm({ ...base, playerType: '' });
    expect(none.ok && none.row.player_type).toBeNull();
  });

  it('rejects text that is too long', () => {
    expect(parseOpponentForm({ ...base, name: 'x'.repeat(61) })).toEqual({
      ok: false,
      errors: { name: 'tooLong' },
    });
    expect(parseOpponentForm({ ...base, notes: 'x'.repeat(1001) })).toEqual({
      ok: false,
      errors: { notes: 'tooLong' },
    });
  });

  it('round-trips through opponentFormFrom', () => {
    const r = parseOpponentForm(base);
    if (!r.ok) throw new Error('expected ok');
    expect(opponentFormFrom(r.row)).toEqual(base);
  });
});
