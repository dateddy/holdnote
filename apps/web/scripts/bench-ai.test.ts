/**
 * Task 3.4: run candidate models on the reviewed hands of the old app and compare with the
 * reviews Đạt wrote. Real OpenRouter calls: costs money, so it has a hard budget.
 *
 *   pnpm bench:ai                      all models, all hands with an H/V line
 *   BENCH_LIMIT=3 pnpm bench:ai        smoke run
 *   BENCH_MODELS=a/b,c/d pnpm bench:ai other models
 *   BENCH_MAX_USD=2                    stop launching calls once this much is spent (default 2)
 *
 * Output goes to legacy/data/bench/<time>/ (gitignored: it holds real hands).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { computeEff } from 'poker-core';
import { describe, expect, it } from 'vitest';
import {
  hasHeroVillainLine,
  hasLegacyData,
  LEGACY_DIR,
  loadLegacy,
  pos,
  toCase,
  type LegacyHand,
} from '../../../packages/poker-core/test/legacy/loader';
import { compareReviews, evOfOld, summarize, type Comparison, type Row } from '../src/lib/ai/bench';
import { renderReviewContext } from '../src/lib/ai/context';
import { OpenRouterError } from '../src/lib/ai/openrouter';
import { InvalidOutputError, runReview, type ReviewRun } from '../src/lib/ai/run-review';
import { toAiReviewRow } from '../src/lib/ai/schema';

const DEFAULT_MODELS = [
  'openai/gpt-6-luna',
  'qwen/qwen3.8-flash',
  'deepseek/deepseek-v4-pro',
  'google/gemini-3.5-flash-lite',
];

/** Fields of the old JSON beyond what the shared loader types. */
type Old = LegacyHand & {
  num?: number;
  hero?: string;
  villCards?: string;
  villType?: string;
  villRead?: string;
  thought?: string;
  question?: string;
  stage?: string;
  left?: string;
  level?: string;
  rErr?: string[];
  rEv?: string;
  rRange?: string;
  rMath?: string;
  rSolver?: string;
  rLesson?: string;
};

type OldSession = { kind?: string; mode?: string; stake?: string; seats?: string };

const cards = (s: string | undefined) => s?.match(/[2-9TJQKA][shdc?]/g) ?? [];

const apiKey = process.env.OPENROUTER_API_KEY;
const models = (process.env.BENCH_MODELS?.split(',').map((m) => m.trim()) ?? DEFAULT_MODELS).filter(
  Boolean,
);
const limit = Number(process.env.BENCH_LIMIT) || Infinity;
const maxUsd = Number(process.env.BENCH_MAX_USD) || 2;
const BATCH = 3; // hands in flight at once (x models requests each)

type Item = {
  id: string;
  num: number | undefined;
  line: string;
  heroCards: string;
  context: string;
  old: { groups: string[]; ev: string | null; text: Old };
};

function prepare(): Item[] {
  const { hands, sessions } = loadLegacy();
  const items: Item[] = [];
  for (const h of hands as Old[]) {
    if (!hasHeroVillainLine(h.line) || !h.rErr?.length) continue;
    const session = sessions.get(h.sessionId) as (OldSession & { id: string }) | undefined;
    let c;
    try {
      c = toCase(h, session);
    } catch {
      continue; // no blinds: nothing to compute
    }
    const isMtt = !!h.mtt || session?.kind === 'mtt';
    const villType = h.villType && h.villType !== 'Chưa rõ' ? h.villType : null;
    const dealt = c.input.playersDealt ?? (Number(h.tableSize) || null);
    items.push({
      id: h.id,
      num: h.num,
      line: h.line ?? '',
      heroCards: h.hero ?? '',
      // The same text the app sends. villName / villSeat (a real name) is never included.
      context: renderReviewContext({
        kind: isMtt ? 'mtt' : 'cash',
        mode: session?.mode ?? 'online',
        stakeLabel: isMtt ? null : session?.stake,
        seats: Number(session?.seats) || null,
        playersDealt: dealt,
        stage: h.stage || null,
        playersLeft: Number(h.left) || null,
        heroCards: cards(h.hero),
        heroPos: pos(h.heroPos),
        villPos: pos(h.villPos),
        villCards: cards(h.villCards),
        board: cards(`${h.flop ?? ''}${h.turn ?? ''}${h.river ?? ''}`),
        input: c.input,
        bb: c.bb,
        eff: computeEff(c.input.heroStack, c.input.villStack, c.bb),
        opponent:
          villType || h.villRead ? { player_type: villType, notes: h.villRead ?? null } : null,
        thought: [h.thought, h.question].filter(Boolean).join(' / ') || null,
        topLeaks: [],
        locale: 'vi',
      }),
      old: { groups: h.rErr, ev: evOfOld(h.rEv), text: h },
    });
  }
  return items.slice(0, limit);
}

type Result = {
  hand: string;
  model: string;
  ok: boolean;
  error?: string;
  attempts: number | null;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  ms: number;
  review: ReturnType<typeof toAiReviewRow> | null;
  cmp: Comparison | null;
};

