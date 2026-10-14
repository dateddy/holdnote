import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { toBb } from 'poker-core';
import { formatMoney } from '@/lib/sessions/format';
import { createClient } from '@/lib/supabase/server';
import { enterTable } from '../../actions';

export default async function BeforeSessionPage({ params }: PageProps<'/sessions/[id]/before'>) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: session } = await supabase.from('sessions').select('*').eq('id', id).maybeSingle();
  if (!session) notFound();

  const venue = session.venue?.trim() ?? '';
  const [{ data: rules }, { data: opponents }] = await Promise.all([
    supabase.from('user_rules').select('id, text').eq('active', true).order('sort'),
    venue
      ? // Venue is free text: match it ignoring case, escaping LIKE wildcards.
        supabase
          .from('opponents')
          .select('id, name, player_type, notes')
          .ilike('venue', venue.replace(/[\\%_]/g, '\\$&'))
          .order('name')
      : Promise.resolve({ data: [] }),
  ]);

  const [t, locale] = await Promise.all([getTranslations('sessions'), getLocale()]);
  const stopLoss = session.stop_loss;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{t('beforeTitle')}</h1>
        <p className="text-sm opacity-70">
          {[t(session.kind === 'mtt' ? 'mtt' : 'cash'), session.venue, session.stake_label]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="font-medium">{t('stopLoss')}</h2>
        <p>
          {stopLoss
            ? t('stopLossLine', {
                amount: formatMoney(stopLoss, session.currency, locale),
                bb: session.bb ? toBb(stopLoss, session.bb) : '–',
              })
            : t('stopLossNone')}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">{t('rules')}</h2>
        {rules?.length ? (
          <ol className="list-decimal space-y-2 pl-5">
            {rules.map((r) => (
              <li key={r.id}>{r.text}</li>
            ))}
          </ol>
        ) : (
          <p className="text-sm opacity-70">{t('noRules')}</p>
        )}
      </section>

      {venue && (
        <section className="space-y-2">
          <h2 className="font-medium">{t('knownOpponents', { venue })}</h2>
          {opponents?.length ? (
            <ul className="space-y-2">
              {opponents.map((o) => (
                <li key={o.id}>
                  <b>{o.name}</b>
                  {o.player_type && o.player_type !== 'unknown' ? ` (${o.player_type})` : ''}
                  {o.notes && <p className="text-sm opacity-70">{o.notes}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm opacity-70">{t('noOpponents')}</p>
          )}
          <Link
            href={`/opponents/new?venue=${encodeURIComponent(venue)}`}
            className="text-sm underline underline-offset-4"
          >
            {t('addOpponent')}
          </Link>
        </section>
      )}

      <form action={enterTable.bind(null, id)} className="mt-auto">
        <button
          type="submit"
          className="h-14 w-full rounded-md bg-foreground text-lg font-medium text-background"
        >
          {t('enterTable')}
        </button>
      </form>
    </main>
  );
}
