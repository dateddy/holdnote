import { describe, expect, it, vi } from 'vitest';
import { buildReviewContext, type ReviewHand, type ReviewSession } from './context';
import { decideRebuttalAccess } from './quota';
import {
  hasFreeRebuttal,
  reusableReview,
  runRebuttal,
  threadOf,
  threadRebuttals,
  type RebuttalRow,
} from './rebuttal';
import { aiReviewState } from '@/lib/review/ai-state';

const review = {
  range: 'Villain BTN raises a wide range, many broadways and suited aces.',
  math: 'Pot odds 25% on the river call.',
  line: 'Check-call flop and turn, fold river to the shove.',
  icm: '',
  error_tags: ['call_too_loose'],
  ev_verdict: 'mistake',
  key_mistake_street: 'river',
  repeats_known_leak: false,
  lesson: '1. Fold one pair to a river shove from a nit.',
  missing_info: [],
};

const reply = (content: unknown) =>
  new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(content) } }],
      usage: { prompt_tokens: 100, completion_tokens: 50, cost: 0.001 },
    }),
  );

const run = (fetchImpl: unknown) =>
  runRebuttal({
    apiKey: 'k',
    model: 'm',
    userMessage: 'hand',
    locale: 'en',
    fetchImpl: fetchImpl as typeof fetch,
  });

describe('runRebuttal: the AI answers the argument, keeps or revises', () => {
  it('a kept conclusion comes back with its own reply', async () => {
    const f = vi.fn(async () =>
      reply({
        decision: 'keep',
        reply: 'A nit can still shove river with two pair or better here.',
        review,
      }),
    );
    const r = await run(f);
    expect(f).toHaveBeenCalledTimes(1);
    expect(r.decision).toBe('keep');
    expect(r.reply).toContain('nit can still shove');
    expect(r).toMatchObject({ tokensIn: 100, costUsd: 0.001 });
  });

  it('a revised conclusion carries the new review', async () => {
    const f = vi.fn(async () =>
      reply({
        decision: 'Revised',
        reply: 'Fair point: against this player the call is fine.',
        review: { ...review, ev_verdict: 'correct', error_tags: ['none'] },
      }),
    );
    const r = await run(f);
    expect(r.decision).toBe('revise');
    expect(r.review.ev_verdict).toBe('correct');
  });

  it('asks again when the reply is in the wrong language', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(
        reply({
          decision: 'keep',
          reply: 'Mình vẫn giữ kết luận vì đối thủ chặt và shove river.',
          review,
        }),
      )
      .mockResolvedValueOnce(
        reply({ decision: 'keep', reply: 'The nit range is strong on the river here.', review }),
      );
    const r = await run(f);
    expect(f).toHaveBeenCalledTimes(2);
    expect(r.attempts).toBe(2);
  });
});

describe('the rebuttal context asks for a decision and a reply', () => {
  const session: ReviewSession = {
    kind: 'cash',
    mode: 'live',
    sb: 25,
    bb: 50,
    straddle: null,
    ante_mode: 'none',
    ante: null,
    buyin: 18000,
    seats: 9,
    mtt: null,
  };
  const hand: ReviewHand = {
    num: 1,
    hero_cards: ['Ah', 'Kd'],
    board: [],
    villain_cards: null,
    hero_pos: 'MP',
    villain_pos: 'BTN',
    opponent_id: null,
    raw_line: null,
    outcome: 'lose',
    result: -50,
    hero_stack: 5000,
    villain_stack: 5000,
    level_bb: null,
    players_dealt: null,
    ante: null,
    stage: null,
    thought: null,
    flagged: false,
    actions: [{ street: 'preflop', actor: 'hero', pos: 'MP', act: 'fold' }],
  };
  it('names the previous review, the argument and the expected answer', () => {
    const t = buildReviewContext({
      session,
      hand,
      topLeaks: [],
      locale: 'en',
      rebuttal: {
        reason: 'he never bluffs',
        previous: {
          range_text: 'r',
          math_text: 'm',
          line_text: 'l',
          error_tags: ['bad_bluff'],
          ev_verdict: 'mistake',
          lesson: 'x',
        },
      },
    });
    expect(t).toContain('he never bluffs');
    expect(t).toContain('decision');
    expect(t).toContain('"keep"');
    expect(t).toContain('"revise"');
    expect(t).toContain('reply');
  });
});

