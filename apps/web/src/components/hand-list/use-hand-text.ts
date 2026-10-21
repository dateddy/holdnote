'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { ActionChip } from 'poker-core';
import { opponentLabel } from '@/lib/hands/labels';
import type { HandRow } from '@/lib/hands/session-hands';
import { signedNumber } from '@/lib/sessions/format';

/** Texts of a hand row, shared by the phone row, the desktop table and the chip lists. */
export function useHandText() {
  const t = useTranslations('handList');
  const tHand = useTranslations('hand');
  const tRecord = useTranslations('record');
  const locale = useLocale();

  /** Stage code (`bubble`) as words; an unknown code is shown as it is. */
  const stageLabel = (code: string): string => {
    const key = `stage_${code}` as 'stage_early';
    return tRecord.has(key) ? tRecord(key) : code;
  };

  return {
    t,
    tHand,
    locale,
    /** "MP vs BTN", or "MP vs 2 opponents" once the pot was multiway. */
    seats(row: HandRow): string {
      const villain =
        row.opponents >= 2 ? t('multiway', { n: row.opponents }) : (row.villPos ?? '');
      return [row.heroPos, villain].filter(Boolean).length === 2
        ? t('vs', { hero: row.heroPos!, villain })
        : (row.heroPos ?? villain);
    },
    /** Who acted: "Mình", "Đối thủ" ("Đối thủ · BTN" in a multiway pot) or the seat. */
    who(chip: ActionChip, row: HandRow): string {
      if (chip.actor === 'hero') return tHand('hero');
      if (chip.actor === 'villain') {
        return opponentLabel(tHand('villain'), chip.pos ?? row.villPos ?? '', row.opponents);
      }
      return chip.pos ?? chip.who ?? '?';
    },
    what(chip: ActionChip): string {
      return chip.act === 'raise' && chip.verb === 'open'
        ? tRecord('act_open')
        : tHand(`act_${chip.act}`);
    },
    bb(n: number | null): string {
      return n == null ? '—' : `${signedNumber(n, locale)} bb`;
    },
    potSize(row: HandRow): string {
      return row.potBb == null
        ? '—'
        : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(row.potBb)} bb`;
    },
    stage: stageLabel,
    /** "Lv 8 · Bubble" for a tournament hand, else empty. */
    levelStage(row: HandRow): string {
      return [
        row.level != null ? t('level', { n: row.level }) : null,
        row.stage ? stageLabel(row.stage) : null,
      ]
        .filter(Boolean)
        .join(' · ');
    },
  };
}
