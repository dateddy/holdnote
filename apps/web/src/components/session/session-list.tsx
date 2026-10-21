'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { sessionTotals, type SessionTotals } from 'poker-core';
import { Button, buttonClass } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { ChipMenu } from '@/components/ui/chip-menu';
import { FilterBar } from '@/components/ui/filter-bar';
import { Input } from '@/components/ui/input';
import { Result } from '@/components/ui/result';
import { Segmented } from '@/components/ui/segmented';
import { StatTile } from '@/components/ui/stat-tile';
import { TopBar } from '@/components/ui/top-bar';
import { formatMonth, formatMoney, signedNumber } from '@/lib/sessions/format';
import {
  filterItems,
  groupByMonth,
  isFiltering,
  listOptions,
  netTile,
  serializeListFilter,
  sortItems,
  EMPTY_FILTER,
  LIST_KINDS,
  type ListFilter,
  type SessionListItem,
  type SortColumn,
  type SortDir,
} from '@/lib/sessions/list';
import { SessionRow } from './session-row';
import { SessionTable } from './session-table';
import { StaleSessions, type StaleEntry } from './stale-sessions';
import { useSessionText } from './use-session-text';

/** Columns that start from the largest value when first chosen. */
const DESC_FIRST: readonly SortColumn[] = [
  'date',
  'duration',
  'hands',
  'net',
  'bbPerHour',
  'review',
];

