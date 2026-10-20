import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { OpenRouterError } from './openrouter';
import { loadUsage } from './quota';
import { InvalidOutputError, runJson } from './run-json';
import { failedUsageRow, spentOn } from './server';

const reply = (content: string, cost: number) =>
  new Response(
    JSON.stringify({
      choices: [{ finish_reason: 'stop', message: { content } }],
      usage: { prompt_tokens: 100, completion_tokens: 50, cost },
    }),
    { status: 200 },
  );

const run = (fetchImpl: typeof fetch) =>
  runJson({
    apiKey: 'k',
    model: 'm',
    system: 's',
    userMessage: 'u',
    schema: {},
    schemaName: 'x',
    parse: (c) => (c === 'good' ? { ok: true, value: c } : { ok: false, error: 'bad' }),
    fetchImpl,
  });

describe('spentOn', () => {
  it('invalid output: cost of both calls', () => {
    const e = new InvalidOutputError('x', { tokensIn: 200, tokensOut: 90, costUsd: 0.02 });
    expect(spentOn(e)).toEqual({ tokensIn: 200, tokensOut: 90, costUsd: 0.02 });
  });

  it('empty reply: what it still cost', () => {
    const e = new OpenRouterError('empty', 'no content', {
      finishReason: 'length',
      tokensIn: 10,
      tokensOut: 4000,
      costUsd: 0.05,
    });
    expect(spentOn(e)).toEqual({ tokensIn: 10, tokensOut: 4000, costUsd: 0.05 });
  });

  it('timeout, auth, rate, upstream: nothing known to be spent', () => {
    for (const kind of ['timeout', 'auth', 'rate', 'upstream'] as const) {
      expect(spentOn(new OpenRouterError(kind, 'x'))).toEqual({
        tokensIn: 0,
        tokensOut: 0,
        costUsd: 0,
      });
    }
  });

  it('second call fails after a paid first call: the first call is still counted', async () => {
    let n = 0;
    const fetchImpl = (async () => {
      n += 1;
      if (n === 1) return reply('nope', 0.01);
      return new Response('', { status: 502 });
    }) as typeof fetch;
    const e = await run(fetchImpl).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(OpenRouterError);
    expect(spentOn(e)).toEqual({ tokensIn: 100, tokensOut: 50, costUsd: 0.01 });
  });

  it('second call empty: both are counted', async () => {
    let n = 0;
    const fetchImpl = (async () => {
      n += 1;
      if (n === 1) return reply('nope', 0.01);
      return new Response(
        JSON.stringify({
          choices: [{ finish_reason: 'length', message: { content: '' } }],
          usage: { prompt_tokens: 300, completion_tokens: 4000, cost: 0.04 },
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    const e = await run(fetchImpl).catch((x: unknown) => x);
    const spent = spentOn(e);
    expect(spent.costUsd).toBeCloseTo(0.05, 6);
    expect(spent.tokensIn).toBe(400);
    expect(spent.tokensOut).toBe(4050);
  });
});

describe('failedUsageRow', () => {
  it('is marked failed and keeps who pays', () => {
    const row = failedUsageRow({
      userId: 'u1',
      kind: 'hand_review',
      model: 'm',
      billedTo: 'app',
      spent: { tokensIn: 5, tokensOut: 6, costUsd: 0.03 },
    });
    expect(row).toEqual({
      user_id: 'u1',
      kind: 'hand_review',
      model: 'm',
      tokens_in: 5,
      tokens_out: 6,
      cost_usd: 0.03,
      billed_to: 'app',
      failed: true,
    });
  });
});

/** Minimal admin client: filters are recorded, so the test can tell which rows a query counts. */
function fakeAdmin(rows: { kind: string; billed_to: string; failed: boolean; cost: number }[]) {
  const from = (table: string) => {
    const filters: Record<string, unknown> = {};
    let kinds: string[] | null = null;
    const q: Record<string, unknown> = {
      select: () => q,
      eq: (col: string, v: unknown) => {
        filters[col] = v;
        return q;
      },
      in: (_c: string, v: string[]) => {
        kinds = v;
        return q;
      },
      gte: () => q,
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      then: (resolve: (v: unknown) => void) => {
        if (table !== 'ai_usage') return resolve({ data: null, error: null });
        const n = rows.filter(
          (r) =>
            (filters.billed_to === undefined || r.billed_to === filters.billed_to) &&
            (filters.failed === undefined || r.failed === filters.failed) &&
            (kinds === null || kinds.includes(r.kind)),
        ).length;
        return resolve({ count: n, error: null });
      },
    };
    return q;
  };
  const rpc = () =>
    Promise.resolve({
      data: rows.filter((r) => r.billed_to === 'app').reduce((s, r) => s + r.cost, 0),
      error: null,
    });
  return { from, rpc } as unknown as SupabaseClient<Database>;
}

describe('loadUsage with failed calls', () => {
  const rows = [
    { kind: 'hand_review', billed_to: 'app', failed: false, cost: 0.01 },
    { kind: 'hand_review', billed_to: 'app', failed: true, cost: 0.05 },
    { kind: 'session_summary', billed_to: 'app', failed: true, cost: 0.02 },
    { kind: 'hand_review', billed_to: 'user', failed: true, cost: 0.5 },
  ];

  it('failed calls do not use up allowances or the hourly guard', async () => {
    const u = await loadUsage(fakeAdmin(rows), 'u1');
    expect(u.monthCalls).toBe(1);
    expect(u.summaryCalls).toBe(0);
    expect(u.lastHourCalls).toBe(0);
  });

  it('failed calls still count toward the app budget', async () => {
    const u = await loadUsage(fakeAdmin(rows), 'u1');
    expect(u.appSpendUsd).toBeCloseTo(0.08, 6);
  });
});
