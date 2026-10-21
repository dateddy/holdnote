import { getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { HandReview, HandReviews } from '@/components/replay/review-panel';
import { SessionDetail } from '@/components/session/session-detail';
import { SyncStatus } from '@/components/hand/sync-status';
import {
  buildHandRows,
  HAND_ROW_COLUMNS,
  parseHandFilter,
  type HandRowDb,
} from '@/lib/hands/session-hands';
import { detailTiles, sessionStage } from '@/lib/sessions/detail';
import { formatDay } from '@/lib/sessions/format';
import { readMtt } from '@/lib/sessions/form';
import { readSummary, STATS_COLUMNS, toStatsSession } from '@/lib/sessions/summary';
import { loadUsage } from '@/lib/ai/quota';
import { aiStatus } from '@/lib/ai/status';
import { aiReviewState, REBUTTAL_COLUMNS, type RebuttalRow } from '@/lib/review/ai-state';
import { REVIEW_COLUMNS, reviewInfoByHand, reviewsByHand } from '@/lib/review/review';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/** One session: tiles, the next step for its stage, and its hands with filters (spec 3.6). */
export default async function SessionPage({ params, searchParams }: PageProps<'/sessions/[id]'>) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const { data: row } = await supabase
    .from('sessions')
    .select(`${STATS_COLUMNS}, summary, sb, straddle, ante_mode, ante, seats`)
    .eq('id', id)
    .maybeSingle();
  if (!row) notFound();

  const { data: hands } = await supabase
    .from('hands')
    .select(`${HAND_ROW_COLUMNS}, updated_at`)
    .eq('session_id', id)
    .order('num', { ascending: false });
  const ids = (hands ?? []).map((h) => h.id);
  const [{ data: reviews }, { data: rebuttals }, locale] = await Promise.all([
    ids.length
      ? supabase
          .from('reviews')
          .select(`hand_id, ${REVIEW_COLUMNS}, created_at`)
          .eq('is_current', true)
          .in('hand_id', ids)
      : { data: [] },
    ids.length
      ? supabase.from('review_rebuttals').select(`hand_id, ${REBUTTAL_COLUMNS}`).in('hand_id', ids)
      : { data: [] },
    getLocale(),
  ]);

  // A hand can have an AI review and its own review at the same time (DEC-064).
  const reviewOf = reviewInfoByHand(reviews ?? []);
  const byHand = reviewsByHand(
    (reviews ?? []) as unknown as (HandReview & { hand_id: string; created_at: string })[],
  );
  const rebuttalRows = (rebuttals ?? []) as (RebuttalRow & { hand_id: string })[];
  const reviewRows: Record<string, HandReviews> = {};
  for (const h of hands ?? []) {
    const r = byHand[h.id] ?? { ai: null, manual: null };
    reviewRows[h.id] = {
      ...r,
      ...aiReviewState(
        r.ai,
        rebuttalRows.filter((x) => x.hand_id === h.id),
        h.updated_at,
        locale,
      ),
    };
  }
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  const status = userId ? aiStatus(await loadUsage(createAdminClient(), userId)) : null;
  const handParam = Array.isArray(query.hand) ? query.hand[0] : query.hand;
  const session = toStatsSession(row);
  const rows = buildHandRows(row, (hands ?? []) as unknown as HandRowDb[], reviewOf);

  const [t, tSessions] = await Promise.all([
    getTranslations('sessionList'),
    getTranslations('sessions'),
  ]);
  const mtt = readMtt(row.mtt);
  const title = mtt?.name ?? session.venue ?? tSessions(session.kind);
  const subtitle = [
    formatDay(session.date, true),
    session.kind === 'cash'
      ? session.stakeLabel
      : [tSessions('mtt'), mtt?.name ? session.venue : null].filter(Boolean).join(' · '),
    row.end_at ? null : t('notEnded'),
    t('hands', { n: rows.length }),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <SessionDetail
        session={{
          id,
          kind: session.kind,
          title,
          subtitle,
          currency: session.currency,
          ...(session.chipRate && { chipRate: session.chipRate }),
        }}
        stage={sessionStage(session, readSummary(row.summary))}
        tiles={detailTiles(session, rows, new Date().toISOString())}
        rows={rows}
        initialFilter={parseHandFilter(query)}
        initialHandId={handParam && rows.some((r) => r.id === handParam) ? handParam : null}
        reviews={reviewRows}
        ai={{
          plan: status?.plan ?? 'free',
          remaining: status?.remaining ?? null,
          locked: status?.budgetLocked ?? false,
        }}
      />
      <div className="mx-auto w-full max-w-md px-6 pb-6 lg:max-w-none">
        <SyncStatus />
      </div>
    </>
  );
}
