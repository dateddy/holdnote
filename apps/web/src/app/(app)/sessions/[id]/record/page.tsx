import { getLocale, getTranslations } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { HandForm } from '@/components/hand/hand-form';
import { SyncStatus } from '@/components/hand/sync-status';
import { HAND_SESSION_COLUMNS } from '@/lib/hands/build';
import { TopBar } from '@/components/ui/top-bar';
import { createClient } from '@/lib/supabase/server';

export default async function RecordPage({ params }: PageProps<'/sessions/[id]/record'>) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: session } = await supabase
    .from('sessions')
    .select(`${HAND_SESSION_COLUMNS}, currency, venue, start_at, end_at`)
    .eq('id', id)
    .maybeSingle();
  if (!session) notFound();
  if (!session.start_at) redirect(`/sessions/${id}/before`);

  const venue = session.venue?.trim() ?? '';
  const [{ data: last }, { data: opponents }, { data: profile }, t, locale] = await Promise.all([
    supabase
      .from('hands')
      .select('num, hero_stack, result, level_bb, players_dealt')
      .eq('session_id', id)
      .order('num', { ascending: false })
      .limit(1)
      .maybeSingle(),
    venue
      ? supabase
          .from('opponents')
          .select('id, name')
          .ilike('venue', venue.replace(/[\%_]/g, '\$&'))
          .order('name')
      : Promise.resolve({ data: [] }),
    supabase.from('profiles').select('entry_mode').single(),
    getTranslations('hand'),
    getLocale(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-6">
      <TopBar
        title={t('screenTitle')}
        back={{ href: `/sessions/${id}`, label: t('backToSession') }}
      />
      <SyncStatus />
      <HandForm
        sessionId={id}
        session={session}
        locale={locale}
        lastNum={last?.num ?? 0}
        previous={last ?? null}
        opponents={opponents ?? []}
        entryMode={profile?.entry_mode === 'shorthand' ? 'shorthand' : 'buttons'}
      />
    </main>
  );
}
