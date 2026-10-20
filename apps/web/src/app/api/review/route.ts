import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildReviewContext } from '@/lib/ai/context';
import { languagePack, reviewInLanguage } from '@/lib/ai/languages';
import { budgetFromEnv, decideAccess, loadUsage } from '@/lib/ai/quota';
import { runReview } from '@/lib/ai/run-review';
import { toAiReviewRow } from '@/lib/ai/schema';
import { isFailure, modelFailure, resolveCredentials } from '@/lib/ai/server';
import { HAND_EDIT_COLUMNS, HAND_SESSION_COLUMNS } from '@/lib/hands/build';
import { REVIEW_COLUMNS } from '@/lib/review/review';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const bodySchema = z.object({
  hand_id: z.uuid(),
  /** The student's reason for disputing the current review. Counts as one more use. */
  rebuttal: z.string().trim().min(3).max(600).optional(),
});

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/**
 * POST /api/review: one AI review of one hand (spec 5.1).
 * Errors come back as `{ error: <code> }`; the screen turns codes into messages.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return fail('unauthorized', 401);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('bad_request', 400);
  const { hand_id: handId, rebuttal } = parsed.data;

  // Reads go through the user's own client, so RLS decides what exists.
  const { data: hand } = await supabase
    .from('hands')
    .select(`${HAND_EDIT_COLUMNS}, players_left, updated_at`)
    .eq('id', handId)
    .maybeSingle();
  if (!hand) return fail('not_found', 404);

  const [{ data: session }, { data: current }, { data: profile }, { data: leaks }] =
    await Promise.all([
      supabase
        .from('sessions')
        .select(`${HAND_SESSION_COLUMNS}, stake_label`)
        .eq('id', hand.session_id)
        .maybeSingle(),
      supabase
        .from('reviews')
        .select(`${REVIEW_COLUMNS}, created_at`)
        .eq('hand_id', handId)
        .eq('is_current', true)
        .maybeSingle(),
      supabase.from('profiles').select('locale').maybeSingle(),
      supabase.from('leak_stats').select('tag, hand_count').eq('source', 'review'),
    ]);
  if (!session) return fail('not_found', 404);
  if (rebuttal && !current) return fail('nothing_to_rebut', 400);

  const admin = createAdminClient();
  const usage = await loadUsage(admin, userId);

  // Unchanged hand, AI review already current: hand it back, no model call, no charge (spec 5.5).
  // It must also be in the language the profile uses now: after a language change, review again.
  const locale = profile?.locale ?? 'vi';
  if (
    !rebuttal &&
    current?.source === 'ai' &&
    current.created_at > hand.updated_at &&
    reviewInLanguage(current, locale)
  ) {
    const access = decideAccess({ ...usage, budgetUsd: budgetFromEnv() });
    const remaining = access.ok ? access.remaining : 0;
    return NextResponse.json({ review: current, remaining, cached: true });
  }

  const access = decideAccess({ ...usage, budgetUsd: budgetFromEnv() });
  if (!access.ok) return fail(access.code, access.code === 'rate_limited' ? 429 : 402);

  const creds = await resolveCredentials(admin, userId, usage);
  if (isFailure(creds)) return fail(creds.code, creds.status);
  const { apiKey, model } = creds;

  const counts = new Map<string, number>();
  for (const l of leaks ?? []) {
    if (l.tag) counts.set(l.tag, (counts.get(l.tag) ?? 0) + (l.hand_count ?? 0));
  }
  const topLeaks = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag]) => tag);

  // The main opponent and every other one picked on the hand: type and notes only, never names.
  const picked = Array.isArray(hand.opponents) ? hand.opponents : [];
  const ids = [
    ...new Set(
      [hand.opponent_id, ...picked.map((o) => (o as { opponent_id?: string }).opponent_id)].filter(
        (id): id is string => typeof id === 'string' && id !== '',
      ),
    ),
  ];
  const opponentInfo: Record<string, { player_type: string | null; notes: string | null }> = {};
  let opponent = null;
  if (ids.length > 0) {
    const { data } = await supabase
      .from('opponents')
      .select('id, name, player_type, notes')
      .in('id', ids);
    for (const o of data ?? []) {
      opponentInfo[o.id] = { player_type: o.player_type, notes: o.notes };
      if (o.id === hand.opponent_id) opponent = o;
    }
  }

  const userMessage = buildReviewContext({
    session,
    hand,
    opponent,
    opponentInfo,
    topLeaks,
    locale,
    rebuttal: rebuttal && current ? { reason: rebuttal, previous: current } : null,
  });

  let run;
  try {
    run = await runReview({ apiKey, model, userMessage, locale });
  } catch (e) {
    const failure = modelFailure(e, usage.hasOwnKey);
    return fail(failure.code, failure.status);
  }

  const row = toAiReviewRow(
    run.review,
    model,
    session.kind === 'mtt',
    languagePack(locale).missingLabel,
    run.promptVersion,
  );
  const { data: reviewId, error: saveError } = await supabase.rpc('replace_current_review', {
    p_hand_id: handId,
    p_review: row,
  });
  if (saveError || !reviewId) return fail('save_failed', 500);

  const { error: usageError } = await admin.from('ai_usage').insert({
    user_id: userId,
    kind: rebuttal ? 'rebuttal' : 'hand_review',
    model,
    tokens_in: run.tokensIn,
    tokens_out: run.tokensOut,
    cost_usd: run.costUsd,
    billed_to: access.billedTo,
  });
  if (usageError) console.error('ai_usage insert failed', usageError.message);

  return NextResponse.json({
    review: {
      id: reviewId,
      source: 'ai',
      prompt_version: row.prompt_version,
      range_text: row.range_text,
      math_text: row.math_text,
      line_text: row.line_text,
      icm_text: row.icm_text,
      error_tags: row.error_tags,
      ev_verdict: row.ev_verdict,
      lesson: row.lesson,
      accepted: false,
    },
    remaining: access.remaining,
    cached: false,
    key_mistake_street: run.review.key_mistake_street,
    repeats_known_leak: run.review.repeats_known_leak,
  });
}
