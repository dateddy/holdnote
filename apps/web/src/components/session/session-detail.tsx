'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { deleteSession } from '@/app/(app)/sessions/actions';
import { setHandFlag } from '@/app/(app)/hands/actions';
import { HandSummary } from '@/components/hand/hand-summary';
import { HandRow } from '@/components/hand-list/hand-row';
import { HandTable } from '@/components/hand-list/hand-table';
import { useHandText } from '@/components/hand-list/use-hand-text';
import { Button, buttonClass } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { ChipMenu } from '@/components/ui/chip-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FilterBar } from '@/components/ui/filter-bar';
import { MoreMenu } from '@/components/ui/more-menu';
import { Result } from '@/components/ui/result';
import { StatTile } from '@/components/ui/stat-tile';
import { TopBar } from '@/components/ui/top-bar';
import {
  EMPTY_HAND_FILTER,
  filterHandRows,
  handOptions,
  isHandFiltering,
  POT_TYPES,
  serializeHandFilter,
  sortHandRows,
  type HandListFilter,
  type HandRow as HandRowData,
} from '@/lib/hands/session-hands';
import type { CashTiles, MttTiles, SessionStage } from '@/lib/sessions/detail';
import { compactAmount, formatDuration, formatMoney, signedNumber } from '@/lib/sessions/format';

type Props = {
  session: {
    id: string;
    kind: 'cash' | 'mtt';
    title: string;
    subtitle: string;
    currency: string;
  };
  stage: SessionStage;
  tiles: CashTiles | MttTiles;
  rows: HandRowData[];
  initialFilter: HandListFilter;
};

const isTyping = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
};

