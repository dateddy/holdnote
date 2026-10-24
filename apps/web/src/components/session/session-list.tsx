'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useMemo, useState, useTransition } from 'react';
import { sessionTotals, type SessionTotals } from 'poker-core';
import { deleteSession } from '@/app/(app)/sessions/actions';
import { buttonClass } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { ChipMenu } from '@/components/ui/chip-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Fab } from '@/components/ui/fab';
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
  LIST_RESULTS,
  type ListFilter,
  type MoneyLine,
  type NetLine,
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
  const tableRows = useMemo(() => sortItems(filtered, sort.col, sort.dir), [filtered, sort]);
  // The newest session of the list gets the "+ Hand" button.
  const latestId = groups.months[0]?.items[0]?.session.id;
  const [toDelete, setToDelete] = useState<SessionListItem | null>(null);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [deleting, startDelete] = useTransition();
  const router = useRouter();
  const tDetail = useTranslations('sessionDetail');

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
  // The only "Xóa lọc" on the screen: the last control of the filter row, there only while filtering.
  const clear = filtering && (
    <Chip on={false} icon={X} onClick={() => update(EMPTY_FILTER)}>
      {t('clear')}
    </Chip>
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
  const result = (
    <Segmented
      label={t('result')}
      value={filter.result}
      onChange={(r) => update({ result: r })}
      options={LIST_RESULTS.map((r) => ({
        value: r,
        label: t(r === 'all' ? 'resultAll' : r),
      }))}
    />
  );
  const toReview = (
    <Chip on={filter.toReview} onClick={() => update({ toReview: !filter.toReview })}>
      {t('toReview')}
    </Chip>
  );

  const net = netTile(totals, filter.kind);
  const sign = (n: number) => (n > 0 ? '+' : '');
  /** Chips or money of one currency, signed. */
  const ownText = (m: MoneyLine) => `${sign(m.money)}${formatMoney(m.money, m.currency, locale)}`;
  /** What the chips are worth, when every chip session has the same rate. */
  const worthText = (m: MoneyLine) =>
    m.converted
      ? `${sign(m.converted.money)}${formatMoney(m.converted.money, m.converted.currency, locale)}`
      : null;
  const moneyText = (m: MoneyLine) => [ownText(m), worthText(m)].filter(Boolean).join(' · ');
  const isBb = (l: NetLine): l is { bb: number } => 'bb' in l;
  // Under the figure: what chips are worth, then money under bb (cash).
  const netSub = [
    ...net.lines.filter((l): l is MoneyLine => !isBb(l)).map(worthText),
    ...net.sub.map(moneyText),
  ]
    .filter(Boolean)
    .join(' · ');

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
        {net.lines.length === 0
          ? '—'
          : net.lines.map((l, i) => (
              <div key={i} className={i > 0 ? 'text-sm lg:text-2xl' : undefined}>
                {isBb(l) ? (
                  <Result value={l.bb}>{signedNumber(l.bb, locale)} bb</Result>
                ) : (
                  <Result value={l.money}>{ownText(l)}</Result>
                )}
              </div>
            ))}
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
      </Card>
    );

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-6 pb-28 lg:max-w-none">
      <TopBar title={t('title')} />
      <StaleSessions entries={stale} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-2">
        <div className="lg:w-72 lg:shrink-0">{search}</div>
        <div className="min-w-0 lg:flex-1">
          <FilterBar label={t('filters')} wrapOnDesktop>
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
            {result}
            {toReview}
            {clear}
          </FilterBar>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 lg:gap-4">{tiles}</div>

      {filtered.length === 0 ? (
        empty
      ) : (
        <>
          {/* Phone: by month */}
          <div className="flex flex-col gap-6 lg:hidden">
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
                      <SessionRow
                        item={item}
                        latest={item.session.id === latestId}
                        onDelete={setToDelete}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {/* Desktop: one sortable table */}
          <div className="hidden lg:block">
            <SessionTable
              items={tableRows}
              sort={sort}
              onSort={onSort}
              explain={explain}
              onDelete={setToDelete}
            />
          </div>
        </>
      )}
      {items.length > 0 && <Fab href="/sessions/new" label={t('newSession')} />}

      <ConfirmDialog
        open={toDelete !== null}
        title={tDetail('deleteTitle')}
        confirmLabel={tDetail('deleteConfirm')}
        cancelLabel={tDetail('deleteCancel')}
        pending={deleting}
        onCancel={() => setToDelete(null)}
        onConfirm={() =>
          startDelete(async () => {
            if (!toDelete) return;
            const res = await deleteSession(toDelete.session.id);
            setToDelete(null);
            setDeleteFailed(!res.ok);
            if (res.ok) router.refresh();
          })
        }
      >
        {tDetail('deleteBody', { n: toDelete?.handCount ?? 0 })}
      </ConfirmDialog>
      {deleteFailed && (
        <p role="alert" className="text-center text-sm text-loss">
          {tDetail('deleteFailed')}
        </p>
      )}
    </main>
  );
}
