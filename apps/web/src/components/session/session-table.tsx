'use client';

import Link from 'next/link';
import { sessionTotals } from 'poker-core';
import { InfoTip } from '@/components/ui/info-tip';
import { Result } from '@/components/ui/result';
import { SortHeader } from '@/components/ui/sort-header';
import { formatDay, signedNumber } from '@/lib/sessions/format';
import type { SessionListItem, SortColumn, SortDir } from '@/lib/sessions/list';
import { useSessionText } from './use-session-text';

type Props = {
  /** Open sessions first, then the rest in the chosen order. */
  items: SessionListItem[];
  sort: { col: SortColumn; dir: SortDir };
  onSort: (col: SortColumn) => void;
  explain: string;
};

/** Desktop table of sessions (from 1024px). Every header sorts. */
export function SessionTable({ items, sort, onSort, explain }: Props) {
  const x = useSessionText();
  const { t, locale } = x;

  const header = (col: SortColumn, label: string, align?: 'right', tip?: string) => (
    <SortHeader
      label={label}
      active={sort.col === col}
      dir={sort.dir}
      onSort={() => onSort(col)}
      align={align}
      tip={tip ? <InfoTip text={tip} label={explain} /> : undefined}
    />
  );

  return (
    <div className="overflow-x-auto rounded-md border border-line bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line">
            {header('date', t('colDate'))}
            {header('kind', t('colType'))}
            {header('venue', t('colVenue'))}
            {header('blind', t('colBlind'))}
            {header('duration', t('colDuration'), 'right')}
            {header('hands', t('colHands'), 'right')}
            {header('net', t('colNet'), 'right', t('tipNetCol'))}
            {header('bbPerHour', t('colRate'), 'right', t('tipRateCol'))}
            {header('review', t('colReview'), 'right', t('tipReview'))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const s = item.session;
            const open = !s.endAt;
            const net = x.net(item);
            const rate = sessionTotals([s]).bbPerHour;
            return (
              <tr
                key={s.id}
                className={`border-t border-line ${open ? 'bg-accent/10' : ''}`.trim()}
              >
                <td className="px-3 py-2 whitespace-nowrap">
                  <Link href={x.href(item)} className="underline-offset-4 hover:underline">
                    {formatDay(s.date, true)}
                  </Link>
                  {open && <span className="ml-2 text-xs text-accent">{t('playing')}</span>}
                </td>
                <td className="px-3 py-2">{s.kind === 'mtt' ? t('kindMtt') : t('kindCash')}</td>
                <td className="max-w-48 truncate px-3 py-2">{s.venue ?? '–'}</td>
                <td className="px-3 py-2 whitespace-nowrap tabular-nums">{x.blindLabel(item)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                  {open ? '' : x.duration(item) || '–'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{item.handCount}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {net ? (
                    net.bb != null ? (
                      <span className="flex flex-col items-end">
                        <Result value={net.bb}>{signedNumber(net.bb, locale)} bb</Result>
                        <span className="text-xs text-muted tabular-nums">
                          {net.money > 0 ? '+' : ''}
                          {x.money(net)}
                        </span>
                      </span>
                    ) : (
                      <span className="flex flex-col items-end">
                        <Result value={net.money}>
                          {net.money > 0 ? '+' : ''}
                          {x.money(net)}
                        </Result>
                        {x.rank(item) && <span className="text-xs text-muted">{x.rank(item)}</span>}
                      </span>
                    )
                  ) : (
                    '–'
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {rate == null ? '—' : <Result value={rate}>{signedNumber(rate, locale)}</Result>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {item.toReview > 0 ? item.toReview : '–'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
