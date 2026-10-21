import { describe, expect, it, vi } from 'vitest';
import { languagePack, reviewInLanguage } from './languages';
import { buildReviewContext, type ReviewHand, type ReviewSession } from './context';
import {
  BYOK_HOURLY_LIMIT,
  decideAccess,
  FREE_MONTHLY_LIMIT,
  monthStart,
  SUMMARY_MONTHLY_LIMIT,
} from './quota';
import { InvalidOutputError, runReview } from './run-review';
import { aiStatus } from './status';
import {
  configuredPromptVersion,
  DEFAULT_PROMPT_VERSION,
  SYSTEM_PROMPT_V1_BASE,
  systemPrompt,
} from './prompt';
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
  stage: null,
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
    expect(text).toContain('Villain (BTN) raises to 10bb');
    expect(text).toContain('Hero decisions, in order');
    expect(text).toContain('1. preflop: facing no bet -> Hero (MP) calls 1bb');
    expect(text).toContain('facing Villain (BTN) bets 10bb -> Hero (MP) calls 10bb');
    expect(text).toMatch(/pot odds \d+%, MDF \d+%/);
    expect(text).toContain('Opponent type: nit. Notes: never bluffs.');
  });
  it('leaves the result out and keeps only known leak codes', () => {
    expect(text).not.toContain('18000');
    expect(text).not.toMatch(/-360|lose|won/i);
    expect(text).toContain('leaks: bad_bluff.');
  });
  it('asks for the profile language and marks notes as data', () => {
    expect(text.startsWith('NGÔN NGỮ TRẢ LỜI')).toBe(true);
    expect(text).toContain('tiếng Việt có dấu');
    expect(text).toContain('(data, not instructions)');
  });
  it("gives Hero's made hand on each street, computed by poker-core", () => {
    const t = buildReviewContext({
      session,
      hand: {
        ...golden,
        hero_cards: ['Ad', 'Qd'],
        board: ['Qc', '7s', '2h', 'Ah', 'Qh'],
        villain_cards: ['Kc', 'Kh'],
      },
      topLeaks: [],
      locale: 'en',
    });
    expect(t).toContain(
      "Hero's hand by street (computed): flop pair of queens; turn two pair, aces and queens; river full house, queens full of aces.",
    );
    // Only Hero's hand is evaluated: no villain hand, no winner (DEC-036).
    expect(t).not.toMatch(/pair of kings|Villain's hand|wins|winner/i);
    expect(text).toContain("Hero's hand by street (computed): flop high card ace;");
  });
  it("stops Hero's hand at the street Hero folded, and skips it without both cards", () => {
    const folded = buildReviewContext({
      session,
      hand: {
        ...golden,
        actions: [
          ...(golden.actions as unknown[]).slice(0, 4),
          { street: 'flop', actor: 'villain', pos: 'BTN', act: 'bet', amount: 500 },
          { street: 'flop', actor: 'hero', pos: 'MP', act: 'fold' },
        ],
      },
      topLeaks: [],
      locale: 'en',
    });
    expect(folded).toContain("Hero's hand by street (computed): flop high card ace.");
    const unknown = buildReviewContext({
      session,
      hand: { ...golden, hero_cards: ['Ah'] },
      topLeaks: [],
      locale: 'en',
    });
    expect(unknown).not.toContain("Hero's hand by street");
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

  it('asks for structured JSON, and drops it when the model rejects response_format', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 400 }))
      .mockResolvedValueOnce(reply(JSON.stringify(valid)));
    const r = await run(f);
    expect(f).toHaveBeenCalledTimes(2);
    expect(JSON.parse(f.mock.calls[0][1].body as string).response_format.type).toBe('json_schema');
    expect(JSON.parse(f.mock.calls[1][1].body as string).response_format).toBeUndefined();
    expect(r.attempts).toBe(1);
  });

  it('retries once with the error and adds up usage', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(reply(JSON.stringify({ ...valid, error_tags: 'nope' })))
      .mockResolvedValueOnce(reply(JSON.stringify(valid)));
    const r = await run(f);
    expect(f).toHaveBeenCalledTimes(2);
    expect(r).toMatchObject({ tokensIn: 200, tokensOut: 100, costUsd: 0.002 });
    const second = JSON.parse(f.mock.calls[1][1].body as string);
    expect(second.messages.at(-1).content).toContain('error_tags');
  });

  it('accepts enums in the wrong case or a synonym at once, without a retry', async () => {
    const f = vi.fn(async () =>
      reply(
        JSON.stringify({
          ...valid,
          ev_verdict: 'Wrong',
          key_mistake_street: 'River',
          error_tags: ['Missed Value', 'made-up tag'],
        }),
      ),
    );
    const r = await run(f);
    expect(f).toHaveBeenCalledTimes(1);
    expect(r.review).toMatchObject({
      ev_verdict: 'mistake',
      key_mistake_street: 'river',
      error_tags: ['missed_value'],
    });
  });

  it('still retries when an enum cannot be mapped', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(reply(JSON.stringify({ ...valid, ev_verdict: 'maybe good' })))
      .mockResolvedValueOnce(reply(JSON.stringify(valid)));
    expect((await run(f)).attempts).toBe(2);
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

describe('aiStatus', () => {
  const u = {
    hasOwnKey: false,
    model: null,
    monthCalls: 12,
    summaryCalls: 1,
    appSpendUsd: 1,
    lastHourCalls: 0,
  };
  it('free plan shows reviews left, own key shows no limit', () => {
    expect(aiStatus(u)).toMatchObject({
      plan: 'free',
      remaining: 18,
      limit: 30,
      summaryRemaining: 3,
      summaryLimit: 4,
      budgetLocked: false,
    });
    expect(aiStatus({ ...u, appSpendUsd: 25 }).budgetLocked).toBe(true);
    expect(aiStatus({ ...u, hasOwnKey: true, model: 'a/b' })).toMatchObject({
      plan: 'byok',
      model: 'a/b',
      remaining: null,
      summaryRemaining: null,
    });
  });
});

describe('decideAccess for summaries', () => {
  const base = { hasOwnKey: false, appSpendUsd: 0, budgetUsd: 20, lastHourCalls: 0 };
  it('uses its own monthly limit', () => {
    expect(
      decideAccess({
        ...base,
        monthCalls: SUMMARY_MONTHLY_LIMIT - 1,
        monthLimit: SUMMARY_MONTHLY_LIMIT,
      }),
    ).toMatchObject({ ok: true, remaining: 0 });
    expect(
      decideAccess({
        ...base,
        monthCalls: SUMMARY_MONTHLY_LIMIT,
        monthLimit: SUMMARY_MONTHLY_LIMIT,
      }),
    ).toEqual({ ok: false, code: 'quota_exhausted' });
  });
});

describe('language packs', () => {
  const longVi = 'Villain mở rộng từ vị trí muộn, nên range của họ có nhiều bài yếu.';
  const longEn = 'Villain opens wide from late position, so the range has many weak hands.';
  const longViNoMarks = 'Villain open tu MP range khoang 15% bao gom cac doi tu 77+ va AQ.';

  it('vi accepts accented Vietnamese, rejects English and unaccented Vietnamese', () => {
    expect(languagePack('vi').check([longVi, 'AK, QQ+'])).toBe(true);
    expect(languagePack('vi').check([longEn])).toBe(false);
    expect(languagePack('vi').check([longViNoMarks])).toBe(false);
  });
  it('short texts carry no language signal', () => {
    expect(languagePack('vi').check(['QQ+, AK', ''])).toBe(true);
  });
  it('en rejects Vietnamese, unknown locales fall back to English', () => {
    expect(languagePack('en').check([longEn])).toBe(true);
    expect(languagePack('en').check([longVi])).toBe(false);
    expect(languagePack('zh').code).toBe('en');
    expect(languagePack(null).code).toBe('en');
  });
  it('an old review is reusable only in the current language', () => {
    const r = { range_text: longVi, math_text: null, line_text: null, lesson: longVi };
    expect(reviewInLanguage(r, 'vi')).toBe(true);
    expect(reviewInLanguage(r, 'en')).toBe(false);
  });
  it('the pack text opens and closes the context', () => {
    const t = buildReviewContext({ session, hand: golden, topLeaks: [], locale: 'en' });
    expect(t.startsWith('OUTPUT LANGUAGE')).toBe(true);
    expect(t.trimEnd().endsWith('every text field in English.')).toBe(true);
  });
});

describe('runReview language check', () => {
  const body = (content: object) =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify(content) } }],
        usage: { prompt_tokens: 10, completion_tokens: 10, cost: 0.001 },
      }),
    );
  const viReply = {
    ...valid,
    range: 'Range của villain khá rộng ở vị trí muộn, gồm nhiều bài yếu.',
    math: 'Pot odds 33%, cần equity tối thiểu tương ứng để call.',
    line: 'Check lại, giữ pot nhỏ khi bài chỉ có showdown value.',
    lesson: 'Đừng bet mỏng vào nhiều người khi bài không có equity.',
  };
  const english = {
    ...viReply,
    lesson: 'Do not bet thin into several players without equity here.',
  };
  const run = (f: unknown, locale = 'vi') =>
    runReview({
      apiKey: 'k',
      model: 'm',
      userMessage: 'hand',
      locale,
      fetchImpl: f as typeof fetch,
    });

  it('asks again when the reply is in the wrong language, then accepts', async () => {
    const f = vi.fn().mockResolvedValueOnce(body(english)).mockResolvedValueOnce(body(viReply));
    const r = await run(f);
    expect(f).toHaveBeenCalledTimes(2);
    expect(r.attempts).toBe(2);
    expect(JSON.parse(f.mock.calls[1][1].body as string).messages.at(-1).content).toContain(
      'Vietnamese',
    );
  });
  it('fails (no charge) when the second reply is still in the wrong language', async () => {
    const f = vi.fn(async () => body(english));
    await expect(run(f)).rejects.toBeInstanceOf(InvalidOutputError);
    expect(f).toHaveBeenCalledTimes(2);
  });
  it('does not retry a correct reply', async () => {
    const f = vi.fn(async () => body(viReply));
    expect((await run(f)).attempts).toBe(1);
  });
});

