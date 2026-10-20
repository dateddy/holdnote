/**
 * Task 3.4: run candidate models on the reviewed hands of the old app and compare with the
 * reviews Đạt wrote. Real OpenRouter calls: costs money, so it has a hard budget.
 *
 *   pnpm bench:ai                      all models, all hands with an H/V line
 *   BENCH_LIMIT=3 pnpm bench:ai        smoke run
 *   BENCH_MODELS=a/b,c/d pnpm bench:ai other models
 *   BENCH_MAX_USD=2                    stop launching calls once this much is spent (default 2)
 *   BENCH_PROMPTS=v1-old,v1,v2         prompt configurations (default v1; v1-old = prompt and context
 *                                      of before task 3.5; v1/v2 = current context, DEC-053)
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
import {
  compareReviews,
  verdictErrors,
  evOfOld,
  groupRecall,
  inSplit,
  styleStats,
  summarize,
  type Comparison,
  type Row,
} from '../src/lib/ai/bench';
import { languagePack } from '../src/lib/ai/languages';
import { renderReviewContext, type ReviewFacts } from '../src/lib/ai/context';
import { OpenRouterError } from '../src/lib/ai/openrouter';
import { SYSTEM_PROMPT_V1_BASE, type PromptVersion } from '../src/lib/ai/prompt';
import { InvalidOutputError, runReview, type ReviewRun } from '../src/lib/ai/run-review';
import { toAiReviewRow } from '../src/lib/ai/schema';

/** `model@low|medium|high` sets the reasoning effort; default low (what the app uses). */
const DEFAULT_MODELS = [
  'openai/gpt-6-luna',
  'openai/gpt-6-luna@medium',
  'google/gemini-3.5-flash-lite',
];
const locale = process.env.BENCH_LOCALE ?? 'vi';

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
type Variant = { label: string; spec: string; prompt: string };
const PROMPT_CONFIGS = ['v1-old', 'v1', 'v2'];
const prompts = (process.env.BENCH_PROMPTS?.split(',').map((m) => m.trim()) ?? ['v1']).filter((p) =>
  PROMPT_CONFIGS.includes(p),
);
const variants: Variant[] = models.flatMap((spec) =>
  prompts.map((prompt) => ({ label: `${spec} [${prompt}]`, spec, prompt })),
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
  /** The context of before task 3.5 (no sizing notes), for the `v1-old` configuration. */
  contextOld: string;
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
    const facts: ReviewFacts = {
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
      locale,
    };
    items.push({
      id: h.id,
      num: h.num,
      line: h.line ?? '',
      heroCards: h.hero ?? '',
      // The same text the app sends. villName / villSeat (a real name) is never included.
      context: renderReviewContext(facts),
      contextOld: renderReviewContext({ ...facts, legacyContext: true }),
      old: { groups: h.rErr, ev: evOfOld(h.rEv), text: h },
    });
  }
  // BENCH_SPLIT=tune|test: tune the prompt on one half, measure on the other (default: all).
  const split = (process.env.BENCH_SPLIT as 'tune' | 'test' | undefined) ?? 'all';
  return inSplit(items, split).slice(0, limit);
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

