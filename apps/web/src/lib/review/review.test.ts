import { describe, expect, it } from 'vitest';
import {
  aiErrorCode,
  effectiveReviews,
  evDivergence,
  isRetryable,
  reviewInfoByHand,
  reviewsByHand,
  splitReviews,
  contentChanged,
  emptyReview,
  ERROR_TAGS,
  EV_VERDICTS,
  fromReviewRow,
  sameField,
  toReviewRow,
  toggleTag,
} from './review';

describe('error tags', () => {
  it('has the 14 fixed codes plus none', () => {
    expect(ERROR_TAGS).toHaveLength(15);
    expect(ERROR_TAGS).toContain('read_right_act_wrong');
    expect(ERROR_TAGS).toContain('none');
    expect(EV_VERDICTS).toEqual(['correct', 'mistake', 'unsure']);
  });

  it('none excludes the other tags and vice versa', () => {
    expect(toggleTag(['sizing_too_small'], 'none')).toEqual(['none']);
    expect(toggleTag(['none'], 'tilt')).toEqual(['tilt']);
    expect(toggleTag(['tilt'], 'tilt')).toEqual([]);
    expect(toggleTag(['tilt'], 'sizing_too_small')).toEqual(['tilt', 'sizing_too_small']);
  });
});

describe('toReviewRow', () => {
  it('trims text, nulls empty fields and drops unknown tags', () => {
    const draft = {
      ...emptyReview(),
      range: '  wide  ',
      errorTags: ['tilt', 'bogus'],
      evVerdict: 'mistake',
      accepted: true,
    };
    expect(toReviewRow(draft, false)).toEqual({
      range_text: 'wide',
      math_text: null,
      line_text: null,
      icm_text: null,
      error_tags: ['tilt'],
      ev_verdict: 'mistake',
      lesson: null,
      accepted: true,
    });
  });

  it('ignores ICM text for cash hands', () => {
    const draft = { ...emptyReview(), icmText: 'bubble', evVerdict: 'nonsense' };
    const row = toReviewRow(draft, false);
    expect(row.icm_text).toBeNull();
    expect(row.ev_verdict).toBeNull();
    expect(toReviewRow(draft, true).icm_text).toBe('bubble');
  });

  it('round trips through fromReviewRow', () => {
    const row = {
      range_text: 'a',
      math_text: 'b',
      line_text: 'c',
      icm_text: 'd',
      error_tags: ['tilt'],
      ev_verdict: 'correct',
      lesson: 'e',
      accepted: true,
    };
    expect(toReviewRow(fromReviewRow(row), true)).toEqual(row);
    expect(fromReviewRow(null)).toEqual(emptyReview());
  });
});

describe('AI review helpers', () => {
  const base = {
    ...emptyReview(),
    range: 'wide',
    errorTags: ['tilt', 'bad_bluff'],
    evVerdict: 'mistake',
  };

  it('sameField compares tags as a set and ignores edge spaces in text', () => {
    expect(sameField(base, { ...base, errorTags: ['bad_bluff', 'tilt'] }, 'errorTags')).toBe(true);
    expect(sameField(base, { ...base, range: ' wide ' }, 'range')).toBe(true);
    expect(sameField(base, { ...base, errorTags: ['tilt'] }, 'errorTags')).toBe(false);
  });
  it('contentChanged ignores accepted but sees any field edit', () => {
    expect(contentChanged(base, { ...base, accepted: true })).toBe(false);
    expect(contentChanged(base, { ...base, lesson: 'new' })).toBe(true);
    expect(contentChanged(base, { ...base, evVerdict: 'correct' })).toBe(true);
  });
  it('aiErrorCode falls back to server_error', () => {
    expect(aiErrorCode('quota_exhausted')).toBe('quota_exhausted');
    expect(aiErrorCode('weird')).toBe('server_error');
    expect(aiErrorCode(undefined)).toBe('server_error');
    expect(aiErrorCode('upstream_error')).toBe('upstream_error');
    expect(aiErrorCode('save_failed')).toBe('save_failed');
  });
  it('isRetryable: failures that used no turn can be retried, limits cannot', () => {
    for (const c of ['invalid_output', 'timeout', 'provider_busy', 'upstream_error', 'offline'])
      expect(isRetryable(c)).toBe(true);
    for (const c of [
      'quota_exhausted',
      'budget_locked',
      'rate_limited',
      'key_rejected',
      'not_found',
    ])
      expect(isRetryable(c)).toBe(false);
  });
});

describe('AI and own review side by side', () => {
  const rows = [
    { hand_id: 'h1', source: 'ai', accepted: false, ev_verdict: 'mistake' },
    { hand_id: 'h1', source: 'manual', accepted: true, ev_verdict: 'correct' },
    { hand_id: 'h2', source: 'ai', accepted: false, ev_verdict: 'correct' },
    { hand_id: 'h3', source: 'manual', accepted: false, ev_verdict: null },
  ];

  it('splitReviews picks the current review of each kind', () => {
    const { ai, manual } = splitReviews(rows.slice(0, 2));
    expect([ai?.ev_verdict, manual?.ev_verdict]).toEqual(['mistake', 'correct']);
    expect(splitReviews([])).toEqual({ ai: null, manual: null });
    expect(splitReviews(rows.slice(2, 3)).manual).toBeNull();
  });

  it('reviewInfoByHand: an AI review exists, any accepted review counts', () => {
    const info = reviewInfoByHand(rows);
    expect(info.get('h1')).toEqual({ hasAi: true, accepted: true });
    expect(info.get('h2')).toEqual({ hasAi: true, accepted: false });
    expect(info.get('h3')).toEqual({ hasAi: false, accepted: false });
  });

  it('effectiveReviews: the own review wins over the AI one, in either order', () => {
    const pick = (list: typeof rows) =>
      effectiveReviews(list)
        .map((r) => `${r.hand_id}:${r.source}`)
        .sort();
    expect(pick(rows)).toEqual(['h1:manual', 'h2:ai', 'h3:manual']);
    expect(pick([rows[1]!, rows[0]!])).toEqual(['h1:manual']);
  });

  it('evDivergence: only when both say something and they differ', () => {
    expect(evDivergence('mistake', 'correct')).toEqual({ ai: 'mistake', manual: 'correct' });
    expect(evDivergence('correct', 'correct')).toBeNull();
    expect(evDivergence('mistake', null)).toBeNull();
    expect(evDivergence(undefined, 'correct')).toBeNull();
    expect(evDivergence('mistake', '')).toBeNull();
  });
});

describe('reviewsByHand', () => {
  it('groups the current reviews of many hands by kind', () => {
    const out = reviewsByHand([
      { hand_id: 'a', source: 'ai', n: 1 },
      { hand_id: 'b', source: 'manual', n: 2 },
      { hand_id: 'a', source: 'manual', n: 3 },
    ]);
    expect(out.a).toEqual({
      ai: { hand_id: 'a', source: 'ai', n: 1 },
      manual: { hand_id: 'a', source: 'manual', n: 3 },
    });
    expect(out.b?.ai).toBeNull();
    expect(out.c).toBeUndefined();
  });
});
