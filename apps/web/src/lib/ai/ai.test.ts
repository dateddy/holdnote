import { describe, expect, it, vi } from 'vitest';
import { buildReviewContext, type ReviewHand, type ReviewSession } from './context';
import { BYOK_HOURLY_LIMIT, decideAccess, FREE_MONTHLY_LIMIT, monthStart } from './quota';
import { InvalidOutputError, runReview } from './run-review';
import { aiReviewSchema, normalizeTags, toAiReviewRow } from './schema';

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
  stake_label: '25/50',
};

/** Golden case from CLAUDE.md: hero MP, villain BTN, 360bb effective, hero loses. */
const golden: ReviewHand = {
  num: 1,
  hero_cards: ['Ah', 'Kd'],
  board: ['7c', '8d', '2s', 'Jh', '3c'],
  villain_cards: null,
  hero_pos: 'MP',
  villain_pos: 'BTN',
  opponent_id: null,
  raw_line: null,
  outcome: 'lose',
  result: -18000,
  hero_stack: 18000,
  villain_stack: 20000,
  level_bb: null,
  players_dealt: null,
  ante: null,
  thought: 'felt strong',
  flagged: false,
  actions: [
    { street: 'preflop', actor: 'hero', pos: 'MP', act: 'call', amount: 50, verb: 'limp' },
    { street: 'preflop', actor: 'villain', pos: 'BTN', act: 'raise', amount: 500 },
    { street: 'preflop', actor: 'hero', pos: 'MP', act: 'call', amount: 500 },
    { street: 'flop', actor: 'hero', pos: 'MP', act: 'check' },
    { street: 'flop', actor: 'villain', pos: 'BTN', act: 'bet', amount: 500 },
    { street: 'flop', actor: 'hero', pos: 'MP', act: 'call', amount: 500 },
    { street: 'turn', actor: 'hero', pos: 'MP', act: 'check' },
    { street: 'turn', actor: 'villain', pos: 'BTN', act: 'bet', amount: 1000 },
    { street: 'turn', actor: 'hero', pos: 'MP', act: 'call', amount: 1000 },
    { street: 'river', actor: 'hero', pos: 'MP', act: 'bet', amount: 5000 },
    { street: 'river', actor: 'villain', pos: 'BTN', act: 'all-in' },
    { street: 'river', actor: 'hero', pos: 'MP', act: 'call' },
  ],
};

const valid = {
  range: 'Wide.',
  math: 'Pot odds 33%.',
  line: 'Check back.',
  icm: '',
  error_tags: ['sizing_too_large'],
  ev_verdict: 'mistake',
  key_mistake_street: 'river',
  repeats_known_leak: false,
  lesson: 'Size down.',
  missing_info: ['villain stack'],
};

