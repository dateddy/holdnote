'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { fromLocalInput, toLocalInput } from '@/lib/sessions/end-time';
import type { SessionListItem } from '@/lib/sessions/list';
import { useSessionText } from './use-session-text';

export type StaleEntry = { item: SessionListItem; suggestedEnd: string };

/** One reminder per session left open over 16 hours: pick the time you left, then end it. */
export function StaleSessions({ entries }: { entries: StaleEntry[] }) {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const shown = entries.filter((e) => !hidden.has(e.item.session.id));
  if (shown.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {shown.map((e) => (
        <StaleCard
          key={e.item.session.id}
          entry={e}
          onLater={() => setHidden((h) => new Set(h).add(e.item.session.id))}
        />
      ))}
    </div>
  );
}

function StaleCard({ entry, onLater }: { entry: StaleEntry; onLater: () => void }) {
  const x = useSessionText();
  const { t, locale } = x;
  const { item, suggestedEnd } = entry;
  const [value, setValue] = useState(toLocalInput(suggestedEnd));
  const iso = fromLocalInput(value);
  const since = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(item.session.startAt ?? item.session.date),
  );
  const href = `/sessions/${item.session.id}/end${iso ? `?endAt=${encodeURIComponent(iso)}` : ''}`;

  return (
    <Card>
      <h2 className="text-base font-medium">{t('staleTitle')}</h2>
      <p className="text-sm text-muted">
        {t('staleBody', {
          what: [item.session.venue, x.typeLabel(item)].filter(Boolean).join(' · '),
          since,
        })}
      </p>
      <label className="flex flex-col gap-1 text-sm">
        {t('staleEndAt')}
        <Input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      <div className="flex gap-2">
        <Link href={href} className={buttonClass({ full: false })}>
          {t('staleEnd')}
        </Link>
        <Button variant="ghost" full={false} onClick={onLater}>
          {t('staleLater')}
        </Button>
      </div>
    </Card>
  );
}
