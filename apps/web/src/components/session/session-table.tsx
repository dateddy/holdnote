'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { sessionTotals } from 'poker-core';
import { InfoTip } from '@/components/ui/info-tip';
import { MoreMenu } from '@/components/ui/more-menu';
import { Result } from '@/components/ui/result';
import { SortHeader } from '@/components/ui/sort-header';
import { formatDay, signedNumber } from '@/lib/sessions/format';
import type { SessionListItem, SortColumn, SortDir } from '@/lib/sessions/list';
import { useSessionText } from './use-session-text';

type Props = {
  /** Rows in the chosen order. */
  items: SessionListItem[];
  sort: { col: SortColumn; dir: SortDir };
  onSort: (col: SortColumn) => void;
  explain: string;
  /** Asks the list to confirm and delete this session. */
  onDelete: (item: SessionListItem) => void;
};

/**
 * Desktop table of sessions (from 1024px). Every header sorts; the whole row opens the session,
 * and the last column has "⋯" (Sửa · Xóa).
 */
export function SessionTable({ items, sort, onSort, explain, onDelete }: Props) {
  const x = useSessionText();
  const { t, locale } = x;
  const tDetail = useTranslations('sessionDetail');
  const router = useRouter();

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
    <div className="relative overflow-x-auto rounded-md border border-line bg-surface">
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
            <th className="w-14 px-3 py-2">
              <span className="sr-only">{tDetail('more')}</span>
            </th>
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
                tabIndex={0}
                onClick={(e) => {
                  // A link or button inside the row (date, "⋯") does its own thing.
                  if ((e.target as HTMLElement).closest('a, button, [role="menu"]')) return;
                  router.push(x.href(item));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.target === e.currentTarget) router.push(x.href(item));
                }}
                className="cursor-pointer border-t border-line hover:bg-accent/10 focus-visible:bg-accent/10"
              >
                <td className="px-3 py-2 whitespace-nowrap">
                  <Link href={x.href(item)} className="underline-offset-4 hover:underline">
                    {formatDay(s.date, true)}
                  </Link>
                </td>
                <td className="px-3 py-2">{s.kind === 'mtt' ? t('kindMtt') : t('kindCash')}</td>
                <td className="max-w-48 truncate px-3 py-2">{s.venue ?? '–'}</td>
                <td className="px-3 py-2 whitespace-nowrap tabular-nums">{x.blindLabel(item)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                  {open ? (
                    <span className="text-xs text-muted">{t('notEnded')}</span>
                  ) : (
                    x.duration(item) || '–'
                  )}
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
                <td className="px-3 py-1 text-right">
                  <MoreMenu
                    label={tDetail('more')}
                    items={[
                      { key: 'edit', label: tDetail('menuEdit'), href: `/sessions/${s.id}/edit` },
                      {
                        key: 'delete',
                        label: tDetail('menuDelete'),
                        danger: true,
                        onSelect: () => onDelete(item),
                      },
                    ]}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
