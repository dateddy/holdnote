import { describe, expect, it } from 'vitest';
import { emptyForm, parseSessionForm, prefillFrom, type SessionFormValues } from './form';

const cash = (over: Partial<SessionFormValues> = {}): SessionFormValues => ({
  ...emptyForm('VND'),
  kind: 'cash',
  mode: 'live',
  venue: 'Chill',
  sb: '25',
  bb: '50',
  seats: '9',
  buyin: '18k',
  stopLoss: '36.000',
  date: '2026-10-03',
  ...over,
});

const mtt = (over: Partial<SessionFormValues> = {}): SessionFormValues => ({
  ...emptyForm('USD'),
  kind: 'mtt',
  mode: 'online',
  venue: 'N8',
  mttName: 'Bounty Hunters Special',
  mttType: 'bounty',
  mttReentry: 'on',
  mttStartLevel: '7',
  sb: '175',
  bb: '350',
  anteMode: 'each',
  ante: '50',
  buyin: '1.08',
  mttStartStack: '10k',
  ...over,
});

describe('parseSessionForm — head count', () => {
  it('an MTT keeps the number of players too', () => {
    const r = parseSessionForm(mtt({ seats: '8' }));
    expect(r.ok && r.insert.seats).toBe(8);
    expect(parseSessionForm(mtt({ seats: '11' }))).toMatchObject({ ok: false });
  });
});

describe('parseSessionForm — cash', () => {
  it('builds the insert row with amounts parsed by poker-core', () => {
    const r = parseSessionForm(cash());
    expect(r).toEqual({
      ok: true,
      insert: {
        kind: 'cash',
        mode: 'live',
        currency: 'VND',
        venue: 'Chill',
        date: '2026-10-03',
        stake_label: '25/50',
        sb: 25,
        bb: 50,
        straddle: null,
        ante_mode: 'none',
        ante: null,
        seats: 9,
        buyin: 18000,
        stop_loss: 36000,
        mtt: null,
      },
    });
  });

  it('keeps small online stakes', () => {
    const r = parseSessionForm(cash({ sb: '0.01', bb: '0.02', buyin: '4', currency: 'USD' }));
    expect(r.ok && r.insert).toMatchObject({ sb: 0.01, bb: 0.02, stake_label: '0.01/0.02' });
  });

  it('adds the straddle to the stake label', () => {
    const r = parseSessionForm(cash({ straddle: '100' }));
    expect(r.ok && r.insert).toMatchObject({ straddle: 100, stake_label: '25/50/100' });
  });

  it('requires a big blind', () => {
    expect(parseSessionForm(cash({ bb: '' }))).toEqual({ ok: false, errors: { bb: 'required' } });
  });

  it('rejects junk and negative amounts', () => {
    const r = parseSessionForm(cash({ buyin: 'abc', stopLoss: '-5', straddle: '0' }));
    expect(r).toEqual({
      ok: false,
      errors: { buyin: 'invalid', stopLoss: 'positive', straddle: 'positive' },
    });
  });

  it('rejects a small blind above the big blind', () => {
    expect(parseSessionForm(cash({ sb: '100' }))).toEqual({
      ok: false,
      errors: { sb: 'sbAboveBb' },
    });
  });

  it('checks the number of seats', () => {
    for (const seats of ['1', '11', '6.5']) {
      expect(parseSessionForm(cash({ seats }))).toEqual({
        ok: false,
        errors: { seats: 'seatsRange' },
      });
    }
  });

  it('needs an ante amount when ante is on (DEC-013)', () => {
    expect(parseSessionForm(cash({ anteMode: 'each', ante: '' }))).toEqual({
      ok: false,
      errors: { ante: 'required' },
    });
    const r = parseSessionForm(cash({ anteMode: 'bb', ante: '50' }));
    expect(r.ok && r.insert).toMatchObject({ ante_mode: 'bb', ante: 50 });
  });

  it('drops the ante amount when ante is off', () => {
    const r = parseSessionForm(cash({ anteMode: 'none', ante: '10' }));
    expect(r.ok && r.insert).toMatchObject({ ante_mode: 'none', ante: null });
  });

  it('rejects unknown kind, mode and currency', () => {
    const r = parseSessionForm(cash({ kind: 'sng', mode: 'home', currency: 'BTC' }));
    expect(r).toEqual({
      ok: false,
      errors: { kind: 'invalid', mode: 'invalid', currency: 'invalid' },
    });
  });

  it('ignores a malformed date and leaves the database default', () => {
    const r = parseSessionForm(cash({ date: '03/10/2026' }));
    expect(r.ok && 'date' in r.insert).toBe(false);
  });

  it('ignores MTT fields', () => {
    const r = parseSessionForm(cash({ mttName: 'x', mttStartStack: '10k' }));
    expect(r.ok && r.insert.mtt).toBeNull();
  });
});

