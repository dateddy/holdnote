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
  const [{ data: last }, { data: opponents }, { data: profile }, { data: seen }, t, locale] =
    await Promise.all([
      supabase
        .from('hands')
        .select(
          'num, hero_stack, result, level_bb, players_dealt, hero_pos, villain_pos, stage, actions',
        )
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
      supabase
        .from('hands')
        .select('opponent_id, villain_stack')
        .not('opponent_id', 'is', null)
        .not('villain_stack', 'is', null)
        .order('created_at', { ascending: false })
        .limit(300),
      getTranslations('hand'),
      getLocale(),
    ]);

  // Most recent villain stack against each opponent; the newest row per opponent wins.
  const opponentStacks: Record<string, number> = {};
  for (const h of seen ?? []) {
    if (h.opponent_id && h.villain_stack != null && !(h.opponent_id in opponentStacks)) {
      opponentStacks[h.opponent_id] = h.villain_stack;
    }
  }
  // The previous hand's straddles come from its forced bets.
  const straddles = (Array.isArray(last?.actions) ? last.actions : []).flatMap((a) => {
    const x = a as { act?: string; amount?: number };
    return x.act === 'post_straddle' && typeof x.amount === 'number' ? [x.amount] : [];
  });

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 p-6">
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
        previous={last ? { ...last, straddles } : null}
        opponents={opponents ?? []}
        opponentStacks={opponentStacks}
        entryMode={profile?.entry_mode === 'shorthand' ? 'shorthand' : 'buttons'}
      />
    </main>
  );
}
