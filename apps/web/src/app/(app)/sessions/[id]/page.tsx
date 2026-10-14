import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sessionResult } from 'poker-core';
import { SyncStatus } from '@/components/hand/sync-status';
import { buttonClass } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Result } from '@/components/ui/result';
import { TopBar } from '@/components/ui/top-bar';
import { handTotals } from '@/lib/home/home';
import { formatMoney } from '@/lib/sessions/format';
import { STATS_COLUMNS, toStatsSession } from '@/lib/sessions/summary';
import { createClient } from '@/lib/supabase/server';

/** One session: where it stands and the next step (record, end, review, summary). */
export default async function SessionPage({ params }: PageProps<'/sessions/[id]'>) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: row } = await supabase
    .from('sessions')
    .select(STATS_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (!row) notFound();

  const { data: hands } = await supabase
    .from('hands')
    .select('result, level_bb')
    .eq('session_id', id);

  const [t, tHand, tCommon, locale] = await Promise.all([
    getTranslations('sessions'),
    getTranslations('hand'),
    getTranslations('common'),
    getLocale(),
  ]);
  const session = toStatsSession(row);
  const started = Boolean(session.startAt);
  const ended = Boolean(session.endAt);
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  // Ended: the real result (cash-out or prize). Open: what the hands add up to so far.
  const final = ended ? sessionResult(session) : null;
  const sofar = handTotals(hands ?? [], session.bb || null);
  const money = final?.money ?? sofar.money;
  const bb = final ? final.bb : session.kind === 'mtt' ? null : sofar.bb;
  const num = (n: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 2, signDisplay: 'exceptZero' }).format(
      n,
    );

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-6">
      <TopBar
        title={t('title', { kind: t(session.kind) })}
        subtitle={[session.venue, session.stakeLabel].filter(Boolean).join(' · ')}
        back={{ href: '/', label: tCommon('back') }}
      />

      <Card>
        <p className="text-sm text-muted">
          {ended && session.endAt
            ? t('endedAt', { time: time(session.endAt) })
            : session.startAt
              ? t('startedAt', { time: time(session.startAt) })
              : t('notStarted')}
          {' · '}
          {t('handsOnly', { count: hands?.length ?? 0 })}
        </p>
        {started && (
          <p className="text-2xl font-semibold">
            <Result value={money}>
              {bb != null ? `${num(bb)} bb` : formatMoney(money, session.currency, locale)}
            </Result>
            {bb != null && (
              <span className="ml-2 text-base font-normal text-muted">
                {formatMoney(money, session.currency, locale)}
              </span>
            )}
          </p>
        )}
      </Card>

      <SyncStatus />

      {!started && (
        <Link href={`/sessions/${id}/before`} className={buttonClass({ size: 'lg' })}>
          {t('goBefore')}
        </Link>
      )}
      {started && !ended && (
        <Link href={`/sessions/${id}/record`} className={buttonClass({ size: 'lg' })}>
          {t('recordHand')}
        </Link>
      )}
      {ended && (
        <Link href={`/sessions/${id}/summary`} className={buttonClass({ size: 'lg' })}>
          {t('goSummary')}
        </Link>
      )}
      <Link
        href={`/sessions/${id}/hands`}
        className={buttonClass({ variant: 'secondary', size: 'md' })}
      >
        {ended ? t('reviewHands') : tHand('handsList')}
      </Link>
      {started && !ended && (
        <Link
          href={`/sessions/${id}/end`}
          className={buttonClass({ variant: 'secondary', size: 'md' })}
        >
          {t('endSession')}
        </Link>
      )}
    </main>
  );
}
