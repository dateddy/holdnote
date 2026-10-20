import { describe, expect, it } from 'vitest';
import { enumKey, normalizeReview, normalizeSummary } from './normalize';
import { aiReviewSchema } from './schema';
import { aiSummarySchema } from './summary-schema';

const review = {
  range: 'r',
  math: 'm',
  line: 'l',
  icm: '',
  error_tags: ['missed_value'],
  ev_verdict: 'mistake',
  key_mistake_street: 'river',
  repeats_known_leak: false,
  lesson: 'x',
  missing_info: [],
};

describe('enumKey', () => {
  it('trims, lowercases and joins words with _', () => {
    expect(enumKey('  Missed Value ')).toBe('missed_value');
    expect(enumKey('PRE-FLOP')).toBe('pre_flop');
    expect(enumKey('call--too  loose')).toBe('call_too_loose');
  });
});

describe('normalizeReview', () => {
  const norm = (over: object) => normalizeReview({ ...review, ...over }) as typeof review;

  it('leaves a valid reply unchanged', () => {
    expect(normalizeReview(review)).toEqual(review);
  });

  it('maps case and spacing of enums to the fixed codes', () => {
    const r = norm({
      ev_verdict: 'Mistake',
      key_mistake_street: 'River',
      error_tags: ['Missed Value', 'CALL-TOO-LOOSE'],
    });
    expect(r.ev_verdict).toBe('mistake');
    expect(r.key_mistake_street).toBe('river');
    expect(r.error_tags).toEqual(['missed_value', 'call_too_loose']);
    expect(aiReviewSchema.safeParse(r).success).toBe(true);
  });

  it('maps synonyms of the verdict, in English and Vietnamese', () => {
    expect(norm({ ev_verdict: 'wrong' }).ev_verdict).toBe('mistake');
    expect(norm({ ev_verdict: 'Incorrect' }).ev_verdict).toBe('mistake');
    expect(norm({ ev_verdict: 'sai' }).ev_verdict).toBe('mistake');
    expect(norm({ ev_verdict: 'Right' }).ev_verdict).toBe('correct');
    expect(norm({ ev_verdict: 'Đúng' }).ev_verdict).toBe('correct');
    expect(norm({ ev_verdict: 'unclear' }).ev_verdict).toBe('unsure');
    expect(norm({ ev_verdict: 'marginal' }).ev_verdict).toBe('unsure');
    expect(norm({ ev_verdict: 'không chắc' }).ev_verdict).toBe('unsure');
  });

  it('maps street spellings, and empty or null to none', () => {
    expect(norm({ key_mistake_street: 'pre-flop' }).key_mistake_street).toBe('preflop');
    expect(norm({ key_mistake_street: 'PF' }).key_mistake_street).toBe('preflop');
    expect(norm({ key_mistake_street: null }).key_mistake_street).toBe('none');
    expect(norm({ key_mistake_street: '' }).key_mistake_street).toBe('none');
    expect(norm({ key_mistake_street: 'N/A' }).key_mistake_street).toBe('none');
  });

  it('maps tag synonyms and drops tags it cannot map', () => {
    const r = norm({ error_tags: ['overbet', 'too loose preflop', 'cosmic bad luck'] });
    expect(r.error_tags).toEqual(['sizing_too_large', 'preflop_too_loose']);
  });

  it('drops duplicates after mapping', () => {
    expect(norm({ error_tags: ['Tilt', 'tilt'] }).error_tags).toEqual(['tilt']);
  });

  it('turns "true"/"false" strings into booleans', () => {
    expect(norm({ repeats_known_leak: 'true' }).repeats_known_leak).toBe(true);
    expect(norm({ repeats_known_leak: 'False' }).repeats_known_leak).toBe(false);
  });

  it('keeps a verdict it cannot map, so Zod still rejects it', () => {
    const r = norm({ ev_verdict: 'maybe good' });
    expect(r.ev_verdict).toBe('maybe good');
    expect(aiReviewSchema.safeParse(r).success).toBe(false);
  });

  it('passes anything that is not an object through', () => {
    expect(normalizeReview(null)).toBeNull();
    expect(normalizeReview([1])).toEqual([1]);
    expect(normalizeReview('x')).toBe('x');
  });

  it('leaves a non-array tag list for Zod to reject', () => {
    expect(norm({ error_tags: 'tilt' }).error_tags).toBe('tilt');
  });
});

describe('normalizeSummary', () => {
  const summary = {
    grade: 'B',
    good: ['g'],
    leaks: [{ tag: 'tilt', note: 'n' }],
    rules: ['r'],
  };

  it('maps grade case and +/- to the letter', () => {
    for (const g of ['b', 'B+', 'b-', ' B ']) {
      expect((normalizeSummary({ ...summary, grade: g }) as typeof summary).grade).toBe('B');
    }
  });

  it('maps leak tags and drops leaks it cannot map', () => {
    const s = normalizeSummary({
      ...summary,
      leaks: [
        { tag: 'Missed Value', note: 'a' },
        { tag: 'mystery', note: 'b' },
        { tag: 'none', note: 'c' },
      ],
    }) as typeof summary;
    expect(s.leaks).toEqual([{ tag: 'missed_value', note: 'a' }]);
    expect(aiSummarySchema.safeParse(s).success).toBe(true);
  });

  it('keeps a grade it cannot map, so Zod still rejects it', () => {
    const s = normalizeSummary({ ...summary, grade: 'excellent' });
    expect(aiSummarySchema.safeParse(s).success).toBe(false);
  });
});
