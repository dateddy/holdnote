import { describe, expect, it } from 'vitest';
import {
  editFormFrom,
  emptyForm,
  mergeMttUpdate,
  parseSessionForm,
  prefillFrom,
  readMtt,
  type SessionFormValues,
} from './form';

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

describe('parseSessionForm — blind structure', () => {
  const levels = JSON.stringify([
    { level: 1, sb: 25, bb: 50, ante: 0, ante_mode: 'none', minutes: 20 },
    { level: 7, sb: 175, bb: 350, ante: 350, ante_mode: 'bb', minutes: 20 },
    { level: 8, sb: 200, bb: 400, ante: 400, ante_mode: 'bb', minutes: null },
  ]);
  const bare = { sb: '', bb: '', anteMode: 'none', ante: '', mttBlindLevels: levels };

  it('is stored in mtt.blind_levels, sorted', () => {
    const r = parseSessionForm(
      mtt({ ...bare, mttBlindLevels: JSON.stringify(JSON.parse(levels).reverse()) }),
    );
    expect(r.ok && r.insert.mtt?.blind_levels?.map((l) => l.level)).toEqual([1, 7, 8]);
  });

  it('fills empty SB, BB and ante from the start level', () => {
    const r = parseSessionForm(mtt(bare));
    expect(r.ok && r.insert).toMatchObject({ sb: 175, bb: 350, ante_mode: 'bb', ante: 350 });
  });

  it('without a start level, from the first level', () => {
    const r = parseSessionForm(mtt({ ...bare, mttStartLevel: '' }));
    expect(r.ok && r.insert).toMatchObject({ sb: 25, bb: 50, ante_mode: 'none', ante: null });
  });

  it('the start level wins over blinds typed or carried over from the last session', () => {
    const r = parseSessionForm(mtt({ ...bare, sb: '100', bb: '200', anteMode: 'each', ante: '5' }));
    expect(r.ok && r.insert).toMatchObject({ sb: 175, bb: 350, ante_mode: 'bb', ante: 350 });
  });

  it('does not need the blind fields at all (they are hidden when there is a structure)', () => {
    const r = parseSessionForm(mtt({ ...bare, anteMode: '' }));
    expect(r.ok && r.insert).toMatchObject({ sb: 175, bb: 350 });
  });

  it('a start level missing from the list uses the next one up', () => {
    const r = parseSessionForm(mtt({ ...bare, mttStartLevel: '5' }));
    expect(r.ok && r.insert.bb).toBe(350);
  });

  it('empty or missing structure leaves mtt without blind_levels', () => {
    for (const mttBlindLevels of ['', '[]']) {
      const r = parseSessionForm(mtt({ mttBlindLevels }));
      expect(r.ok && r.insert.mtt).not.toHaveProperty('blind_levels');
    }
  });

  it('rejects text that is not a JSON list', () => {
    expect(parseSessionForm(mtt({ mttBlindLevels: 'oops' }))).toEqual({
      ok: false,
      errors: { mttBlindLevels: 'invalid' },
    });
    expect(parseSessionForm(mtt({ mttBlindLevels: '{"a":1}' }))).toMatchObject({ ok: false });
  });

  it('a cash session ignores it', () => {
    const r = parseSessionForm(cash({ mttBlindLevels: levels }));
    expect(r.ok && r.insert.mtt).toBeNull();
  });
});

describe('readMtt', () => {
  it('keeps the blind structure, so ending the session does not lose it', () => {
    const levels = [{ level: 1, sb: 25, bb: 50, ante: 0, ante_mode: 'none', minutes: null }];
    expect(readMtt({ name: 'x', blind_levels: levels })?.blind_levels).toEqual(levels);
    expect(readMtt({ name: 'x' })).not.toHaveProperty('blind_levels');
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

describe('editFormFrom', () => {
  const row = {
    kind: 'cash',
    mode: 'live',
    currency: 'VND',
    venue: 'Chill',
    date: '2026-10-14',
    sb: 25,
    bb: 50,
    straddle: null,
    ante_mode: 'none',
    ante: null,
    seats: 9,
    buyin: 10000,
    stop_loss: 20000,
    mtt: null,
  };
  it('fills every field of the form from the saved session, date included', () => {
    expect(editFormFrom(row, 'USD')).toMatchObject({
      kind: 'cash',
      venue: 'Chill',
      date: '2026-10-14',
      sb: '25',
      bb: '50',
      buyin: '10000',
      stopLoss: '20000',
      currency: 'VND',
    });
  });
  it('round trip: the form of a saved session parses back to the same numbers', () => {
    const parsed = parseSessionForm(editFormFrom(row, 'VND'));
    expect(parsed.ok && parsed.insert).toMatchObject({
      sb: 25,
      bb: 50,
      buyin: 10000,
      stop_loss: 20000,
    });
  });
});

describe('mergeMttUpdate', () => {
  const next = {
    name: 'New',
    type: 'regular',
    reentry: false,
    start_level: 1,
    start_stack: 10000,
  } as const;
  it('cash has no MTT block', () => {
    expect(mergeMttUpdate({ prize: 1 }, null)).toBeNull();
  });
  it('keeps the result fields and replaces the setup', () => {
    const old = { name: 'Old', prize: 2000, place: 12, reentries: 1, blind_levels: [{ level: 1 }] };
    expect(mergeMttUpdate(old, { ...next })).toEqual({
      name: 'New',
      type: 'regular',
      reentry: false,
      start_level: 1,
      start_stack: 10000,
      prize: 2000,
      place: 12,
      reentries: 1,
    });
  });
  it('a structure in the form replaces the saved one', () => {
    const blind_levels = [{ level: 2, sb: 50, bb: 100 }];
    expect(
      (
        mergeMttUpdate({ blind_levels: [{ level: 1 }] }, {
          ...next,
          blind_levels,
        } as never) as never as { blind_levels: unknown }
      ).blind_levels,
    ).toEqual(blind_levels);
  });
  it('a missing or malformed old block starts from the new one', () => {
    expect(mergeMttUpdate(null, { ...next })).toEqual({ ...next });
    expect(mergeMttUpdate([1, 2], { ...next })).toEqual({ ...next });
  });
});
