import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cardLabel } from '@/components/hand/card-label';
import { SyncStatus } from '@/components/hand/sync-status';
import {
  filterHands,
  handBbOf,
  HAND_FILTERS,
  LIST_COLUMNS,
  resultBb,
  summarize,
  type HandFilter,
  type ListHand,
} from '@/lib/hands/list';
import { isOneOf } from '@/lib/sessions/form';
import { createClient } from '@/lib/supabase/server';

export default async function HandListPage({
  params,
  searchParams,
}: PageProps<'/sessions/[id]/hands'>) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const rawFilter = Array.isArray(query.f) ? query.f[0] : query.f;
  const filter: HandFilter = isOneOf(HAND_FILTERS, rawFilter) ? rawFilter : 'all';

  const supabase = await createClient();
  const { data: session } = await supabase
    .from('sessions')
    .select('id, bb, venue, stake_label')
    .eq('id', id)
    .maybeSingle();
  if (!session) notFound();

  const { data: rows } = await supabase
    .from('hands')
    .select(LIST_COLUMNS)
    .eq('session_id', id)
    .order('num', { ascending: false });
  const ids = (rows ?? []).map((h) => h.id);
  const { data: reviews } = ids.length
    ? await supabase
        .from('reviews')
        .select('hand_id, accepted')
        .eq('is_current', true)
        .in('hand_id', ids)
    : { data: [] };
  const accepted = new Set((reviews ?? []).filter((r) => r.accepted).map((r) => r.hand_id));
  const hands: ListHand[] = (rows ?? []).map((h) => ({ ...h, reviewed: accepted.has(h.id) }));

  const [t, locale] = await Promise.all([getTranslations('hand'), getLocale()]);
  const stats = summarize(hands, session.bb);
  const shown = filterHands(hands, filter);
  const num = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t('handsList')}</h1>
        <Link href={`/sessions/${id}`} className="text-sm underline underline-offset-4">
          {t('backToSession')}
        </Link>
      </header>

      <SyncStatus />

      <dl className="grid grid-cols-4 gap-2 rounded-md border border-line bg-surface p-3 text-center text-sm">
        <div>
          <dt className="text-muted">{t('statHands')}</dt>
          <dd className="font-medium">{stats.count}</dd>
        </div>
        <div>
          <dt className="text-muted">{t('statBb')}</dt>
          <dd className="font-medium">{num(stats.totalBb)}</dd>
        </div>
        <div>
          <dt className="text-muted">{t('statMissing')}</dt>
          <dd className="font-medium">{stats.missing}</dd>
        </div>
        <div>
          <dt className="text-muted">{t('statReviewed')}</dt>
          <dd className="font-medium">{stats.reviewed}</dd>
        </div>
      </dl>

      <nav className="flex flex-wrap gap-1.5" aria-label={t('filters')}>
        {HAND_FILTERS.map((f) => (
          <Link
            key={f}
            href={f === 'all' ? `/sessions/${id}/hands` : `/sessions/${id}/hands?f=${f}`}
            replace
            aria-current={filter === f ? 'true' : undefined}
            className={`flex h-9 items-center rounded-md border px-3 text-sm ${
              filter === f
                ? 'border-accent bg-accent text-accent-foreground'
                : 'border-line bg-surface'
            }`}
          >
            {t(`filter_${f}`)}
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <p className="text-sm text-muted">{t('noHands')}</p>
      ) : (
        <ul className="divide-y divide-line rounded-md border border-line bg-surface">
          {shown.map((h) => {
            const bb = handBbOf(h, session.bb);
            const effBb = resultBb(h.eff_stack, bb);
            const res = resultBb(h.result, bb);
            return (
              <li key={h.id}>
                <Link href={`/hands/${h.id}`} className="flex flex-col gap-1 p-3">
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span className="text-sm text-muted">#{h.num}</span>
                      <b className="text-lg">
                        {(h.hero_cards ?? []).map((c, i) => (
                          <span key={i}>{cardLabel(c)}</span>
                        ))}
                        {!h.hero_cards?.length && '–'}
                      </b>
                      {h.flagged && <span aria-label={t('flag')}>⚑</span>}
                    </span>
                    <span
                      className={`font-medium ${res != null && res < 0 ? 'text-loss' : res != null && res > 0 ? 'text-win' : ''}`}
                    >
                      {res == null ? '–' : `${res > 0 ? '+' : ''}${num(res)} bb`}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm opacity-80">
                    {h.board?.length ? (
                      <span>
                        {h.board.map((c, i) => (
                          <span key={i}>{cardLabel(c)}</span>
                        ))}
                      </span>
                    ) : null}
                    <span>{[h.hero_pos, h.villain_pos].filter(Boolean).join(' vs ')}</span>
                    {effBb != null && <span>{t('effShort', { bb: num(effBb) })}</span>}
                    {h.missing_data && (
                      <span className="rounded bg-warn/15 px-1.5 text-warn">
                        {t('missingLabel')}
                      </span>
                    )}
                    {h.reviewed && (
                      <span className="rounded bg-accent/15 px-1.5">{t('reviewedLabel')}</span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