/** One session: tiles, the buttons for its stage, and the hands (list on phone, table + panel on desktop). */
export function SessionDetail({ session, stage, tiles, rows: initialRows, initialFilter }: Props) {
  const t = useTranslations('sessionDetail');
  const tCommon = useTranslations('common');
  const tList = useTranslations('handList');
  const x = useHandText();
  const locale = useLocale();
  const router = useRouter();
  const id = session.id;

  const [rows, setRows] = useState(initialRows);
  const [filter, setFilter] = useState(initialFilter);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, startDelete] = useTransition();
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [, startFlag] = useTransition();

  const update = (patch: Partial<HandListFilter>) => {
    const next = { ...filter, ...patch };
    setFilter(next);
    // Keep the filter in the address so Back and reload come back to the same list.
    const qs = serializeHandFilter(next);
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  };

  const options = useMemo(() => handOptions(rows), [rows]);
  const shown = useMemo(
    () => sortHandRows(filterHandRows(rows, filter), filter.sort),
    [rows, filter],
  );
  const active = shown.find((r) => r.id === selected) ?? shown[0] ?? null;
  const qs = serializeHandFilter(filter);
  const hrefOf = (handId: string) => `/hands/${handId}${qs ? `?${qs}` : ''}`;

  const toggleFlag = useCallback((row: HandRowData) => {
    const flagged = !row.flagged;
    const apply = (value: boolean) =>
      setRows((all) =>
        all.map((r) =>
          r.id === row.id ? { ...r, flagged: value, needsReview: value && !r.accepted } : r,
        ),
      );
    apply(flagged);
    startFlag(async () => {
      const res = await setHandFlag(row.id, flagged);
      if (!res.ok) apply(row.flagged);
    });
  }, []);

  // Desktop keys: ↑ ↓ move through the hands, R flags the open one for review.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      if (!window.matchMedia('(min-width: 1024px)').matches || !active) return;
      const at = shown.findIndex((r) => r.id === active.id);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const next = shown[at + (e.key === 'ArrowDown' ? 1 : -1)];
        if (next) {
          e.preventDefault();
          setSelected(next.id);
          document
            .querySelector(`[data-hand-id="${next.id}"]`)
            ?.scrollIntoView({ block: 'nearest' });
        }
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        toggleFlag(active);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, shown, toggleFlag]);

  const explain = tCommon('explain');
  const num1 = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n);
  const money = (n: number) => formatMoney(n, session.currency, locale);
  const signedMoney = (n: number) => `${n > 0 ? '+' : ''}${money(n)}`;

  const tileNodes =
    tiles.kind === 'cash' ? (
      <>
        <StatTile
          label={t('tileTime')}
          tip={{ text: t('tipTime'), label: explain }}
          sub={t('handsCount', { n: tiles.hands })}
        >
          {tiles.hours == null ? '—' : formatDuration(tiles.hours)}
        </StatTile>
        <StatTile
          label={t('tileNet')}
          tip={{ text: t('tipNetCash'), label: explain }}
          sub={tiles.net ? signedMoney(tiles.net.money) : undefined}
        >
          {tiles.net == null ? (
            '—'
          ) : (
            <Result value={tiles.net.bb}>{signedNumber(tiles.net.bb, locale)} bb</Result>
          )}
        </StatTile>
        <StatTile label={t('tileRate')} tip={{ text: t('tipRate'), label: explain }}>
          {tiles.rate == null ? (
            '—'
          ) : (
            <Result value={tiles.rate}>{signedNumber(tiles.rate, locale)}</Result>
          )}
        </StatTile>
        <StatTile label={t('tileReview')} tip={{ text: t('tipReview'), label: explain }}>
          {tiles.toReview}
        </StatTile>
      </>
    ) : (
      <>
        <StatTile
          label={t('tileBuyin')}
          tip={{ text: t('tipBuyin'), label: explain }}
          sub={tiles.reentries > 0 ? t('reentries', { n: tiles.reentries }) : undefined}
        >
          {tiles.buyin == null ? '—' : compactAmount(tiles.buyin)}
        </StatTile>
        <StatTile label={t('tileRank')} tip={{ text: t('tipRank'), label: explain }}>
          {tiles.place == null
            ? '—'
            : tiles.entries == null
              ? tiles.place
              : t('rankOf', { place: tiles.place, entries: tiles.entries })}
        </StatTile>
        <StatTile
          label={t('tilePrize')}
          tip={{ text: t('tipPrize'), label: explain }}
          sub={tiles.bounty ? t('bounty', { amount: money(tiles.bounty) }) : undefined}
        >
          {tiles.prize == null ? '—' : <Result value={tiles.prize}>{money(tiles.prize)}</Result>}
        </StatTile>
        <StatTile label={t('tileReview')} tip={{ text: t('tipReview'), label: explain }}>
          {tiles.toReview}
        </StatTile>
      </>
    );

  const menu = (
    <MoreMenu
      label={t('more')}
      items={[
        { key: 'edit', label: t('menuEdit'), href: `/sessions/${id}/edit` },
        ...(session.kind === 'mtt'
          ? [
              {
                key: 'structure',
                label: t('menuStructure'),
                href: `/sessions/${id}/structure?from=session`,
              },
            ]
          : []),
        {
          key: 'delete',
          label: t('menuDelete'),
          danger: true,
          onSelect: () => setConfirming(true),
        },
      ]}
    />
  );

  const buttons = (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
      {stage === 'notStarted' && (
        <Link href={`/sessions/${id}/before`} className={buttonClass({ size: 'lg', full: false })}>
          {t('goBefore')}
        </Link>
      )}
      {stage === 'playing' && (
        <>
          <Link
            href={`/sessions/${id}/record`}
            className={buttonClass({ size: 'lg', full: false })}
          >
            {t('recordHand')}
          </Link>
          <Link
            href={`/sessions/${id}/end`}
            className={buttonClass({ variant: 'secondary', full: false })}
          >
            {t('endSession')}
          </Link>
        </>
      )}
      {stage === 'ended' && (
        <Link href={`/sessions/${id}/summary`} className={buttonClass({ size: 'lg', full: false })}>
          {t('goSummary')}
        </Link>
      )}
      {stage === 'summarized' && (
        <>
          <Link
            href={`/sessions/${id}/summary`}
            className={buttonClass({ variant: 'secondary', full: false })}
          >
            {t('viewSummary')}
          </Link>
          <Link
            href={`/sessions/${id}/record`}
            className={buttonClass({ variant: 'secondary', full: false })}
          >
            {t('recordMore')}
          </Link>
        </>
      )}
    </div>
  );

  const filterBar = (
    <FilterBar label={t('filters')}>
      <Chip on={filter.review} onClick={() => update({ review: !filter.review })}>
        {t('fReview')}
      </Chip>
      <Chip on={filter.showdown} onClick={() => update({ showdown: !filter.showdown })}>
        {t('fShowdown')}
      </Chip>
      <ChipMenu
        label={t('fPos')}
        value={filter.pos}
        options={options.positions.map((p) => ({ value: p, label: p }))}
        allLabel={t('all')}
        onChange={(pos) => update({ pos })}
      />
      <ChipMenu
        label={t('fPot')}
        value={filter.pot}
        options={POT_TYPES.map((p) => ({ value: p, label: tList(`pot_${p}`) }))}
        allLabel={t('all')}
        onChange={(pot) => update({ pot: pot as HandListFilter['pot'] })}
      />
      {session.kind === 'mtt' && (
        <ChipMenu
          label={t('fStage')}
          value={filter.stage}
          options={options.stages.map((s) => ({ value: s, label: x.stage(s) }))}
          allLabel={t('all')}
          onChange={(stage) => update({ stage })}
        />
      )}
      <ChipMenu
        label={t('fSort')}
        value={filter.sort === 'latest' ? '' : filter.sort}
        options={[
          { value: 'won', label: t('sortWon') },
          { value: 'lost', label: t('sortLost') },
          { value: 'pot', label: t('sortPot') },
        ]}
        allLabel={t('sortLatest')}
        onChange={(sort) => update({ sort: (sort || 'latest') as HandListFilter['sort'] })}
      />
      {isHandFiltering(filter) && (
        <Button
          variant="ghost"
          full={false}
          onClick={() => update({ ...EMPTY_HAND_FILTER, sort: filter.sort })}
        >
          {t('clear')}
        </Button>
      )}
    </FilterBar>
  );

  const empty = (
    <Card>
      <p className="text-sm text-muted">{rows.length === 0 ? t('noHands') : t('noMatch')}</p>
    </Card>
  );

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-6 lg:max-w-none">
      <TopBar
        title={session.title}
        subtitle={session.subtitle}
        back={{ href: '/', label: tCommon('back') }}
        action={menu}
      />

      <div className="grid auto-rows-fr grid-cols-2 gap-2 lg:grid-cols-4">{tileNodes}</div>
      {buttons}
      {filterBar}

      {shown.length === 0 ? (
        empty
      ) : (
        <>
          {/* Phone */}
          <ul className="divide-y divide-line rounded-md border border-line bg-surface lg:hidden">
            {shown.map((r) => (
              <li key={r.id}>
                <HandRow row={r} href={hrefOf(r.id)} />
              </li>
            ))}
          </ul>

          {/* Desktop: table, with the open hand in a panel on the right */}
          <div className="hidden items-start gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem]">
            <HandTable rows={shown} selectedId={active?.id ?? null} onSelect={setSelected} />
            {active && (
              <aside className="sticky top-6 flex max-h-[calc(100vh-3rem)] flex-col gap-3 overflow-y-auto">
                <HandSummary
                  heroCards={active.heroCards}
                  board={active.board}
                  heroPos={active.heroPos ?? ''}
                  villPos={active.villPos ?? ''}
                  steps={active.steps}
                  result={
                    active.result == null || active.resultBb == null
                      ? null
                      : {
                          value: active.result,
                          text: `${signedNumber(active.resultBb, locale)} bb`,
                        }
                  }
                  eff={
                    active.eff ? `${money(active.eff.amount)} (${num1(active.eff.bb)} bb)` : null
                  }
                  thought={active.thought}
                  flagged={active.flagged}
                  money={money}
                />
                <div className="flex gap-2">
                  <Link
                    href={hrefOf(active.id)}
                    className={buttonClass({ variant: 'secondary', full: false })}
                  >
                    {tList('open')}
                  </Link>
                  <Button variant="secondary" full={false} onClick={() => toggleFlag(active)}>
                    {tList('flag')}
                  </Button>
                </div>
              </aside>
            )}
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirming}
        title={t('deleteTitle')}
        confirmLabel={t('deleteConfirm')}
        cancelLabel={t('deleteCancel')}
        pending={deleting}
        onCancel={() => setConfirming(false)}
        onConfirm={() =>
          startDelete(async () => {
            const res = await deleteSession(id);
            if (res.ok) router.replace('/');
            else {
              setDeleteFailed(true);
              setConfirming(false);
            }
          })
        }
      >
        {t('deleteBody', { n: rows.length })}
      </ConfirmDialog>
      {deleteFailed && (
        <p role="alert" className="text-center text-sm text-loss">
          {t('deleteFailed')}
        </p>
      )}
    </main>
  );
}
