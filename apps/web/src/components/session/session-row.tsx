'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';
import { MoreMenu } from '@/components/ui/more-menu';
import { Result } from '@/components/ui/result';
import { formatDay, signedNumber } from '@/lib/sessions/format';
import type { SessionListItem } from '@/lib/sessions/list';
import { useSessionText } from './use-session-text';

type Props = {
  item: SessionListItem;
  /** The newest session: it gets the "+ Hand" button that goes straight to the table. */
  latest?: boolean;
  /** Asks the list to confirm and delete this session. */
  onDelete: (item: SessionListItem) => void;
};

/**
 * One session on the phone: date · venue · type, then length · hands · to review; net on the right,
 * and "⋯" (Sửa · Xóa). A session without an end time says "Chưa kết thúc" in small text, nothing more.
 */
export function SessionRow({ item, latest = false, onDelete }: Props) {
  const x = useSessionText();
  const { t, locale } = x;
  const tDetail = useTranslations('sessionDetail');
  const s = item.session;
  const net = x.net(item);

  const line1 = [formatDay(s.date, false), s.venue, x.typeLabel(item)].filter(Boolean).join(' · ');
  const line2 = [
    s.endAt ? x.duration(item) : t('notEnded'),
    t('hands', { n: item.handCount }),
    item.toReview > 0 ? t('reviewCount', { n: item.toReview }) : null,
    x.rank(item),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div>
      <div className="flex items-center gap-1 pr-2">
        <Link
          href={x.href(item)}
          className="flex min-h-16 min-w-0 flex-1 items-center justify-between gap-3 p-3"
        >
          <span className="min-w-0 space-y-1">
            <span className="block truncate text-base">{line1}</span>
            <span className="block truncate text-xs text-muted">{line2}</span>
          </span>
          <span className="shrink-0 space-y-1 text-right">
            {net && (
              <>
                {net.bb != null && (
                  <span className="block text-base">
                    <Result value={net.bb}>{signedNumber(net.bb, locale)} bb</Result>
                  </span>
                )}
                <span className={`block tabular-nums ${net.bb == null ? 'text-base' : 'text-xs'}`}>
                  {net.bb == null ? (
                    <Result value={net.money}>{x.moneyWithRate(net)}</Result>
                  ) : (
                    <span className="text-muted">{x.moneyWithRate(net)}</span>
                  )}
                </span>
              </>
            )}
          </span>
        </Link>
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
      </div>
      {latest && (
        <div className="px-3 pb-3">
          <Link
            href={`/sessions/${s.id}/record`}
            className={buttonClass({ variant: 'secondary', full: false })}
          >
            {t('addHand')}
          </Link>
        </div>
      )}
    </div>
  );
}