async function runOne(item: Item, model: string): Promise<Result> {
  const t0 = Date.now();
  const base = { hand: item.id, model, tokensIn: 0, tokensOut: 0, costUsd: 0 };
  try {
    const run: ReviewRun = await runReview({ apiKey: apiKey!, model, userMessage: item.context });
    const row = toAiReviewRow(run.review, model, false);
    return {
      ...base,
      ok: true,
      attempts: run.attempts,
      tokensIn: run.tokensIn,
      tokensOut: run.tokensOut,
      costUsd: run.costUsd,
      ms: Date.now() - t0,
      review: row,
      cmp: compareReviews(item.old, { tags: row.error_tags, ev: run.review.ev_verdict }),
    };
  } catch (e) {
    const usage =
      e instanceof InvalidOutputError
        ? e.usage
        : e instanceof OpenRouterError
          ? (e.detail ?? null)
          : null;
    return {
      ...base,
      ...(usage ?? {}),
      ok: false,
      error:
        e instanceof InvalidOutputError
          ? 'invalid_output'
          : e instanceof OpenRouterError
            ? `${e.kind}: ${e.message}${e.detail?.finishReason ? ` (${e.detail.finishReason})` : ''}`
            : 'error',
      attempts: null,
      ms: Date.now() - t0,
      review: null,
      cmp: null,
    };
  }
}

const money = (n: number) => `$${n.toFixed(4)}`;

function report(items: Item[], results: Result[], spent: number, stoppedEarly: boolean): string {
  const out: string[] = [];
  out.push(`# Benchmark AI review — ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`);
  out.push(
    '',
    `${items.length} hand, ${models.length} model, chi ${money(spent)} (trần ${money(maxUsd)}).`,
  );
  if (stoppedEarly) out.push('', '**Dừng sớm vì chạm trần ngân sách.** Số liệu chưa đủ hand.');
  out.push(
    '',
    'So với review cũ của Đạt: nhóm lỗi cũ (Preflop/Sizing/Đọc sai range/Cảm xúc/Toán/Không lỗi). Mã AI không có trong nhóm cũ (missed_value, bad_bluff...) tính là "Khác" nên không bao giờ khớp.',
    '',
    '| Model | Chạy | JSON hợp lệ | Hợp lệ ngay lần 1 | Trùng đúng nhóm lỗi | Trùng ≥1 nhóm | Khớp có/không lỗi | Khớp EV | $/hand | Giây/hand |',
    '|---|---|---|---|---|---|---|---|---|---|',
  );
  for (const m of models) {
    const rows: Row[] = results.filter((r) => r.model === m);
    const s = summarize(rows);
    out.push(
      `| ${m} | ${s.runs} | ${s.valid} | ${s.validFirstTry} | ${s.groupsExact} | ${s.groupsOverlap} | ${s.errorFlag} | ${s.ev} | ${money(s.costPerHand)} | ${s.seconds.toFixed(1)} |`,
    );
  }
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    const byKind = new Map<string, number>();
    for (const f of failed)
      byKind.set(`${f.model}: ${f.error}`, (byKind.get(`${f.model}: ${f.error}`) ?? 0) + 1);
    out.push('', '## Lỗi', ...[...byKind].map(([k, n]) => `- ${k} × ${n}`));
  }

  const step = Math.max(1, Math.floor(items.length / 10));
  const sample = items.filter((_, i) => i % step === 0).slice(0, 10);
  out.push('', '## 10 hand mẫu (đọc để chấm bám ngữ cảnh và tiếng Việt)');
  for (const it of sample) {
    const o = it.old.text;
    out.push('', `### Hand ${it.num ?? it.id}: ${it.heroCards}`, '', `Line: \`${it.line}\``, '');
    out.push(`**Đạt** — lỗi: ${o.rErr?.join(', ')} · EV: ${o.rEv}`);
    for (const [k, v] of [
      ['Range', o.rRange],
      ['Toán', o.rMath],
      ['Line', o.rSolver],
      ['Bài học', o.rLesson],
    ]) {
      if (v) out.push(`- ${k}: ${v}`);
    }
    for (const m of models) {
      const r = results.find((x) => x.hand === it.id && x.model === m);
      out.push('', `**${m}**`);
      if (!r) out.push('- (không chạy)');
      else if (!r.review) out.push(`- LỖI: ${r.error}`);
      else {
        out.push(`- Lỗi: ${r.review.error_tags.join(', ') || '-'} · EV: ${r.review.ev_verdict}`);
        for (const [k, v] of [
          ['Range', r.review.range_text],
          ['Toán', r.review.math_text],
          ['Line', r.review.line_text],
          ['Bài học', r.review.lesson],
        ]) {
          if (v) out.push(`- ${k}: ${v}`);
        }
      }
    }
  }
  return out.join('\n') + '\n';
}

describe.skipIf(!apiKey || !hasLegacyData)('AI model benchmark', () => {
  it('runs the candidates on the old reviewed hands', async () => {
    const items = prepare();
    expect(items.length).toBeGreaterThan(0);
    console.log(`bench: ${items.length} hands x ${models.length} models: ${models.join(', ')}`);

    const results: Result[] = [];
    let spent = 0;
    let stoppedEarly = false;
    for (let i = 0; i < items.length; i += BATCH) {
      if (spent >= maxUsd) {
        stoppedEarly = true;
        break;
      }
      const batch = items.slice(i, i + BATCH);
      const done = await Promise.all(batch.flatMap((it) => models.map((m) => runOne(it, m))));
      results.push(...done);
      spent += done.reduce((n, r) => n + r.costUsd, 0);
      console.log(
        `bench: ${Math.min(i + BATCH, items.length)}/${items.length} hands, spent ${money(spent)}`,
      );
    }

    const dir = `${LEGACY_DIR}bench/${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}/`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}results.json`, JSON.stringify({ models, spent, results }, null, 2));
    writeFileSync(`${dir}report.md`, report(items, results, spent, stoppedEarly));
    console.log(`bench: wrote ${dir}report.md`);
    expect(results.length).toBeGreaterThan(0);
  });
});
