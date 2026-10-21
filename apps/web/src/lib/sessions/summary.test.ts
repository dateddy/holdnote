import { describe, expect, it } from 'vitest';
import {
  emptySummaryForm,
  mergeMtt,
  parseEndForm,
  parseSummaryForm,
  readMttResult,
  readSummary,
  summaryFormFrom,
  toStatsSession,
  type SummaryFormValues,
} from './summary';

const form = (over: Partial<SummaryFormValues> = {}): SummaryFormValues => ({
  ...emptySummaryForm(),
  ...over,
});

describe('readSummary', () => {
  it('returns an empty summary for junk', () => {
    expect(readSummary(null)).toEqual(readSummary({}));
    expect(readSummary([1]).good).toEqual([]);
  });

  it('keeps only valid grade, known leak tags and short lists', () => {
    const s = readSummary({
      grade: 'Z',
      good: ['a', ' ', 3, 'b', 'c', 'd'],
      leak_tags: ['tilt', 'none', 'made_up', 'sizing_too_small'],
      rules: ['r1'],
      notes: 'n',
    });
    expect(s.grade).toBeNull();
    expect(s.good).toEqual(['a', 'b', 'c']);
    expect(s.leak_tags).toEqual(['tilt', 'sizing_too_small']);
    expect(s.rules).toEqual(['r1']);
  });
});

describe('parseSummaryForm', () => {
  it('cash needs a cash-out; zero is allowed', () => {
    expect(parseSummaryForm(form(), 'cash')).toEqual({
      ok: false,
      errors: { cashout: 'required' },
    });
    const r = parseSummaryForm(form({ cashout: '0' }), 'cash');
    expect(r.ok && r.value.cashout).toBe(0);
  });

  it('parses chip-style amounts and rejects negatives and junk', () => {
    const ok = parseSummaryForm(form({ cashout: '1k5' }), 'cash');
    expect(ok.ok && ok.value.cashout).toBe(1500);
    expect(parseSummaryForm(form({ cashout: '-3' }), 'cash')).toMatchObject({ ok: false });
    expect(parseSummaryForm(form({ cashout: 'abc' }), 'cash')).toMatchObject({ ok: false });
  });

  it('mtt needs the prize (0 = out of the money) and ignores cash-out', () => {
    expect(parseSummaryForm(form({ cashout: '5' }), 'mtt')).toEqual({
      ok: false,
      errors: { prize: 'required' },
    });
    const r = parseSummaryForm(
      form({ prize: '0', place: '90', entries: '100', reentries: '1', bustStage: 'early' }),
      'mtt',
    );
    expect(r.ok && r.value.cashout).toBeNull();
    expect(r.ok && r.value.mttResult).toEqual({
      reentries: 1,
      place: 90,
      entries: 100,
      prize: 0,
      bounty: null,
      bust_stage: 'early',
    });
  });

  it('rejects a bad grade, state, stage or count', () => {
    const r = parseSummaryForm(
      form({ cashout: '1', grade: 'E', selfState: 'angry', bustStage: 'x' }),
      'cash',
    );
    expect(r).toEqual({
      ok: false,
      errors: { grade: 'invalid', selfState: 'invalid', bustStage: 'invalid' },
    });
    expect(parseSummaryForm(form({ prize: '1', place: '1.5' }), 'mtt')).toMatchObject({
      ok: false,
    });
  });

  it('splits lines, trims, limits counts and drops unknown or duplicate leak tags', () => {
    const r = parseSummaryForm(
      form({
        cashout: '10',
        grade: 'B',
        selfState: 'tilt',
        good: ' one \n\n two\nthree\nfour',
        rules: '1\n2\n3\n4\n5',
        leaks: ['tilt', 'tilt', 'none', 'nope', 'bad_bluff'],
        notes: '  hi  ',
      }),
      'cash',
    );
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.self_state).toBe('tilt');
    expect(r.value.summary).toEqual({
      grade: 'B',
      good: ['one', 'two', 'three'],
      leak_tags: ['tilt', 'bad_bluff'],
      rules: ['1', '2', '3', '4'],
      notes: 'hi',
    });
  });
});