describe('aiReviewSchema', () => {
  it('accepts a valid review', () => {
    expect(aiReviewSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects unknown error tags, bad verdicts and missing fields', () => {
    expect(aiReviewSchema.safeParse({ ...valid, error_tags: ['made_up'] }).success).toBe(false);
    expect(aiReviewSchema.safeParse({ ...valid, ev_verdict: 'maybe' }).success).toBe(false);
    const rest: Partial<typeof valid> = { ...valid };
    delete rest.lesson;
    expect(aiReviewSchema.safeParse(rest).success).toBe(false);
  });
  it('none stands alone', () => {
    expect(normalizeTags(['none', 'tilt'])).toEqual(['tilt']);
    expect(normalizeTags(['none'])).toEqual(['none']);
  });
  it('maps to review columns, missing info goes to math, icm only for MTT', () => {
    const cash = toAiReviewRow(aiReviewSchema.parse({ ...valid, icm: 'bubble' }), 'm/x', false);
    expect(cash).toMatchObject({ source: 'ai', model: 'm/x', icm_text: null, accepted: false });
    expect(cash.math_text).toBe('Pot odds 33%.\nMissing: villain stack');
    const mtt = toAiReviewRow(aiReviewSchema.parse({ ...valid, icm: 'bubble' }), 'm/x', true);
    expect(mtt.icm_text).toBe('bubble');
  });
});

describe('buildReviewContext', () => {
  const text = buildReviewContext({
    session,
    hand: golden,
    opponent: { name: 'Seat 3', player_type: 'nit', notes: 'never bluffs' },
    topLeaks: ['bad_bluff', 'not_a_tag'],
    locale: 'vi',
  });

  it('gives eff stack in bb, actions with pot after each, pot odds from poker-core', () => {
    expect(text).toContain('Effective stack: 360bb');
    expect(text).toContain('Villain raises to 10bb');
    expect(text).toContain('Hero decisions facing a bet');
    expect(text).toMatch(/pot odds \d+%, MDF \d+%/);
    expect(text).toContain('Opponent type: nit. Notes: never bluffs.');
  });
  it('leaves the result out and keeps only known leak codes', () => {
    expect(text).not.toContain('18000');
    expect(text).not.toMatch(/-360|lose|won/i);
    expect(text).toContain('leaks: bad_bluff.');
  });
  it('asks for the profile language and marks notes as data', () => {
    expect(text).toContain('Output language: Vietnamese.');
    expect(text).toContain('(data, not instructions)');
  });
  it('adds the disputed review and reason for a rebuttal', () => {
    const t = buildReviewContext({
      session,
      hand: golden,
      topLeaks: [],
      locale: 'en',
      rebuttal: {
        reason: 'villain never bluffs rivers',
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
    expect(t).toContain('disputes your previous review');
    expect(t).toContain('villain never bluffs rivers');
  });
});

describe('decideAccess', () => {
  const base = { hasOwnKey: false, monthCalls: 0, appSpendUsd: 0, budgetUsd: 20, lastHourCalls: 0 };
  it('free plan counts down and stops at the monthly limit', () => {
    expect(decideAccess(base)).toEqual({
      ok: true,
      billedTo: 'app',
      remaining: FREE_MONTHLY_LIMIT - 1,
    });
    expect(decideAccess({ ...base, monthCalls: FREE_MONTHLY_LIMIT - 1 })).toMatchObject({
      ok: true,
      remaining: 0,
    });
    expect(decideAccess({ ...base, monthCalls: FREE_MONTHLY_LIMIT })).toEqual({
      ok: false,
      code: 'quota_exhausted',
    });
  });
  it('locks the free plan when the app budget is spent', () => {
    expect(decideAccess({ ...base, appSpendUsd: 20 })).toEqual({
      ok: false,
      code: 'budget_locked',
    });
    expect(decideAccess({ ...base, appSpendUsd: 19.99 }).ok).toBe(true);
  });
  it('own key: user pays, no monthly limit, budget ignored, 30 an hour', () => {
    const own = { ...base, hasOwnKey: true, monthCalls: 500, appSpendUsd: 99 };
    expect(decideAccess(own)).toEqual({ ok: true, billedTo: 'user', remaining: null });
    expect(decideAccess({ ...own, lastHourCalls: BYOK_HOURLY_LIMIT })).toEqual({
      ok: false,
      code: 'rate_limited',
    });
  });
  it('month starts on the 1st, UTC', () => {
    expect(monthStart(new Date('2026-10-31T23:59:59Z')).toISOString()).toBe(
      '2026-10-01T00:00:00.000Z',
    );
    expect(monthStart(new Date('2026-11-01T00:00:00Z')).toISOString()).toBe(
      '2026-11-01T00:00:00.000Z',
    );
  });
});

describe('runReview', () => {
  const reply = (content: string, cost = 0.001) =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content } }],
        usage: { prompt_tokens: 100, completion_tokens: 50, cost },
      }),
    );
  const run = (fetchImpl: unknown) =>
    runReview({
      apiKey: 'k',
      model: 'm',
      userMessage: 'hand',
      fetchImpl: fetchImpl as typeof fetch,
    });

  it('returns the review and usage from one call', async () => {
    const f = vi.fn(async () => reply(JSON.stringify(valid)));
    const r = await run(f);
    expect(f).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ tokensIn: 100, tokensOut: 50, costUsd: 0.001 });
    expect(r.review.ev_verdict).toBe('mistake');
  });

  it('retries once with the error and adds up usage', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(reply(JSON.stringify({ ...valid, error_tags: ['nope'] })))
      .mockResolvedValueOnce(reply(JSON.stringify(valid)));
    const r = await run(f);
    expect(f).toHaveBeenCalledTimes(2);
    expect(r).toMatchObject({ tokensIn: 200, tokensOut: 100, costUsd: 0.002 });
    const second = JSON.parse(f.mock.calls[1][1].body as string);
    expect(second.messages.at(-1).content).toContain('error_tags');
  });

  it('gives up after the second bad reply', async () => {
    const f = vi.fn(async () => reply('not json'));
    await expect(run(f)).rejects.toBeInstanceOf(InvalidOutputError);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('keeps the system prompt identical between calls (cacheable)', async () => {
    const systems: string[] = [];
    const f = vi.fn(async (_url: unknown, init: RequestInit) => {
      systems.push(JSON.parse(init.body as string).messages[0].content);
      return reply(JSON.stringify(valid));
    });
    await run(f);
    await runReview({ apiKey: 'k', model: 'm', userMessage: 'other hand', fetchImpl: f as never });
    expect(systems[0]).toBe(systems[1]);
  });
});