describe('reusableReview: an unchanged hand gets its old review back, a rebuttal never does', () => {
  const current = {
    source: 'ai',
    created_at: '2026-10-21T10:00:00Z',
    range_text: 'Villain BTN raises a wide range, many broadways and suited aces.',
    math_text: null,
    line_text: null,
    lesson: null,
  };
  const handUpdatedAt = '2026-10-21T09:00:00Z';
  it('reuses for a plain request on an unchanged hand', () => {
    expect(reusableReview({ rebuttal: false, current, handUpdatedAt, locale: 'en' })).toBe(true);
  });
  it('a rebuttal always calls the AI, even on an unchanged hand', () => {
    expect(reusableReview({ rebuttal: true, current, handUpdatedAt, locale: 'en' })).toBe(false);
  });
  it('an edited hand or another language calls the AI', () => {
    expect(
      reusableReview({
        rebuttal: false,
        current,
        handUpdatedAt: '2026-10-21T11:00:00Z',
        locale: 'en',
      }),
    ).toBe(false);
    expect(reusableReview({ rebuttal: false, current, handUpdatedAt, locale: 'vi' })).toBe(false);
    expect(reusableReview({ rebuttal: false, current: null, handUpdatedAt, locale: 'en' })).toBe(
      false,
    );
  });
});

const row = (r: Partial<RebuttalRow> & Pick<RebuttalRow, 'id'>): RebuttalRow => ({
  thread_id: 'A',
  review_id: 'A',
  new_review_id: null,
  reason: 'why',
  outcome: 'kept',
  reply: 'because',
  free: false,
  created_at: '2026-10-21T10:00:00Z',
  ...r,
});

describe('rebuttal threads: one analysis, one free rebuttal', () => {
  const rows = [
    row({ id: '1', free: true, created_at: '2026-10-21T10:00:00Z' }),
    row({
      id: '2',
      outcome: 'revised',
      new_review_id: 'B',
      created_at: '2026-10-21T10:05:00Z',
    }),
    row({ id: '3', thread_id: 'C', review_id: 'C', created_at: '2026-10-21T09:00:00Z' }),
  ];
  it('a revised review stays in the thread of the analysis it replaced', () => {
    expect(threadOf('A', rows)).toBe('A');
    expect(threadOf('B', rows)).toBe('A');
    expect(threadOf('Z', rows)).toBe('Z');
  });
  it('lists the thread in order, without other analyses', () => {
    expect(threadRebuttals('B', rows).map((r) => r.id)).toEqual(['1', '2']);
    expect(threadRebuttals('Z', rows)).toEqual([]);
  });
  it('the free rebuttal is used once per thread', () => {
    expect(hasFreeRebuttal('A', rows)).toBe(false);
    expect(hasFreeRebuttal('B', rows)).toBe(false);
    expect(hasFreeRebuttal('C', rows)).toBe(true);
    expect(hasFreeRebuttal('Z', [])).toBe(true);
  });
});

