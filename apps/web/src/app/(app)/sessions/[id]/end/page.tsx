import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { EndForm } from '@/components/session/end-form';
import { TopBar } from '@/components/ui/top-bar';
import { resolveEndAt } from '@/lib/sessions/end-time';
import { STATS_COLUMNS, summaryFormFrom, toStatsSession } from '@/lib/sessions/summary';
import { createClient } from '@/lib/supabase/server';

/** End session (DEC-044): result and state only; the debrief is a separate screen. */
export default async function EndSessionPage({
  params,
  searchParams,
}: PageProps<'/sessions/[id]/end'>) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const { data: row } = await supabase
    .from('sessions')
    .select(`${STATS_COLUMNS}, summary`)
    .eq('id', id)
    .maybeSingle();
  if (!row) notFound();

  const { count } = await supabase
    .from('hands')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', id);
  const [t, tCommon] = await Promise.all([getTranslations('sessions'), getTranslations('common')]);

  // Open session: the result is shown as of now.
  const base = toStatsSession(row);
  // `endAt` comes from the reminder for a session left open; anything invalid falls back to now.
  const rawEnd = Array.isArray(query.endAt) ? query.endAt[0] : query.endAt;
  const now = new Date().toISOString();
  const endAt = base.endAt ?? resolveEndAt(rawEnd ?? null, base.startAt, now);
  const shown = { ...base, endAt };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-6">
      <TopBar
        title={t('endTitle')}
        subtitle={[t(row.kind === 'mtt' ? 'mtt' : 'cash'), row.venue, row.stake_label]
          .filter(Boolean)
          .join(' · ')}
        back={{ href: `/sessions/${id}`, label: tCommon('back') }}
      />
      <EndForm
        sessionId={id}
        base={shown}
        initial={summaryFormFrom(row)}
        handCount={count ?? 0}
        endAt={base.endAt ? null : endAt}
      />
    </main>
  );
}
