import { describe, expect, it } from 'vitest';
import {
  emptyReview,
  ERROR_TAGS,
  EV_VERDICTS,
  fromReviewRow,
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
