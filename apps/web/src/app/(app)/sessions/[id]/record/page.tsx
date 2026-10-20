import { getLocale, getTranslations } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { HandForm } from '@/components/hand/hand-form';
import { SyncStatus } from '@/components/hand/sync-status';
import { HAND_SESSION_COLUMNS } from '@/lib/hands/build';
import { sortOpponents } from '@/lib/hands/table';
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
          'num, hero_stack, result, level_bb, level, ante, ante_mode, players_dealt, hero_pos, villain_pos, stage, actions',
        )
        .eq('session_id', id)
        .order('num', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('opponents').select('id, name, venue').order('name'),
      supabase.from('profiles').select('entry_mode').single(),
      supabase
        .from('hands')
        .select('opponent_id, villain_stack, opponents')
        .order('created_at', { ascending: false })
        .limit(300),
      getTranslations('hand'),
      getLocale(),
    ]);

  // Most recent villain stack against each opponent; the newest row per opponent wins.
  const opponentStacks: Record<string, number> = {};
  const remember = (id: unknown, stack: unknown) => {
    if (typeof id === 'string' && typeof stack === 'number' && !(id in opponentStacks)) {
      opponentStacks[id] = stack;
    }
  };
  for (const h of seen ?? []) {
    remember(h.opponent_id, h.villain_stack);
    // Hands with several opponents keep each one's stack in `opponents`.
    for (const o of Array.isArray(h.opponents) ? h.opponents : []) {
      const x = o as { opponent_id?: unknown; stack?: unknown };
      remember(x.opponent_id, x.stack);
    }
  }
  // Everyone saved, those met at this venue first.
  const options = (opponents ?? []).map((o) => ({
    id: o.id,
    name: o.name,
    sameVenue: venue !== '' && (o.venue ?? '').trim().toLowerCase() === venue.toLowerCase(),
  }));
  // The previous hand's straddles and small blind come from its forced bets.
  const posted = (act: string) =>
    (Array.isArray(last?.actions) ? last.actions : []).flatMap((a) => {
      const x = a as { act?: string; amount?: number };
      return x.act === act && typeof x.amount === 'number' ? [x.amount] : [];
    });
  const straddles = posted('post_straddle');
  const sb = posted('post_sb')[0] ?? null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 px-3 py-6">
      <TopBar
        title={t('screenTitle')}
        back={{ href: `/sessions/${id}`, label: t('backToSession') }}
      />
      <SyncStatus />
      <HandForm
        sessionId={id}
        session={session}
        locale={locale}
        venue={session.venue}
        lastNum={last?.num ?? 0}
        previous={last ? { ...last, straddles, sb } : null}
        startedAt={session.start_at}
        opponents={sortOpponents(options)}
        opponentStacks={opponentStacks}
        entryMode={profile?.entry_mode === 'shorthand' ? 'shorthand' : 'buttons'}
      />
    </main>
  );
}
