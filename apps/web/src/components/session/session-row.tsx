'use client';

import Link from 'next/link';
import { Result } from '@/components/ui/result';
import { formatDay, signedNumber } from '@/lib/sessions/format';
import type { SessionListItem } from '@/lib/sessions/list';
import { useSessionText } from './use-session-text';

/**
 * One session on the phone: date · venue · type, then length · hands · to review; net on the right.
 * A session still open is the same row with an accent border and the word "Đang chơi".
 */
export function SessionRow({ item }: { item: SessionListItem }) {
  const x = useSessionText();
  const { t, locale } = x;
  const s = item.session;
  const open = !s.endAt;
  const net = x.net(item);

  const line1 = [formatDay(s.date, false), s.venue, x.typeLabel(item)].filter(Boolean).join(' · ');
  const line2 = [
    open ? null : x.duration(item),
    t('hands', { n: item.handCount }),
    item.toReview > 0 ? t('reviewCount', { n: item.toReview }) : null,
    x.rank(item),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link
      href={x.href(item)}
      className={`flex min-h-16 items-center justify-between gap-3 p-3 ${
        open ? 'rounded-md border border-accent bg-surface' : ''
      }`}
    >
      <span className="min-w-0 space-y-1">
        <span className="block truncate text-base">{line1}</span>
        <span className="block truncate text-xs text-muted">{line2}</span>
      </span>
      <span className="shrink-0 space-y-1 text-right">
        {open && <span className="block text-sm font-medium text-accent">{t('playing')}</span>}
        {net && (
          <>
            {net.bb != null && (
              <span className="block text-base">
                <Result value={net.bb}>{signedNumber(net.bb, locale)} bb</Result>
              </span>
            )}
            <span className={`block tabular-nums ${net.bb == null ? 'text-base' : 'text-xs'}`}>
              {net.bb == null ? (
                <Result value={net.money}>
                  {net.money > 0 ? '+' : ''}
                  {x.money(net)}
                </Result>
              ) : (
                <span className="text-muted">
                  {net.money > 0 ? '+' : ''}
                  {x.money(net)}
                </span>
              )}
            </span>
          </>
        )}
      </span>
    </Link>
  );
}