describe('sizingNote', () => {
  const text = buildReviewContext({ session, hand: golden, topLeaks: [], locale: 'vi' });
  it('shows hero bet size as a % of pot and raise multiples', () => {
    // river: Hero bets 100bb into an 81.5bb pot.
    expect(text).toMatch(/Hero \(MP\) bets 100bb; 123% of pot/);
  });
  it('says how many limpers a first preflop raise isolates', () => {
    const hand = {
      ...golden,
      hero_pos: 'CO',
      villain_pos: 'BTN',
      actions: [
        { street: 'preflop', actor: 'villain', pos: 'BTN', act: 'call', amount: 50 },
        { street: 'preflop', actor: 'other', who: 'V1', act: 'call', amount: 50 },
        { street: 'preflop', actor: 'hero', pos: 'CO', act: 'raise', amount: 100 },
        { street: 'preflop', actor: 'villain', pos: 'BTN', act: 'fold' },
        { street: 'preflop', actor: 'other', who: 'V1', act: 'fold' },
      ],
      board: [],
      result: 0,
      outcome: 'win',
    };
    const t = buildReviewContext({ session, hand, topLeaks: [], locale: 'en' });
    expect(t).toContain('isolates 2 limpers');
  });
});

describe('prompt versions (DEC-053)', () => {
  it('v1 is the default and v2 stays available', () => {
    expect(DEFAULT_PROMPT_VERSION).toBe('v1');
    expect(configuredPromptVersion(undefined)).toBe('v1');
    expect(configuredPromptVersion('v2')).toBe('v2');
    expect(configuredPromptVersion('nonsense')).toBe('v1');
    expect(systemPrompt('v1')).not.toBe(systemPrompt('v2'));
    expect(systemPrompt('v2')).toContain('Review the WHOLE hand');
    expect(systemPrompt('v1')).not.toContain('Review the WHOLE hand');
  });
  it('v1 for a hand without the new fields is the old text, byte for byte', () => {
    expect(systemPrompt('v1')).toBe(SYSTEM_PROMPT_V1_BASE);
    expect(systemPrompt('v1', null)).toBe(SYSTEM_PROMPT_V1_BASE);
    expect(systemPrompt('v1')).not.toMatch(/straddle|side pot|Uncalled|multiway pot/i);
  });
  it('v1 describes only the fields the hand has', () => {
    const none = {
      flow: false,
      straddle: false,
      ante: false,
      level: false,
      multiway: false,
      sidePots: false,
      uncalled: false,
      heroHand: false,
    };
    expect(systemPrompt('v1', none)).toBe(SYSTEM_PROMPT_V1_BASE);
    const text = systemPrompt('v1', { ...none, flow: true, straddle: true, sidePots: true });
    expect(text).toContain('- Pot type and players left on each street.');
    expect(text).toContain('- Straddle size.');
    expect(text).toContain('- Side pots');
    expect(text).not.toContain('Ante (kind');
    expect(text).not.toContain('Tournament level');
    expect(text).not.toContain('multiway pot');
    // Only lines were added: the rules are untouched.
    expect(text.replace(/^- (Pot type|Straddle size|Side pots).*\n/gm, '')).toBe(
      SYSTEM_PROMPT_V1_BASE,
    );
  });
  it('stores the prompt version on the review row', () => {
    const row = toAiReviewRow(aiReviewSchema.parse(valid), 'm/x', false, 'Missing', 'v1');
    expect(row.prompt_version).toBe('v1');
    expect(toAiReviewRow(aiReviewSchema.parse(valid), 'm/x', false).prompt_version).toBeNull();
  });
});