describe('parseSessionForm — MTT', () => {
  it('stores the start level in the blind columns and the rest in mtt', () => {
    const r = parseSessionForm(mtt());
    expect(r).toEqual({
      ok: true,
      insert: {
        kind: 'mtt',
        mode: 'online',
        currency: 'USD',
        venue: 'N8',
        stake_label: null,
        sb: 175,
        bb: 350,
        straddle: null,
        ante_mode: 'each',
        ante: 50,
        seats: null,
        buyin: 1.08,
        stop_loss: null,
        mtt: {
          name: 'Bounty Hunters Special',
          type: 'bounty',
          reentry: true,
          start_level: 7,
          start_stack: 10000,
        },
      },
    });
  });

  it('lets every blind field stay empty', () => {
    const r = parseSessionForm(
      mtt({ sb: '', bb: '', anteMode: 'none', ante: '', mttStartLevel: '', mttStartStack: '' }),
    );
    expect(r.ok && r.insert).toMatchObject({
      sb: null,
      bb: null,
      mtt: { start_level: null, start_stack: null },
    });
  });

  it('needs the big blind once the small blind is given', () => {
    expect(parseSessionForm(mtt({ bb: '' }))).toEqual({ ok: false, errors: { bb: 'required' } });
  });

  it('checks level and tournament type', () => {
    const r = parseSessionForm(mtt({ mttStartLevel: '0', mttType: 'spin' }));
    expect(r).toEqual({
      ok: false,
      errors: { mttStartLevel: 'positive', mttType: 'invalid' },
    });
  });
});

describe('prefillFrom', () => {
  it('copies the previous cash session, without date or results', () => {
    const values = prefillFrom(
      {
        kind: 'cash',
        mode: 'online',
        currency: 'USD',
        venue: 'N8',
        sb: 0.01,
        bb: 0.02,
        straddle: null,
        ante_mode: 'each',
        ante: 0.01,
        seats: 9,
        buyin: 4,
        stop_loss: 6,
        mtt: null,
      },
      'VND',
    );
    expect(values).toEqual({
      ...emptyForm('VND'),
      kind: 'cash',
      mode: 'online',
      currency: 'USD',
      venue: 'N8',
      sb: '0.01',
      bb: '0.02',
      anteMode: 'each',
      ante: '0.01',
      seats: '9',
      buyin: '4',
      stopLoss: '6',
    });
  });

  it('reads the mtt json', () => {
    const values = prefillFrom(
      {
        kind: 'mtt',
        mode: 'online',
        currency: 'USD',
        venue: 'N8',
        sb: 175,
        bb: 350,
        straddle: null,
        ante_mode: 'none',
        ante: null,
        seats: null,
        buyin: 1.08,
        stop_loss: null,
        mtt: { name: 'BHS', type: 'bounty', reentry: true, start_level: 7, start_stack: 10000 },
      },
      'VND',
    );
    expect(values).toMatchObject({
      kind: 'mtt',
      mttName: 'BHS',
      mttType: 'bounty',
      mttReentry: 'on',
      mttStartLevel: '7',
      mttStartStack: '10000',
    });
  });

  it('falls back to empty values when there is no previous session', () => {
    expect(prefillFrom(null, 'EUR')).toEqual(emptyForm('EUR'));
  });

  it('round-trips through the parser', () => {
    const r = parseSessionForm(cash());
    if (!r.ok) throw new Error('parse failed');
    const again = parseSessionForm(prefillFrom(r.insert, 'VND'));
    expect(again.ok && again.insert).toEqual({ ...r.insert, date: undefined });
  });
});
