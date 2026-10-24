import { getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { HandForm } from '@/components/hand/hand-form';
import { TopBar } from '@/components/ui/top-bar';
import { fromHandRow, HAND_EDIT_COLUMNS, HAND_SESSION_COLUMNS } from '@/lib/hands/build';
import { sortOpponents } from '@/lib/hands/table';
import { createClient } from '@/lib/supabase/server';

/** "Sửa hand": the Ghi hand screen on a saved hand. Back goes to the replayer. */
export default async function EditHandPage({ params }: PageProps<'/hands/[id]/edit'>) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: hand } = await supabase
    .from('hands')
    .select(HAND_EDIT_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (!hand) notFound();

  const { data: session } = await supabase
    .from('sessions')
    .select(`${HAND_SESSION_COLUMNS}, currency, venue`)
    .eq('id', hand.session_id)
    .maybeSingle();
  if (!session) notFound();

  const venue = session.venue?.trim() ?? '';
  const [{ data: opponents }, { data: profile }, t, locale] = await Promise.all([
    supabase.from('opponents').select('id, name, venue').order('name'),
    supabase.from('profiles').select('entry_mode').single(),
    getTranslations('hand'),
    getLocale(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-6 lg:max-w-none">
      <TopBar
        title={t('editHand')}
        back={{ href: `/hands/${id}`, label: t('detailTitle', { num: hand.num }) }}
      />
      <HandForm
        sessionId={hand.session_id}
        session={session}
        locale={locale}
        venue={session.venue}
        lastNum={hand.num - 1}
        previous={null}
        opponents={sortOpponents(
          (opponents ?? []).map((o) => ({
            id: o.id,
            name: o.name,
            sameVenue: venue !== '' && (o.venue ?? '').trim().toLowerCase() === venue.toLowerCase(),
          })),
        )}
        entryMode={profile?.entry_mode === 'shorthand' ? 'shorthand' : 'buttons'}
        edit={{ handId: hand.id, num: hand.num, initial: fromHandRow(session, hand) }}
      />
    </main>
  );
}
