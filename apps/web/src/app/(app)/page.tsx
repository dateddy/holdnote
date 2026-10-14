import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { leakTable, sessionResult, type LeakRow } from 'poker-core';
import { InstallHint } from '@/components/pwa/install-hint';
import { loadUsage } from '@/lib/ai/quota';
import { aiStatus } from '@/lib/ai/status';
import { handTotals, topLeaks } from '@/lib/home/home';
import { ERROR_TAGS } from '@/lib/review/review';
import { isOneOf } from '@/lib/sessions/form';
import { formatMoney } from '@/lib/sessions/format';
import { STATS_COLUMNS, toStatsSession } from '@/lib/sessions/summary';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

import { buttonClass } from '@/components/ui/button';
import { CARD_CLASS as CARD } from '@/components/ui/card';
const BIG = buttonClass({ size: 'lg' });

/** Home (spec 3.3): the open session or a start button, then leaks, rules and what is left to do. */
export default async function Home() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;

  const [
    { data: profile },
    { data: open },
    { data: recentRows },
    { data: allSessions },
    { data: leaks },
    { data: rules },
    { count: handCount },
    { count: reviewedCount },
  ] = await Promise.all([
    supabase.from('profiles').select('display_name, onboarded_at').single(),
    // Open = seated and not ended (DEC-028); a session not seated yet still waits on Pre-session.
    supabase
      .from('sessions')
      .select('id, kind, venue, stake_label, start_at, bb, currency')
      .is('end_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('sessions')
      .select(STATS_COLUMNS)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('sessions').select('id, date'),
    supabase.from('leak_stats').select('session_id, tag, hand_count'),
    supabase.from('user_rules').select('id, text').eq('active', true).order('sort').limit(5),
    supabase.from('hands').select('id', { count: 'exact', head: true }),
    supabase
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('is_current', true)
      .eq('accepted', true),
  ]);

  // New accounts go through onboarding once; finishing or skipping sets onboarded_at (spec 3.2).
  if (profile && !profile.onboarded_at) redirect('/onboarding');

  const { data: openHands } = open
    ? await supabase.from('hands').select('result, level_bb').eq('session_id', open.id)
    : { data: null };
  const status = userId ? aiStatus(await loadUsage(createAdminClient(), userId)) : null;

  const leakRows: LeakRow[] = (leaks ?? []).flatMap((l) =>
    l.session_id && l.tag
      ? [{ sessionId: l.session_id, tag: l.tag, handCount: l.hand_count ?? 0 }]
      : [],
  );
  const top = topLeaks(leakTable(leakRows, allSessions ?? [])).filter((l) =>
    isOneOf(ERROR_TAGS, l.tag),
  );
  const unreviewed = Math.max(0, (handCount ?? 0) - (reviewedCount ?? 0));

  const [t, tCommon, tReview, tSessions, locale] = await Promise.all([
    getTranslations('home'),
    getTranslations('common'),
    getTranslations('review'),
    getTranslations('sessions'),
    getLocale(),
  ]);
  const num = (n: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 2, signDisplay: 'exceptZero' }).format(
      n,
    );

  const openResult = open && openHands ? handTotals(openHands, open.bb) : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{tCommon('appName')}</h1>
      </header>
      <p>{t('greeting', { name: profile?.display_name ?? '' })}</p>

      {open ? (
        <section className={CARD}>
          <Link href={`/sessions/${open.id}`} className="block space-y-1">
            <p className="font-medium">
              {[tSessions(open.kind === 'mtt' ? 'mtt' : 'cash'), open.venue, open.stake_label]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <p className="text-sm text-muted">
              {open.start_at
                ? tSessions('startedAt', {
                    time: new Date(open.start_at).toLocaleTimeString(locale, {
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                  })
                : tSessions('notStarted')}
              {' · '}
              {t('handsCount', { n: openHands?.length ?? 0 })}
              {openResult && openHands?.length
                ? ` · ${
                    open.kind === 'mtt'
                      ? `${num(openResult.bb)} bb`
                      : `${num(openResult.bb)} bb (${formatMoney(openResult.money, open.currency, locale)})`
                  }`
                : ''}
            </p>
          </Link>
          <Link
            href={open.start_at ? `/sessions/${open.id}/record` : `/sessions/${open.id}/before`}
            className={BIG}
          >
            {open.start_at ? t('recordHand') : tSessions('goBefore')}
          </Link>
          {open.start_at && (
            <Link
              href={`/sessions/${open.id}/end`}
              className={buttonClass({ variant: 'secondary' })}
            >
              {tSessions('endSession')}
            </Link>
          )}
        </section>
      ) : (
        <Link href="/sessions/new" className={BIG}>
          {t('startSession')}
        </Link>
      )}

      <dl className="grid grid-cols-2 gap-2 text-center text-sm">
        <div className="rounded-md border border-line bg-surface p-3">
          <dt className="text-muted">{t('unreviewed')}</dt>
          <dd className="text-xl font-medium">
            {unreviewed > 0 && recentRows?.[0] ? (
              <Link
                href={`/sessions/${recentRows[0].id}/hands?f=unreviewed`}
                className="underline underline-offset-4"
              >
                {unreviewed}
              </Link>
            ) : (
              unreviewed
            )}
          </dd>
        </div>
        <div className="rounded-md border border-line bg-surface p-3">
          <dt className="text-muted">{t('aiLeft')}</dt>
          <dd className="text-xl font-medium">
            {status?.plan === 'byok'
              ? t('aiOwnKey')
              : status?.budgetLocked
                ? t('aiPaused')
                : (status?.remaining ?? '–')}
          </dd>
        </div>
      </dl>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">{t('leaksTitle')}</h2>
          <Link href="/stats" className="text-sm underline underline-offset-4">
            {t('stats')}
          </Link>
        </div>
        {top.length === 0 ? (
          <p className="text-sm text-muted">{t('leaksNone')}</p>
        ) : (
          <ol className="list-decimal space-y-1 pl-5">
            {top.map((l) => (
              <li key={l.tag}>
                {tReview(`tag_${l.tag}` as 'tag_tilt')}{' '}
                <span className="text-sm text-muted">
                  {t('leakRecent', { n: l.trend.filter(Boolean).length, of: l.trend.length })}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">{t('rulesTitle')}</h2>
          <Link href="/rules" className="text-sm underline underline-offset-4">
            {t('editRules')}
          </Link>
        </div>
        {rules?.length ? (
          <ol className="list-decimal space-y-1 pl-5">
            {rules.map((r) => (
              <li key={r.id}>{r.text}</li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted">{t('rulesNone')}</p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">{t('recentTitle')}</h2>
        {!recentRows?.length ? (
          <p className="text-sm text-muted">{t('recentNone')}</p>
        ) : (
          <ul className="divide-y divide-line rounded-md border border-line bg-surface">
            {recentRows.map((row) => {
              const s = toStatsSession(row);
              const r = sessionResult(s);
              return (
                <li key={s.id}>
                  <Link
                    href={`/sessions/${s.id}`}
                    className="flex items-center justify-between gap-2 p-3"
                  >
                    <span className="flex flex-col">
                      <span>
                        {[tSessions(s.kind), s.venue, s.stakeLabel].filter(Boolean).join(' · ')}
                      </span>
                      <span className="text-sm text-muted">{s.date}</span>
                    </span>
                    <span className="text-sm tabular-nums">
                      {!s.endAt
                        ? t('inProgress')
                        : r
                          ? r.bb != null
                            ? `${num(r.bb)} bb`
                            : formatMoney(r.money, s.currency, locale)
                          : '–'}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <InstallHint />
    </main>
  );
}