/** Home: sessions with filters and totals. Phone: list by month. Desktop: filters left, table right. */
export function SessionList({
  items,
  initialFilter,
  stale = [],
}: {
  items: SessionListItem[];
  initialFilter: ListFilter;
  /** Open sessions past 16 hours (computed on the server so the render does not depend on the clock). */
  stale?: StaleEntry[];
}) {
  const { t, locale } = useSessionText();
  const tCommon = useTranslations('common');
  const [filter, setFilter] = useState(initialFilter);
  const [sort, setSort] = useState<{ col: SortColumn; dir: SortDir }>({
    col: 'date',
    dir: 'desc',
  });

  const update = (patch: Partial<ListFilter>) => {
    const next = { ...filter, ...patch };
    setFilter(next);
    // Keep the filter in the address so Back and reload come back to the same list.
    const qs = serializeListFilter(next);
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  };

  const options = useMemo(() => listOptions(items), [items]);
  const filtered = useMemo(() => filterItems(items, filter), [items, filter]);
  const totals = useMemo(() => sessionTotals(filtered.map((i) => i.session)), [filtered]);
  const groups = useMemo(() => groupByMonth(filtered), [filtered]);
  const tableRows = useMemo(
    () => [
      ...groups.open,
      ...sortItems(
        filtered.filter((i) => i.session.endAt),
        sort.col,
        sort.dir,
      ),
    ],
    [filtered, groups.open, sort],
  );

  const num1 = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n);
  const explain = tCommon('explain');
  const filtering = isFiltering(filter);

  const onSort = (col: SortColumn) =>
    setSort((s) =>
      s.col === col
        ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { col, dir: DESC_FIRST.includes(col) ? 'desc' : 'asc' },
    );

  const monthOptions = options.months.map((m) => ({ value: m, label: formatMonth(m, locale) }));
  const venueOptions = options.venues.map((v) => ({ value: v, label: v }));
  const clear = filtering && (
    <Button variant="ghost" full={false} onClick={() => update(EMPTY_FILTER)}>
      {t('clear')}
    </Button>
  );

  const search = (
    <Input
      type="search"
      aria-label={t('search')}
      placeholder={t('search')}
      value={filter.q}
      onChange={(e) => update({ q: e.target.value })}
    />
  );

  const kind = (
    <Segmented
      label={t('kind')}
      value={filter.kind}
      onChange={(k) => update({ kind: k })}
      options={LIST_KINDS.map((k) => ({
        value: k,
        label: t(k === 'all' ? 'kindAll' : k === 'cash' ? 'kindCash' : 'kindMtt'),
      }))}
    />
  );
  const toggles = (
    <>
      <Chip on={filter.win} onClick={() => update({ win: !filter.win })}>
        {t('win')}
      </Chip>
      <Chip on={filter.loss} onClick={() => update({ loss: !filter.loss })}>
        {t('loss')}
      </Chip>
      <Chip on={filter.toReview} onClick={() => update({ toReview: !filter.toReview })}>
        {t('toReview')}
      </Chip>
    </>
  );

  const net = netTile(totals, filter.kind);
  const moneyText = (m: { currency: string; money: number }) =>
    `${m.money > 0 ? '+' : ''}${formatMoney(m.money, m.currency, locale)}`;
  const netSub = net.sub.map(moneyText).join(' · ');

  const tiles = (
    <>
      <StatTile
        label={t('tileSessions')}
        tip={{ text: t('tipSessions'), label: explain }}
        sub={t('hoursUnit', { hours: num1(totals.hours) })}
      >
        {totals.count}
      </StatTile>
      <StatTile
        label={t('tileNet')}
        tip={{
          text: t(
            filter.kind === 'cash'
              ? 'tipNetCash'
              : filter.kind === 'mtt'
                ? 'tipNetMtt'
                : 'tipNetAll',
          ),
          label: explain,
        }}
        sub={netSub || undefined}
      >
        {net.main == null ? (
          '—'
        ) : 'bb' in net.main ? (
          <Result value={net.main.bb}>{signedNumber(net.main.bb, locale)} bb</Result>
        ) : (
          <Result value={net.main.money}>{moneyText(net.main)}</Result>
        )}
      </StatTile>
      <StatTile
        label={t('tileRate')}
        tip={{
          text:
            totals.rateSessions > 0 ? t('tipRate', { n: totals.rateSessions }) : t('tipRateNone'),
          label: explain,
        }}
      >
        {totals.bbPerHour == null ? (
          '—'
        ) : (
          <Result value={totals.bbPerHour}>{signedNumber(totals.bbPerHour, locale)}</Result>
        )}
      </StatTile>
    </>
  );

  const newSession = (
    <Link href="/sessions/new" className={buttonClass({ full: false })}>
      {t('newSession')}
    </Link>
  );

  const monthNet = (g: SessionTotals) =>
    [
      g.netBb !== 0 || g.mttMoney.length === 0 ? `${signedNumber(g.netBb, locale)} bb` : null,
      ...g.mttMoney.map(
        (m) => `${m.money > 0 ? '+' : ''}${formatMoney(m.money, m.currency, locale)}`,
      ),
    ]
      .filter(Boolean)
      .join(' · ');

  const empty =
    items.length === 0 ? (
      <Card>
        <h2 className="text-lg font-semibold">{t('emptyTitle')}</h2>
        <p className="text-sm text-muted">{t('emptyBody')}</p>
        <Link href="/sessions/new" className={buttonClass({ size: 'lg' })}>
          {t('newSession')}
        </Link>
      </Card>
    ) : (
      <Card>
        <p className="text-sm text-muted">{t('noMatch')}</p>
        {clear}
      </Card>
    );

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-6 lg:max-w-none">
      <TopBar title={t('title')} action={newSession} />
      <StaleSessions entries={stale} />

      {/* Phone */}
      <div className="flex flex-col gap-3 lg:hidden">
        {search}
        <FilterBar label={t('filters')}>
          {kind}
          <ChipMenu
            label={t('month')}
            value={filter.month}
            options={monthOptions}
            allLabel={t('all')}
            onChange={(month) => update({ month })}
          />
          <ChipMenu
            label={t('venue')}
            value={filter.venue}
            options={venueOptions}
            allLabel={t('all')}
            onChange={(venue) => update({ venue })}
          />
          {toggles}
          {clear}
        </FilterBar>
        <div className="grid grid-cols-3 gap-2">{tiles}</div>

        {filtered.length === 0 ? (
          empty
        ) : (
          <div className="flex flex-col gap-6">
            {groups.open.length > 0 && (
              <ul className="space-y-2">
                {groups.open.map((item) => (
                  <li key={item.session.id}>
                    <SessionRow item={item} />
                  </li>
                ))}
              </ul>
            )}
            {groups.months.map((g) => (
              <section key={g.month} className="space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-base font-medium">{formatMonth(g.month, locale)}</h2>
                  <span className="text-sm tabular-nums">
                    <Result value={g.totals.netBb || g.totals.mttMoney[0]?.money || 0}>
                      {monthNet(g.totals)}
                    </Result>
                  </span>
                </div>
                <ul className="divide-y divide-line rounded-md border border-line bg-surface">
                  {g.items.map((item) => (
                    <li key={item.session.id}>
                      <SessionRow item={item} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* Desktop */}
      <div className="hidden gap-6 lg:grid lg:grid-cols-[16rem_1fr] lg:items-start">
        <aside className="space-y-4">
          {search}
          <FilterBar orientation="column" label={t('filters')}>
            {kind}
            <ChipMenu
              className="w-full"
              label={t('month')}
              value={filter.month}
              options={monthOptions}
              allLabel={t('all')}
              onChange={(month) => update({ month })}
            />
            <ChipMenu
              className="w-full"
              label={t('venue')}
              value={filter.venue}
              options={venueOptions}
              allLabel={t('all')}
              onChange={(venue) => update({ venue })}
            />
            <div className="flex flex-wrap gap-2">{toggles}</div>
            {clear}
          </FilterBar>
          <div className="grid grid-cols-1 gap-2">{tiles}</div>
        </aside>
        {filtered.length === 0 ? (
          empty
        ) : (
          <SessionTable items={tableRows} sort={sort} onSort={onSort} explain={explain} />
        )}
      </div>
    </main>
  );
}
