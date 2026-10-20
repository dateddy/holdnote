import { describe, expect, it } from 'vitest';
import {
  compareReviews,
  evOfOld,
  groupOfTag,
  groupRecall,
  groupsOfTags,
  inSplit,
  styleStats,
  summarize,
  verdictErrors,
} from './bench';

describe('bench helpers', () => {
  it('maps the 14 codes onto the old groups', () => {
    expect(groupOfTag('preflop_too_loose')).toBe('Preflop');
    expect(groupOfTag('sizing_too_large')).toBe('Sizing');
    expect(groupOfTag('misread_range')).toBe('Đọc sai range');
    expect(groupOfTag('tilt')).toBe('Cảm xúc');
    expect(groupOfTag('none')).toBe('Không lỗi');
    expect(groupOfTag('bad_bluff')).toBe('Khác');
    expect(groupsOfTags(['sizing_too_small', 'sizing_too_large'])).toEqual(['Sizing']);
  });

  it('maps old EV labels', () => {
    expect(evOfOld('Sai')).toBe('mistake');
    expect(evOfOld('Đúng')).toBe('correct');
    expect(evOfOld('Chưa chắc')).toBe('unsure');
    expect(evOfOld('')).toBeNull();
  });

  it('compares groups, error flag and EV', () => {
    const old = { groups: ['Preflop', 'Sizing'], ev: 'mistake' };
    expect(compareReviews(old, { tags: ['sizing_too_small'], ev: 'mistake' })).toEqual({
      groupsExact: false,
      groupsOverlap: true,
      errorFlag: true,
      evMatch: true,
    });
    expect(
      compareReviews(old, { tags: ['preflop_too_loose', 'sizing_too_small'], ev: 'correct' }),
    ).toMatchObject({ groupsExact: true, evMatch: false });
    // "Other" never matches, but still counts as an error for the flag.
    expect(compareReviews(old, { tags: ['bad_bluff'], ev: 'mistake' })).toMatchObject({
      groupsOverlap: false,
      errorFlag: true,
    });
    expect(
      compareReviews({ groups: ['Không lỗi'], ev: null }, { tags: ['none'], ev: 'correct' }),
    ).toEqual({
      groupsExact: true,
      groupsOverlap: true,
      errorFlag: true,
      evMatch: null,
    });
  });

  it('summarizes rates, cost and time', () => {
    const cmp = { groupsExact: true, groupsOverlap: true, errorFlag: true, evMatch: true };
    const s = summarize([
      { ok: true, attempts: 1, costUsd: 0.002, ms: 2000, cmp },
      { ok: true, attempts: 2, costUsd: 0.004, ms: 6000, cmp: { ...cmp, evMatch: false } },
      { ok: false, attempts: null, costUsd: 0.004, ms: 4000, cmp: null },
    ]);
    expect(s).toMatchObject({ runs: 3, valid: '67%', validFirstTry: '33%', ev: '50%' });
    expect(s.costPerHand).toBeCloseTo(0.01 / 3);
    expect(s.seconds).toBeCloseTo(4);
  });
});

describe('tune/test split and recall', () => {
  it('splits into two disjoint halves', () => {
    const all = [0, 1, 2, 3, 4];
    expect(inSplit(all, 'tune')).toEqual([0, 2, 4]);
    expect(inSplit(all, 'test')).toEqual([1, 3]);
    expect(inSplit(all, 'all')).toEqual(all);
  });
  it('counts how often each old group is found', () => {
    const r = groupRecall([
      { oldGroups: ['Sizing', 'Preflop'], aiTags: ['sizing_too_small'] },
      { oldGroups: ['Sizing'], aiTags: ['none'] },
    ]);
    expect(r).toEqual({ Sizing: { n: 2, hit: 1 }, Preflop: { n: 1, hit: 0 } });
  });
  it('measures Hero/Villain use, lesson length, numbering and unsure', () => {
    const s = styleStats([
      { texts: ['Hero bets, Villain calls'], lesson: '1. a b 2. c d', ev: 'unsure' },
      { texts: ['mình bet'], lesson: 'one two three four', ev: 'correct' },
    ]);
    expect(s).toMatchObject({
      heroVillainPerReview: 1,
      lessonWords: 5,
      unsure: '50%',
      numberedLessons: '50%',
    });
  });
});

describe('verdictErrors', () => {
  it('counts false alarms against "correct" and misses against "mistake"', () => {
    const e = verdictErrors([
      { oldEv: 'correct', aiEv: 'mistake' },
      { oldEv: 'correct', aiEv: 'correct' },
      { oldEv: 'correct', aiEv: 'unsure' },
      { oldEv: 'mistake', aiEv: 'correct' },
      { oldEv: 'mistake', aiEv: 'mistake' },
      { oldEv: 'unsure', aiEv: 'mistake' },
      { oldEv: null, aiEv: 'correct' },
    ]);
    expect(e.falseMistake).toEqual({ n: 1, d: 3 });
    expect(e.missedMistake).toEqual({ n: 1, d: 2 });
  });
});
