import { describe, expect, it, vi } from 'vitest';
import type { StatsSession } from 'poker-core';
import { InvalidOutputError } from './run-json';
import { runSummary } from './run-summary';
import { buildSummaryContext } from './summary-context';
import { aiSummarySchema, toSummaryDraft, type AiSummary } from './summary-schema';

const session: StatsSession = {
  id: 's1',
  kind: 'cash',
  mode: 'online',
  venue: null,
  stakeLabel: '0.01/0.02',
  currency: 'USD',
  bb: 0.02,
  date: '2026-09-29',
  startAt: '2026-09-29T10:00:00Z',
  endAt: '2026-09-29T12:00:00Z',
  buyin: 8.11,
  cashout: 4.81,
  stopLoss: 3,
  selfState: 'tilt',
  mtt: null,
};

const valid: AiSummary = {
  grade: 'C',
  good: ['Folded the river in #4 against a passive player who suddenly bet big.'],
  leaks: [
    {
      tag: 'sizing_too_small',
      note: 'Min-raises in #2 and #7 isolated nobody and cost about 12 bb.',
    },
    { tag: 'sizing_too_small', note: 'duplicate tag' },
    { tag: 'tilt', note: 'After losing #5 you called three marginal spots in a row.' },
  ],
  rules: ['Open to 3bb, never min-raise.', 'Stop after two losing hands in a row when tired.'],
};

describe('buildSummaryContext', () => {
  const reviews = [
    {
      num: 2,
      verdict: 'mistake',
      tags: ['sizing_too_small'],
      lesson: 'Isolate with 3bb + 1bb per limper.',
    },
    { num: 7, verdict: 'mistake', tags: ['sizing_too_small', 'tilt'], lesson: null },
    { num: 4, verdict: 'correct', tags: ['none'], lesson: null },
  ];
  const text = buildSummaryContext({ session, handCount: 9, reviews, locale: 'en' });

  it('states the result, rate, stop-loss and state from poker-core', () => {
    expect(text).toContain('Result: -165 bb (-3.3 USD)');
    expect(text).toContain('Rate: -82.5 bb per hour');
    expect(text).toContain('broken: yes');
    expect(text).toContain('Self-reported state: tilt');
    expect(text).toContain('Hands recorded: 9; reviewed: 3');
  });

  it('lists reviews and counts tags without "none"', () => {
    expect(text).toContain('#2 | mistake | sizing_too_small | Isolate with 3bb + 1bb per limper.');
    expect(text).toContain('#4 | correct | none');
    expect(text).toContain('TAG COUNTS: sizing_too_small x2, tilt x1');
  });

  it('puts the language instruction first and the reminder last', () => {
    expect(text.startsWith('OUTPUT LANGUAGE')).toBe(true);
    expect(text.endsWith('Reminder: every text field in English.')).toBe(true);
    expect(buildSummaryContext({ session, handCount: 1, reviews: [], locale: 'vi' })).toMatch(
      /^NGÔN NGỮ TRẢ LỜI/,
    );
  });

  it('describes an mtt result and a missing result', () => {
    const mtt: StatsSession = {
      ...session,
      kind: 'mtt',
      buyin: 1.08,
      stopLoss: null,
      mtt: { reentries: 1, prize: 0, bounty: 0, place: 90, entries: 100, bustStage: 'early' },
    };
    const m = buildSummaryContext({ session: mtt, handCount: 5, reviews: [], locale: 'en' });
    expect(m).toContain('entries used: 2 (total 2.16)');
    expect(m).toContain('Result: -2.16 USD');
    expect(m).toContain('Finished: 90 of 100');
    expect(m).toContain('(none)');
    const none = buildSummaryContext({
      session: { ...session, cashout: null },
      handCount: 1,
      reviews: [],
      locale: 'en',
    });
    expect(none).toContain('Result: not entered yet');
  });

  it('caps the review list', () => {
    const many = Array.from({ length: 45 }, (_, i) => ({
      num: i + 1,
      verdict: 'correct',
      tags: [],
      lesson: null,
    }));
    const t = buildSummaryContext({ session, handCount: 45, reviews: many, locale: 'en' });
    expect(t).toContain('#40 |');
    expect(t).not.toContain('#41 |');
    expect(t).toContain('(5 more not shown)');
  });
});

describe('aiSummarySchema and toSummaryDraft', () => {
  it('rejects unknown tags, "none" and too many items', () => {
    expect(aiSummarySchema.safeParse(valid).success).toBe(true);
    expect(
      aiSummarySchema.safeParse({ ...valid, leaks: [{ tag: 'none', note: 'x' }] }).success,
    ).toBe(false);
    expect(
      aiSummarySchema.safeParse({ ...valid, leaks: [{ tag: 'made_up', note: 'x' }] }).success,
    ).toBe(false);
    expect(aiSummarySchema.safeParse({ ...valid, rules: ['a', 'b', 'c', 'd', 'e'] }).success).toBe(
      false,
    );
    expect(aiSummarySchema.safeParse({ ...valid, grade: 'E' }).success).toBe(false);
  });

  it('turns the answer into a form draft, collapsing duplicate tags', () => {
    const d = toSummaryDraft(valid);
    expect(d.grade).toBe('C');
    expect(d.leak_tags).toEqual(['sizing_too_small', 'tilt']);
    expect(d.notes).toBe(
      '• Min-raises in #2 and #7 isolated nobody and cost about 12 bb.\n• After losing #5 you called three marginal spots in a row.',
    );
    expect(d.rules).toHaveLength(2);
  });
});

describe('runSummary', () => {
  const reply = (content: string, cost = 0.002) =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content } }],
        usage: { prompt_tokens: 400, completion_tokens: 120, cost },
      }),
    );
  const run = (f: unknown, locale = 'en') =>
    runSummary({
      apiKey: 'k',
      model: 'm',
      userMessage: 'session',
      locale,
      fetchImpl: f as typeof fetch,
    });

  it('returns the summary and usage from one call, and names the schema', async () => {
    const f = vi.fn(async (_url: string, init: RequestInit) => {
      expect(JSON.parse(init.body as string).response_format.json_schema.name).toBe(
        'session_summary',
      );
      return reply(JSON.stringify(valid));
    });
    const r = await run(f);
    expect(f).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ attempts: 1, tokensIn: 400, tokensOut: 120, costUsd: 0.002 });
    expect(r.summary.grade).toBe('C');
  });

  it('retries once on a wrong shape and adds both costs', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(reply(JSON.stringify({ ...valid, grade: 'Z' })))
      .mockResolvedValueOnce(reply(JSON.stringify(valid)));
    const r = await run(f);
    expect(f).toHaveBeenCalledTimes(2);
    expect(r).toMatchObject({ attempts: 2, tokensIn: 800, costUsd: 0.004 });
  });

  it('retries when the language is wrong, then gives up with the usage', async () => {
    const f = vi.fn(async () => reply(JSON.stringify(valid)));
    const err = await run(f, 'vi').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InvalidOutputError);
    expect(f).toHaveBeenCalledTimes(2);
    expect((err as InvalidOutputError).usage.tokensIn).toBe(800);
  });
});
