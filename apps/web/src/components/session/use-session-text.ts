'use client';

import { useLocale, useTranslations } from 'next-intl';
import { sessionHours } from 'poker-core';
import { compactAmount, formatDuration, formatMoney } from '@/lib/sessions/format';
import { sessionNet, type Net, type SessionListItem } from '@/lib/sessions/list';

/** Texts of a session in the list, shared by the phone row and the desktop table. */
export function useSessionText() {
  const t = useTranslations('sessionList');
  const locale = useLocale();

  return {
    t,
    locale,
    /** "Cash 25/50" or "MTT 500k". */
    typeLabel(item: SessionListItem): string {
      const s = item.session;
      return s.kind === 'mtt'
        ? t('mttType', { buyin: s.buyin == null ? '–' : compactAmount(s.buyin) })
        : t('cashType', { stake: s.stakeLabel ?? compactAmount(s.bb) });
    },
    /** Blind or buy-in column: "25/50" or "500k". */
    blindLabel(item: SessionListItem): string {
      const s = item.session;
      if (s.kind === 'mtt') return s.buyin == null ? '–' : compactAmount(s.buyin);
      return s.stakeLabel ?? compactAmount(s.bb);
    },
    duration(item: SessionListItem): string {
      return formatDuration(sessionHours(item.session));
    },
    /** "Hạng 12/180", or empty when the place was not entered. */
    rank(item: SessionListItem): string {
      const m = item.session.mtt;
      if (item.session.kind !== 'mtt' || m?.place == null) return '';
      return m.entries == null
        ? t('rankOnly', { place: m.place })
        : t('rank', { place: m.place, entries: m.entries });
    },
    href(item: SessionListItem): string {
      const s = item.session;
      if (s.endAt) return `/sessions/${s.id}`;
      return s.startAt ? `/sessions/${s.id}/record` : `/sessions/${s.id}/before`;
    },
    money(net: Net): string {
      return formatMoney(net.money, net.currency, locale);
    },
    net(item: SessionListItem): Net | null {
      return sessionNet(item);
    },
  };
}
