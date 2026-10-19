'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { RANKS, SUITS, takenSuits } from 'poker-core';
import { CardKey } from '@/components/ui/card-key';
import { SUIT_SYMBOL } from './card-label';

type Props = {
  /** Cards that cannot be picked again (everything already on the table, but not this slot). */
  used: ReadonlySet<string>;
  canClear: boolean;
  onPick: (card: string) => void;
  onClear: () => void;
};

const DECK = RANKS.slice().reverse();
const ROW_1 = DECK.slice(0, 7); // A K Q J T 9 8
const ROW_2 = DECK.slice(7); // 7 6 5 4 3 2
const SUIT_ROW = ['h', 'd', 'c', 's', '?'] as const; // ♥ ♦ ♣ ♠ ? (⌫ follows)

/**
 * Interleaved keypad (48px keys, 4px gaps): seven ranks, six ranks indented 24px, then the four-colour
 * suits, `?` and delete. After a rank, suits already on the table are greyed. Remount (`key`) to
 * forget the chosen rank.
 */
export function CardPicker({ used, canClear, onPick, onClear }: Props) {
  const t = useTranslations('hand');
  const [rank, setRank] = useState<string | null>(null);
  const rankFull = (r: string) => SUITS.every((s) => used.has(`${r}${s}`));
  const taken = rank ? takenSuits(rank, used) : [];

  const rankKey = (r: string) => (
    <CardKey key={r} on={rank === r} disabled={rankFull(r)} onClick={() => setRank(r)}>
      {r}
    </CardKey>
  );

  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-7 gap-1">{ROW_1.map(rankKey)}</div>
      <div className="grid grid-cols-6 gap-1 px-6">{ROW_2.map(rankKey)}</div>
      <div className="grid grid-cols-6 gap-1">
        {SUIT_ROW.map((s) => (
          <CardKey
            key={s}
            kind="suit"
            suit={s}
            disabled={!rank || (s !== '?' && taken.includes(s))}
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
        <CardKey kind="action" disabled={!canClear} onClick={onClear} aria-label={t('clearCard')}>
          ⌫
        </CardKey>
      </div>
    </div>
  );
}