async function runOne(item: Item, variant: Variant): Promise<Result> {
  const t0 = Date.now();
  const [model, effort] = variant.spec.split('@');
  const reasoningEffort = (effort as 'low' | 'medium' | 'high' | undefined) ?? 'low';
  const base = { hand: item.id, model: variant.label, tokensIn: 0, tokensOut: 0, costUsd: 0 };
  try {
    const run: ReviewRun = await runReview({
      apiKey: apiKey!,
      model,
      userMessage: variant.prompt === 'v1-old' ? item.contextOld : item.context,
      promptVersion: (variant.prompt === 'v1-old' ? 'v1' : variant.prompt) as PromptVersion,
      ...(variant.prompt === 'v1-old' && { system: SYSTEM_PROMPT_V1_BASE }),
      locale,
      reasoningEffort,
    });
    const row = toAiReviewRow(run.review, model, false, languagePack(locale).missingLabel);
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

const GROUPS = ['Sizing', 'Đọc sai range', 'Cảm xúc', 'Preflop', 'Không lỗi'];

const money = (n: number) => `$${n.toFixed(4)}`;
const labels = variants.map((v) => v.label);
const ratio = (x: { n: number; d: number }) => `${x.n}/${x.d}`;

/** Old EV and AI verdict of every run that produced a review. */
function verdicts(rows: Result[], oldEv: ReadonlyMap<string, string | null>) {
  return rows.flatMap((r) =>
    r.review ? [{ oldEv: oldEv.get(r.hand) ?? null, aiEv: r.review.ev_verdict ?? '' }] : [],
  );
}

function report(items: Item[], results: Result[], spent: number, stoppedEarly: boolean): string {
  const out: string[] = [];
  const oldEvById = new Map(items.map((i) => [i.id, i.old.ev]));
  out.push(
    `# Benchmark AI review (${locale}) — ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
  );
  out.push(
    '',
    `${items.length} hand, ${variants.length} cấu hình (model × prompt), chi ${money(spent)} (trần ${money(maxUsd)}).`,
  );
  if (stoppedEarly) out.push('', '**Dừng sớm vì chạm trần ngân sách.** Số liệu chưa đủ hand.');
  out.push(
    '',
    'So với review cũ của Đạt: nhóm lỗi cũ (Preflop/Sizing/Đọc sai range/Cảm xúc/Toán/Không lỗi). Mã AI không có trong nhóm cũ (missed_value, bad_bluff...) tính là "Khác" nên không bao giờ khớp.',
    '',
    '| Cấu hình | Chạy | JSON hợp lệ | Hợp lệ ngay lần 1 | Trùng đúng nhóm lỗi | Trùng ≥1 nhóm | Khớp có/không lỗi | Khớp EV | Báo sai nhầm (Đạt: Đúng) | Bỏ sót lỗi (Đạt: Sai) | $/hand | Giây/hand |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|',
  );
  for (const m of labels) {
    const rows: Row[] = results.filter((r) => r.model === m);
    const s = summarize(rows);
    const e = verdictErrors(
      verdicts(
        results.filter((r) => r.model === m),
        oldEvById,
      ),
    );
    out.push(
      `| ${m} | ${s.runs} | ${s.valid} | ${s.validFirstTry} | ${s.groupsExact} | ${s.groupsOverlap} | ${s.errorFlag} | ${s.ev} | ${ratio(e.falseMistake)} | ${ratio(e.missedMistake)} | ${money(s.costPerHand)} | ${s.seconds.toFixed(1)} |`,
    );
  }
  const testIds = new Set(inSplit(items, 'test').map((i) => i.id));
  out.push(
    '',
    `## Nửa test (${testIds.size} hand, cùng nửa với DEC-037)`,
    '',
    '| Cấu hình | Khớp EV | Báo sai nhầm (Đạt: Đúng) | Bỏ sót lỗi (Đạt: Sai) |',
    '|---|---|---|---|',
  );
  for (const m of labels) {
    const rows = results.filter((r) => r.model === m && testIds.has(r.hand));
    const s = summarize(rows);
    const e = verdictErrors(verdicts(rows, oldEvById));
    out.push(`| ${m} | ${s.ev} | ${ratio(e.falseMistake)} | ${ratio(e.missedMistake)} |`);
  }
  const oldById = new Map(items.map((i) => [i.id, i.old.groups]));
  out.push(
    '',
    '## Bắt được lỗi theo nhóm của Đạt (AI có nhóm đó / số hand Đạt gán nhóm đó)',
    '',
    `| Model | ${GROUPS.join(' | ')} | Chưa chắc | Hero/Villain mỗi review | Từ trong lesson | Lesson đánh số |`,
    `|---|${GROUPS.map(() => '---').join('|')}|---|---|---|---|`,
  );
  for (const m of labels) {
    const ok = results.filter((r) => r.model === m && r.review);
    const recall = groupRecall(
      ok.map((r) => ({ oldGroups: oldById.get(r.hand) ?? [], aiTags: r.review!.error_tags })),
    );
    const st = styleStats(
      ok.map((r) => ({
        texts: [r.review!.range_text, r.review!.math_text, r.review!.line_text, r.review!.lesson],
        lesson: r.review!.lesson,
        ev: r.review!.ev_verdict ?? '',
      })),
    );
    const cells = GROUPS.map((g) => `${recall[g]?.hit ?? 0}/${recall[g]?.n ?? 0}`);
    out.push(
      `| ${m} | ${cells.join(' | ')} | ${st.unsure} | ${st.heroVillainPerReview.toFixed(1)} | ${st.lessonWords.toFixed(0)} | ${st.numberedLessons} |`,
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
    for (const m of labels) {
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
    console.log(`bench: ${items.length} hands x ${labels.length}: ${labels.join(', ')}`);

    const results: Result[] = [];
    let spent = 0;
    let stoppedEarly = false;
    for (let i = 0; i < items.length; i += BATCH) {
      if (spent >= maxUsd) {
        stoppedEarly = true;
        break;
      }
      const batch = items.slice(i, i + BATCH);
      const done = await Promise.all(batch.flatMap((it) => variants.map((v) => runOne(it, v))));
      results.push(...done);
      spent += done.reduce((n, r) => n + r.costUsd, 0);
      console.log(
        `bench: ${Math.min(i + BATCH, items.length)}/${items.length} hands, spent ${money(spent)}`,
      );
    }

    const dir = `${LEGACY_DIR}bench/${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}/`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      `${dir}results.json`,
      JSON.stringify({ models, prompts, spent, results }, null, 2),
    );
    writeFileSync(`${dir}report.md`, report(items, results, spent, stoppedEarly));
    console.log(`bench: wrote ${dir}report.md`);
    expect(results.length).toBeGreaterThan(0);
  });
});
