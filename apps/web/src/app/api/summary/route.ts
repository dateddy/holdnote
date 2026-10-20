import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildSummaryContext } from '@/lib/ai/summary-context';
import { budgetFromEnv, decideAccess, loadUsage, SUMMARY_MONTHLY_LIMIT } from '@/lib/ai/quota';
import { runSummary } from '@/lib/ai/run-summary';
import {
  failedUsageRow,
  isFailure,
  modelFailure,
  resolveCredentials,
  spentOn,
} from '@/lib/ai/server';
import { toSummaryDraft } from '@/lib/ai/summary-schema';
import { applyFormToStats, STATS_COLUMNS, toStatsSession } from '@/lib/sessions/summary';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/** What the form holds right now, before it is saved: the result and state the AI should see. */
const bodySchema = z.object({
  session_id: z.uuid(),
  cashout: z.string().max(40).optional(),
  selfState: z.string().max(20).optional(),
  prize: z.string().max(40).optional(),
  bounty: z.string().max(40).optional(),
  place: z.string().max(10).optional(),
  entries: z.string().max(10).optional(),
  reentries: z.string().max(10).optional(),
  bustStage: z.string().max(20).optional(),
});

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/**
 * POST /api/summary: one AI draft of a session debrief (spec 5.6). Nothing is saved here: the
 * player edits the draft and saves it with the summary form. Errors come back as `{ error: <code> }`.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return fail('unauthorized', 401);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('bad_request', 400);
  const body = parsed.data;

  const { data: row } = await supabase
    .from('sessions')
    .select(STATS_COLUMNS)
    .eq('id', body.session_id)
    .maybeSingle();
  if (!row) return fail('not_found', 404);

  const [{ data: hands }, { data: profile }] = await Promise.all([
    supabase.from('hands').select('id, num').eq('session_id', body.session_id),
    supabase.from('profiles').select('locale').maybeSingle(),
  ]);
  if (!hands?.length) return fail('nothing_to_summarize', 400);

  const { data: reviews } = await supabase
    .from('reviews')
    .select('hand_id, error_tags, ev_verdict, lesson')
    .eq('is_current', true)
    .in(
      'hand_id',
      hands.map((h) => h.id),
    );
  const numOf = new Map(hands.map((h) => [h.id, h.num]));

  const admin = createAdminClient();
  const usage = await loadUsage(admin, userId);
  const access = decideAccess({
    ...usage,
    monthCalls: usage.summaryCalls,
    monthLimit: SUMMARY_MONTHLY_LIMIT,
    budgetUsd: budgetFromEnv(),
  });
  if (!access.ok) return fail(access.code, access.code === 'rate_limited' ? 429 : 402);

  const creds = await resolveCredentials(admin, userId, usage);
  if (isFailure(creds)) return fail(creds.code, creds.status);

  // The session as the form shows it now: unsaved result and state override the stored ones.
  const stored = toStatsSession(row);
  // Not ended yet: the summary is written as the session ends.
  const session = applyFormToStats(
    { ...stored, endAt: stored.endAt ?? new Date().toISOString() },
    body,
  );

  const locale = profile?.locale ?? 'vi';
  const userMessage = buildSummaryContext({
    session,
    handCount: hands.length,
    reviews: (reviews ?? [])
      .map((r) => ({
        num: numOf.get(r.hand_id) ?? 0,
        verdict: r.ev_verdict,
        tags: r.error_tags,
        lesson: r.lesson,
      }))
      .sort((a, b) => a.num - b.num),
    locale,
  });

  let run;
  try {
    run = await runSummary({ apiKey: creds.apiKey, model: creds.model, userMessage, locale });
  } catch (e) {
    const failure = modelFailure(e, usage.hasOwnKey);
    const { error: failedError } = await admin.from('ai_usage').insert(
      failedUsageRow({
        userId,
        kind: 'session_summary',
        model: creds.model,
        billedTo: access.billedTo,
        spent: spentOn(e),
      }),
    );
    if (failedError) console.error('ai_usage insert failed', failedError.message);
    return fail(failure.code, failure.status);
  }

  const { error: usageError } = await admin.from('ai_usage').insert({
    user_id: userId,
    kind: 'session_summary',
    model: creds.model,
    tokens_in: run.tokensIn,
    tokens_out: run.tokensOut,
    cost_usd: run.costUsd,
    billed_to: access.billedTo,
  });
  if (usageError) console.error('ai_usage insert failed', usageError.message);

  return NextResponse.json({ draft: toSummaryDraft(run.summary), remaining: access.remaining });
}
