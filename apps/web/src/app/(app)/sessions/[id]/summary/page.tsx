import { getTranslations } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { SummaryForm } from '@/components/session/summary-form';
import { TopBar } from '@/components/ui/top-bar';
import { loadUsage } from '@/lib/ai/quota';
import { aiStatus } from '@/lib/ai/status';
import { STATS_COLUMNS, summaryFormFrom, toStatsSession } from '@/lib/sessions/summary';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export default async function SessionSummaryPage({ params }: PageProps<'/sessions/[id]/summary'>) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;

  const { data: row } = await supabase
    .from('sessions')
    .select(`${STATS_COLUMNS}, summary`)
    .eq('id', id)
    .maybeSingle();
  if (!row) notFound();
  // The debrief comes after the session is ended (DEC-044).
  if (!row.end_at) redirect(`/sessions/${id}/end`);

  const [{ data: hands }, { data: leaks }] = await Promise.all([
    supabase.from('hands').select('id').eq('session_id', id),
    supabase
      .from('leak_stats')
      .select('tag, hand_count')
      .eq('session_id', id)
      .eq('source', 'review'),
  ]);
  const ids = (hands ?? []).map((h) => h.id);
  const { data: reviews } = ids.length
    ? await supabase.from('reviews').select('hand_id').eq('is_current', true).in('hand_id', ids)
    : { data: [] };

  const leakHints: Record<string, number> = {};
  for (const l of leaks ?? []) if (l.tag) leakHints[l.tag] = l.hand_count ?? 0;

  const status = userId ? aiStatus(await loadUsage(createAdminClient(), userId)) : null;
  const [t, tSessions] = await Promise.all([
    getTranslations('summary'),
    getTranslations('sessions'),
  ]);

  // Open session: the form shows the length as of now.
  const base = toStatsSession(row);
  const shown = { ...base, endAt: base.endAt ?? new Date().toISOString() };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-6">
      <TopBar
        title={t('title')}
        subtitle={[tSessions(row.kind === 'mtt' ? 'mtt' : 'cash'), row.venue, row.stake_label]
          .filter(Boolean)
          .join(' · ')}
        back={{ href: `/sessions/${id}`, label: t('back') }}
      />
      <SummaryForm
        sessionId={id}
        base={shown}
        initial={summaryFormFrom(row)}
        handCount={ids.length}
        reviewedCount={reviews?.length ?? 0}
        leakHints={leakHints}
        ai={{
          plan: status?.plan ?? 'free',
          remaining: status?.summaryRemaining ?? null,
          locked: status?.budgetLocked ?? false,
        }}
      />
    </main>
  );
}
