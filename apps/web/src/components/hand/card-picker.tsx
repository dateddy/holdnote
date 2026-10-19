'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { RANKS, SUITS } from 'poker-core';
import { CardKey } from '@/components/ui/card-key';
import { SUIT_SYMBOL } from './card-label';

type Props = {
  /** Cards that cannot be picked again (everything already on the table, but not this slot). */
  used: ReadonlySet<string>;
  canClear: boolean;
  onPick: (card: string) => void;
  onClear: () => void;
};

/** Rank row, four-colour suit row and a delete key. Remount (`key`) to forget the chosen rank. */
export function CardPicker({ used, canClear, onPick, onClear }: Props) {
  const t = useTranslations('hand');
  const [rank, setRank] = useState<string | null>(null);
  const rankFull = (r: string) => SUITS.every((s) => used.has(`${r}${s}`));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {RANKS.slice()
          .reverse()
          .map((r) => (
            <CardKey
              key={r}
              on={rank === r}
              disabled={rankFull(r)}
              onClick={() => setRank(r)}
              className="flex-none basis-[13%]"
            >
              {r}
            </CardKey>
          ))}
      </div>
      <div className="flex gap-1.5">
        {[...SUITS, '?'].map((s) => (
          <CardKey
            key={s}
            tall
            suit={s}
            disabled={!rank || used.has(`${rank}${s}`)}
            onClick={() => {
              if (!rank) return;
              onPick(`${rank}${s}`);
              setRank(null);
            }}
            aria-label={s === '?' ? t('unknownSuit') : s}
          >
            {SUIT_SYMBOL[s]}
          </CardKey>
        ))}
        <CardKey disabled={!canClear} onClick={onClear} aria-label={t('clearCard')}>
          ⌫
        </CardKey>
      </div>
    </div>
  );
}
