import { getLocale, getTranslations } from 'next-intl/server';
import { cumulativeSeries, disciplineStats, leakTable, mttStats, type LeakRow } from 'poker-core';
import { ResultsChart } from '@/components/stats/results-chart';
import { ERROR_TAGS } from '@/lib/review/review';
import { isOneOf } from '@/lib/sessions/form';
import { formatMoney } from '@/lib/sessions/format';
import { STATS_COLUMNS, toStatsSession } from '@/lib/sessions/summary';
import {
  filterOptions,
  filterSessions,
  KIND_FILTERS,
  MODE_FILTERS,
  parseFilters,
  resolveView,
} from '@/lib/stats/filters';
import { TopBar } from '@/components/ui/top-bar';
import { createClient } from '@/lib/supabase/server';

const SELECT = 'h-10 w-full rounded-md border border-line bg-surface px-2 text-sm';

export default async function StatsPage({ searchParams }: PageProps<'/stats'>) {
  const filters = parseFilters(await searchParams);
  const supabase = await createClient();

  const [{ data: rows }, { data: leaks }] = await Promise.all([
    supabase.from('sessions').select(STATS_COLUMNS).order('date', { ascending: true }),
    supabase.from('leak_stats').select('session_id, tag, hand_count'),
  ]);
  const sessions = (rows ?? []).map(toStatsSession);

  const leakRows: LeakRow[] = (leaks ?? []).flatMap((l) =>
    l.session_id && l.tag
      ? [{ sessionId: l.session_id, tag: l.tag, handCount: l.hand_count ?? 0 }]
      : [],
  );
  // Only codes the app has a name for; a stray tag in the data must not break the page.
  const leakLines = leakTable(leakRows, sessions).filter((l) => isOneOf(ERROR_TAGS, l.tag));

  const filtered = filterSessions(sessions, filters);
  const view = resolveView(filtered, filters);
  const series = cumulativeSeries(view.sessions, view.unit);
  const mtt = mttStats(filtered);
  const discipline = disciplineStats(filtered);
  const options = filterOptions(sessions);

  const [t, tReview, tSessions, locale] = await Promise.all([
    getTranslations('stats'),
    getTranslations('review'),
    getTranslations('sessions'),
    getLocale(),
  ]);
  const num = (n: number, digits = 2) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(n);
  const signed = (n: number, digits = 2) => `${n > 0 ? '+' : ''}${num(n, digits)}`;
  const pct = (n: number) => `${num(n, 1)}%`;

  const fmtPoint =
    view.unit === 'bb'
      ? (n: number) => `${signed(n)} bb`
      : (n: number) => `${n > 0 ? '+' : ''}${formatMoney(n, view.currency ?? '', locale)}`;
  const top = series.at(-1);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 p-6">
      <TopBar title={t('title')} back={{ href: '/', label: t('home') }} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('leaksTitle')}</h2>
        {leakLines.length === 0 ? (
          <p className="text-sm">{t('leaksNone')}</p>
        ) : (
          <>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-surface">
                  <th className="py-1 pr-2 font-medium">{t('leak')}</th>
                  <th className="px-2 py-1 text-right font-medium">{t('hands')}</th>
                  <th className="px-2 py-1 text-right font-medium">{t('sessions')}</th>
                  <th className="py-1 pl-2 text-right font-medium">{t('trend')}</th>
                </tr>
              </thead>
              <tbody>
                {leakLines.map((l) => (
                  <tr key={l.tag} className="border-b border-line align-top">
                    <td className="py-2 pr-2">
                      {tReview(`tag_${l.tag}` as 'tag_tilt')}
                      {l.repeated && (
                        <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-xs text-accent-foreground">
                          {t('repeated')}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{l.hands}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{l.sessions}</td>
                    <td className="py-2 pl-2 text-right">
                      <span
                        role="img"
                        aria-label={t('trendLabel', {
                          n: l.trend.filter(Boolean).length,
                          of: l.trend.length,
                        })}
                        className="inline-flex gap-1"
                      >
                        {l.trend.map((on, i) => (
                          <span
                            key={i}
                            className={`size-2.5 rounded-full border border-current ${on ? 'bg-current' : 'opacity-40'}`}
                          />
                        ))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-muted">{t('leaksNote')}</p>
          </>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('resultsTitle')}</h2>
        <form method="get" className="grid grid-cols-2 gap-2">
          <select
            name="kind"
            defaultValue={filters.kind}
            aria-label={t('filterKind')}
            className={SELECT}
          >
            {KIND_FILTERS.map((k) => (
              <option key={k} value={k}>
                {k === 'all' ? t('filterAll') : tSessions(k)}
              </option>
            ))}
          </select>
          <select
            name="mode"
            defaultValue={filters.mode}
            aria-label={t('filterMode')}
            className={SELECT}
          >
            {MODE_FILTERS.map((m) => (
              <option key={m} value={m}>
                {m === 'all' ? t('filterAll') : tSessions(m)}
              </option>
            ))}
          </select>
          <select
            name="venue"
            defaultValue={filters.venue}
            aria-label={t('filterVenue')}
            className={SELECT}
          >
            <option value="">{t('filterAllVenues')}</option>
            {options.venues.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <select
            name="stake"
            defaultValue={filters.stake}
            aria-label={t('filterStake')}
            className={SELECT}
          >
            <option value="">{t('filterAllStakes')}</option>
            {options.stakes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            name="unit"
            defaultValue={filters.unit ?? ''}
            aria-label={t('filterUnit')}
            className={SELECT}
          >
            <option value="">{t('unitAuto')}</option>
            <option value="bb">{t('unitBb')}</option>
            <option value="money">{t('unitMoney')}</option>
          </select>
          <select
            name="currency"
            defaultValue={filters.currency}
            aria-label={t('filterCurrency')}
            className={SELECT}
          >
            <option value="">{t('filterAllCurrencies')}</option>
            {options.currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="col-span-2 h-10 rounded-md bg-accent text-sm font-medium text-accent-foreground"
          >
            {t('apply')}
          </button>
        </form>

        {series.length === 0 ? (
          <p className="text-sm">
            {view.unit === 'money' && !view.currency ? t('chartNoData') : t('chartEmpty')}
          </p>
        ) : (
          <>
            <p className="text-lg">{top ? fmtPoint(top.cumulative) : ''}</p>
            <ResultsChart
              points={series}
              format={fmtPoint}
              label={t('chartLabel', { n: series.length })}
            />
          </>
        )}
        {view.unit === 'bb' && <p className="text-xs text-muted">{t('bbNote')}</p>}
        {view.unit === 'money' && view.currency && (
          <p className="text-xs text-muted">{t('moneyNote', { currency: view.currency })}</p>
        )}
        {view.missing > 0 && (
          <p className="text-xs text-muted">{t('missingResult', { n: view.missing })}</p>
        )}
      </section>

      {mtt.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t('mttTitle')}</h2>
          {mtt.map((g) => (
            <dl
              key={g.currency}
              className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border border-line bg-surface p-3 text-sm"
            >
              <dt className="col-span-2 font-medium">{g.currency}</dt>
              <dt>{t('mttCount')}</dt>
              <dd className="text-right tabular-nums">{g.count}</dd>
              <dt>{t('mttCost')}</dt>
              <dd className="text-right tabular-nums">{formatMoney(g.cost, g.currency, locale)}</dd>
              <dt>{t('mttReturned')}</dt>
              <dd className="text-right tabular-nums">
                {formatMoney(g.returned, g.currency, locale)}
              </dd>
              <dt>ROI</dt>
              <dd className="text-right tabular-nums">{pct(g.roi * 100)}</dd>
              <dt>ITM</dt>
              <dd className="text-right tabular-nums">{pct(g.itmPct)}</dd>
              <dt>{t('mttBust')}</dt>
              <dd className="text-right">
                {g.topBustStage ? t(`stage_${g.topBustStage}` as 'stage_early') : '–'}
              </dd>
            </dl>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('disciplineTitle')}</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border border-line bg-surface p-3 text-sm">
          <dt>{t('disciplineSessions')}</dt>
          <dd className="text-right tabular-nums">{discipline.sessions}</dd>
          <dt>{t('stopLossBreaches')}</dt>
          <dd className="text-right tabular-nums">{discipline.stopLossBreaches}</dd>
          <dt>{t('tiltSessions')}</dt>
          <dd className="text-right tabular-nums">{discipline.tiltSessions}</dd>
        </dl>
      </section>
    </main>
  );
}
