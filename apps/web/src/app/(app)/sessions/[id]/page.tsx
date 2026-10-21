import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { HandReview } from '@/components/replay/review-panel';
import { SessionDetail } from '@/components/session/session-detail';
import { SyncStatus } from '@/components/hand/sync-status';
import {
  buildHandRows,
  HAND_ROW_COLUMNS,
  parseHandFilter,
  type HandReviewInfo,
  type HandRowDb,
} from '@/lib/hands/session-hands';
import { detailTiles, sessionStage } from '@/lib/sessions/detail';
import { formatDay } from '@/lib/sessions/format';
import { readMtt } from '@/lib/sessions/form';
import { readSummary, STATS_COLUMNS, toStatsSession } from '@/lib/sessions/summary';
import { loadUsage } from '@/lib/ai/quota';
import { aiStatus } from '@/lib/ai/status';
import { REVIEW_COLUMNS } from '@/lib/review/review';
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
    .select(HAND_ROW_COLUMNS)
    .eq('session_id', id)
    .order('num', { ascending: false });
  const ids = (hands ?? []).map((h) => h.id);
  const { data: reviews } = ids.length
    ? await supabase
        .from('reviews')
        .select(`hand_id, ${REVIEW_COLUMNS}`)
        .eq('is_current', true)
        .in('hand_id', ids)
    : { data: [] };

  const reviewOf = new Map<string, HandReviewInfo>(
    (reviews ?? []).map((r) => [r.hand_id, { source: r.source, accepted: r.accepted }]),
  );
  const reviewRows: Record<string, HandReview> = Object.fromEntries(
    (reviews ?? []).map((r) => [r.hand_id, r as unknown as HandReview]),
  );
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
    row.end_at ? null : t('playing'),
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