describe('decideRebuttalAccess', () => {
  const base = {
    hasOwnKey: false,
    monthCalls: 30,
    appSpendUsd: 0,
    budgetUsd: 20,
    lastHourCalls: 0,
  };
  it('the free rebuttal goes through with no turns left and uses none', () => {
    expect(decideRebuttalAccess(base, true)).toEqual({ ok: true, billedTo: 'app', remaining: 0 });
    expect(decideRebuttalAccess({ ...base, monthCalls: 4 }, true)).toEqual({
      ok: true,
      billedTo: 'app',
      remaining: 26,
    });
  });
  it('a paid rebuttal uses one turn', () => {
    expect(decideRebuttalAccess(base, false)).toEqual({ ok: false, code: 'quota_exhausted' });
    expect(decideRebuttalAccess({ ...base, monthCalls: 4 }, false)).toMatchObject({
      remaining: 25,
    });
  });
  it('the app budget still locks a free rebuttal; an own key pays its own way', () => {
    expect(decideRebuttalAccess({ ...base, appSpendUsd: 20 }, true)).toEqual({
      ok: false,
      code: 'budget_locked',
    });
    expect(decideRebuttalAccess({ ...base, hasOwnKey: true }, true)).toEqual({
      ok: true,
      billedTo: 'user',
      remaining: null,
    });
  });
});

describe('aiReviewState: what the hand screen shows around the AI review', () => {
  const ai = {
    id: 'A',
    source: 'ai',
    created_at: '2026-10-21T10:00:00Z',
    range_text: 'Villain BTN raises a wide range, many broadways and suited aces.',
    math_text: null,
    line_text: null,
    lesson: null,
  };
  it('the re-run is offered only when the hand changed after the review', () => {
    expect(aiReviewState(ai, [], '2026-10-21T09:00:00Z', 'en').aiStale).toBe(false);
    expect(aiReviewState(ai, [], '2026-10-21T11:00:00Z', 'en').aiStale).toBe(true);
  });
  it('carries the thread and whether the next rebuttal is free', () => {
    const s = aiReviewState(ai, [row({ id: '1', free: true })], '2026-10-21T09:00:00Z', 'en');
    expect(s.rebuttals.map((r) => r.id)).toEqual(['1']);
    expect(s.freeRebuttal).toBe(false);
    expect(aiReviewState(null, [], '2026-10-21T09:00:00Z', 'en')).toEqual({
      rebuttals: [],
      freeRebuttal: true,
      aiStale: false,
      aiCardFlag: false,
    });
  });
});

describe('app budget spent: even the free rebuttal is blocked', () => {
  it('free rebuttal, turns left, budget reached or passed → budget_locked', () => {
    for (const appSpendUsd of [20, 20.01, 35]) {
      expect(
        decideRebuttalAccess(
          { hasOwnKey: false, monthCalls: 0, appSpendUsd, budgetUsd: 20, lastHourCalls: 0 },
          true,
        ),
      ).toEqual({ ok: false, code: 'budget_locked' });
    }
  });
  it('just under the budget the free rebuttal still runs', () => {
    expect(
      decideRebuttalAccess(
        { hasOwnKey: false, monthCalls: 0, appSpendUsd: 19.99, budgetUsd: 20, lastHourCalls: 0 },
        true,
      ),
    ).toMatchObject({ ok: true, billedTo: 'app' });
  });
});

describe('aiReviewState flags wrong cards in the saved text', () => {
  const cards = { hero: ['Ad', 'Qd'], board: ['Qc', '7s', '2h', 'Ah', 'Qh'], villain: [] };
  const ai = {
    id: 'A',
    source: 'ai',
    created_at: '2026-10-21T10:00:00Z',
    range_text: 'Villain calls wide.',
    math_text: null,
    line_text: 'With full house (QhQc on board AhQh), raise.',
    lesson: null,
  };
  it('review and rebuttal reply', () => {
    const s = aiReviewState(
      ai,
      [
        row({ id: '1', reply: 'Mình cầm AdQd, full house ở river.' }),
        row({ id: '2', reply: 'Hero holds QhQc.' }),
      ],
      '2026-10-21T09:00:00Z',
      'en',
      cards,
    );
    expect(s.aiCardFlag).toBe(true);
    expect(s.rebuttals.map((r) => r.card_flag)).toEqual([false, true]);
    expect(
      aiReviewState({ ...ai, line_text: 'Raise river.' }, [], '2026-10-21T09:00:00Z', 'en', cards)
        .aiCardFlag,
    ).toBe(false);
  });
});