describe('summaryFormFrom', () => {
  it('round-trips through parseSummaryForm', () => {
    const row = {
      kind: 'cash',
      cashout: 4.81,
      self_state: 'tired',
      summary: { grade: 'C', good: ['x'], leak_tags: ['tilt'], rules: ['y', 'z'], notes: 'n' },
      mtt: null,
    };
    const r = parseSummaryForm(summaryFormFrom(row), 'cash');
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.cashout).toBe(4.81);
    expect(r.value.self_state).toBe('tired');
    expect(r.value.summary).toEqual(row.summary);
  });
});

describe('mtt result', () => {
  it('reads defensively', () => {
    expect(readMttResult(null)).toEqual({
      reentries: 0,
      place: null,
      entries: null,
      prize: null,
      bounty: null,
      bust_stage: null,
    });
    expect(readMttResult({ reentries: -1, prize: 'x', bust_stage: 'itm' })).toMatchObject({
      reentries: 0,
      prize: null,
      bust_stage: 'itm',
    });
  });

  it('merges the result into the entry info and keeps it', () => {
    const entry = {
      name: 'Sunday',
      type: 'regular',
      reentry: true,
      start_level: 1,
      start_stack: 10000,
    };
    const merged = mergeMtt(entry, {
      reentries: 1,
      place: 5,
      entries: 50,
      prize: 9,
      bounty: 1,
      bust_stage: 'itm',
    });
    expect(merged).toMatchObject({ name: 'Sunday', reentry: true, start_stack: 10000, place: 5 });
    expect(mergeMtt(null, readMttResult(null))).toBeNull();
  });
});

describe('toStatsSession', () => {
  it('keeps the chip rate of a CHIP session only', () => {
    const row = {
      id: 's',
      kind: 'cash',
      mode: 'live',
      venue: null,
      stake_label: null,
      bb: 50,
      date: '2026-10-01',
      start_at: null,
      end_at: null,
      buyin: 100,
      cashout: 150,
      stop_loss: null,
      self_state: null,
      mtt: null,
      chip_value: 1000,
      chip_currency: 'VND',
    };
    expect(toStatsSession({ ...row, currency: 'CHIP' }).chipRate).toEqual({
      value: 1000,
      currency: 'VND',
    });
    expect(toStatsSession({ ...row, currency: 'VND' }).chipRate).toBeUndefined();
    expect(toStatsSession({ ...row, currency: 'CHIP', chip_value: null }).chipRate).toBeUndefined();
  });

  it('maps a cash row and an mtt row', () => {
    const base = {
      id: 's',
      mode: 'live',
      venue: null,
      stake_label: null,
      currency: 'VND',
      bb: 50,
      date: '2026-10-01',
      start_at: null,
      end_at: null,
      buyin: 100,
      cashout: 150,
      stop_loss: null,
      self_state: null,
    };
    expect(toStatsSession({ ...base, kind: 'cash', mtt: null })).toMatchObject({
      kind: 'cash',
      mtt: null,
      cashout: 150,
    });
    const m = toStatsSession({
      ...base,
      kind: 'mtt',
      mtt: { prize: 300, reentries: 1, bust_stage: 'itm' },
    });
    expect(m.mtt).toEqual({
      reentries: 1,
      prize: 300,
      bounty: null,
      place: null,
      entries: null,
      bustStage: 'itm',
    });
  });
});

describe('parseEndForm', () => {
  it('cash needs a cash-out and ignores the debrief fields', () => {
    expect(parseEndForm(form(), 'cash')).toEqual({ ok: false, errors: { cashout: 'required' } });
    const r = parseEndForm(
      form({ cashout: '1k5', selfState: 'tilt', grade: 'A', good: 'x', notes: 'y' }),
      'cash',
    );
    expect(r).toEqual({
      ok: true,
      value: {
        cashout: 1500,
        self_state: 'tilt',
        mttResult: expect.objectContaining({ prize: null }),
      },
    });
  });

  it('MTT needs a prize; the state is optional', () => {
    expect(parseEndForm(form(), 'mtt')).toEqual({ ok: false, errors: { prize: 'required' } });
    const r = parseEndForm(form({ prize: '0', place: '90', bustStage: 'bubble' }), 'mtt');
    expect(r.ok && r.value.self_state).toBeNull();
    expect(r.ok && r.value.mttResult).toMatchObject({ prize: 0, place: 90, bust_stage: 'bubble' });
  });

  it('a debrief-only error does not block ending the session', () => {
    const r = parseEndForm(form({ cashout: '0', grade: 'Z' }), 'cash');
    expect(r.ok).toBe(true);
  });
});
