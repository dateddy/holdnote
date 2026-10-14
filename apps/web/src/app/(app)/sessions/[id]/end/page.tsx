import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { EndForm } from '@/components/session/end-form';
import { TopBar } from '@/components/ui/top-bar';
import { STATS_COLUMNS, summaryFormFrom, toStatsSession } from '@/lib/sessions/summary';
import { createClient } from '@/lib/supabase/server';

/** End session (DEC-044): result and state only; the debrief is a separate screen. */
export default async function EndSessionPage({ params }: PageProps<'/sessions/[id]/end'>) {
  const { id } = await params;
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
  const shown = { ...base, endAt: base.endAt ?? new Date().toISOString() };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-6">
      <TopBar
        title={t('endTitle')}
        subtitle={[t(row.kind === 'mtt' ? 'mtt' : 'cash'), row.venue, row.stake_label]
          .filter(Boolean)
          .join(' · ')}
        back={{ href: `/sessions/${id}`, label: tCommon('back') }}
      />
      <EndForm sessionId={id} base={shown} initial={summaryFormFrom(row)} handCount={count ?? 0} />
    </main>
  );
}
