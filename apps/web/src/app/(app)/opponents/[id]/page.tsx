import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cardLabel } from '@/components/hand/card-label';
import { OpponentForm } from '@/components/opponents/opponent-form';
import { resultBb } from '@/lib/hands/list';
import { opponentFormFrom } from '@/lib/opponents/form';
import { TopBar } from '@/components/ui/top-bar';
import { createClient } from '@/lib/supabase/server';
import { deleteOpponent } from '../actions';

export default async function OpponentPage({ params }: PageProps<'/opponents/[id]'>) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: opponent } = await supabase
    .from('opponents')
    .select('id, name, player_type, venue, notes')
    .eq('id', id)
    .maybeSingle();
  if (!opponent) notFound();

  const { data: hands } = await supabase
    .from('hands')
    .select('id, num, session_id, hero_cards, board, result, level_bb, created_at')
    .eq('opponent_id', id)
    .order('created_at', { ascending: false })
    .limit(100);
  const sessionIds = [...new Set((hands ?? []).map((h) => h.session_id))];
  const { data: sessions } = sessionIds.length
    ? await supabase.from('sessions').select('id, date, bb, venue').in('id', sessionIds)
    : { data: [] };
  const sessionOf = new Map((sessions ?? []).map((s) => [s.id, s]));

  const [t, locale] = await Promise.all([getTranslations('opponents'), getLocale()]);
  const num = (n: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 2, signDisplay: 'exceptZero' }).format(
      n,
    );

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-6">
      <TopBar title={opponent.name} back={{ href: '/opponents', label: t('back') }} />

      <OpponentForm id={id} initial={opponentFormFrom(opponent)} />

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t('handsTitle', { n: hands?.length ?? 0 })}</h2>
        {!hands?.length ? (
          <p className="text-sm text-muted">{t('handsNone')}</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {hands.map((h) => {
              const s = sessionOf.get(h.session_id);
              const res = resultBb(h.result, h.level_bb ?? s?.bb ?? null);
              return (
                <li key={h.id}>
                  <Link
                    href={`/hands/${h.id}`}
                    className="flex items-center justify-between gap-2 p-3"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-sm text-muted">
                        {s?.date} #{h.num}
                      </span>
                      <b>
                        {(h.hero_cards ?? []).map((c, i) => (
                          <span key={i}>{cardLabel(c)}</span>
                        ))}
                        {!h.hero_cards?.length && '–'}
                      </b>
                      <span className="text-sm">
                        {(h.board ?? []).map((c, i) => (
                          <span key={i}>{cardLabel(c)}</span>
                        ))}
                      </span>
                    </span>
                    <span className="text-sm tabular-nums">
                      {res == null ? '–' : `${num(res)} bb`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <form action={deleteOpponent.bind(null, id)}>
        <button type="submit" className="h-12 w-full rounded-xl border border-red-700/40 text-loss">
          {t('delete')}
        </button>
        <p className="pt-1 text-xs text-muted">{t('deleteHint')}</p>
      </form>
    </main>
  );
}
