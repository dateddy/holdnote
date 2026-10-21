import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Replayer } from '@/components/replay/replayer';
import { ReviewPanel, type HandReview } from '@/components/replay/review-panel';
import { TopBar } from '@/components/ui/top-bar';
import { loadUsage } from '@/lib/ai/quota';
import { aiStatus } from '@/lib/ai/status';
import { HAND_SESSION_COLUMNS } from '@/lib/hands/build';
import {
  buildHandRows,
  HAND_ROW_COLUMNS,
  parseHandFilter,
  serializeHandFilter,
  type HandRowDb,
} from '@/lib/hands/session-hands';
import { REVIEW_COLUMNS } from '@/lib/review/review';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/** One hand: the replayer, then the second opinion (review). Editing the hand is its own screen. */
export default async function HandDetailPage({ params, searchParams }: PageProps<'/hands/[id]'>) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  // The filter of the session page the player came from, so Back returns to the same list.
  const backQuery = serializeHandFilter(parseHandFilter(query));
  const supabase = await createClient();

  const { data: hand } = await supabase
    .from('hands')
    .select(HAND_ROW_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (!hand) notFound();

  const { data: session } = await supabase
    .from('sessions')
    .select(`${HAND_SESSION_COLUMNS}, currency`)
    .eq('id', hand.session_id)
    .maybeSingle();
  if (!session) notFound();

  const [{ data: review }, t] = await Promise.all([
    supabase
      .from('reviews')
      .select(REVIEW_COLUMNS)
      .eq('hand_id', id)
      .eq('is_current', true)
      .maybeSingle(),
    getTranslations('hand'),
  ]);

  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  const status = userId ? aiStatus(await loadUsage(createAdminClient(), userId)) : null;

  const [row] = buildHandRows(
    session,
    [hand as unknown as HandRowDb],
    new Map(review ? [[id, { source: review.source, accepted: review.accepted }]] : []),
  );
  if (!row) notFound();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 p-6 lg:max-w-3xl">
      <TopBar
        title={t('detailTitle', { num: hand.num })}
        back={{
          href: `/sessions/${hand.session_id}${backQuery ? `?${backQuery}` : ''}`,
          label: t('backToSession'),
        }}
      />

      {row.replay ? (
        <Replayer
          hand={row.replay}
          meta={{
            id,
            num: row.num,
            thought: row.thought,
            needsReview: row.needsReview,
            aiReviewed: row.aiReviewed,
            missing: row.missing,
          }}
          currency={session.currency}
          showNum={false}
        />
      ) : null}

      <ReviewPanel
        handId={id}
        review={(review as HandReview | null) ?? null}
        hand={row.replay}
        isMtt={session.kind === 'mtt'}
        ai={{
          plan: status?.plan ?? 'free',
          remaining: status?.remaining ?? null,
          locked: status?.budgetLocked ?? false,
        }}
      />
    </main>
  );
}
