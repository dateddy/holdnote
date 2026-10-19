'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { RANKS, SUITS } from 'poker-core';
import { CardKey, CardSlot } from '@/components/ui/card-key';
import { cardLabel, SUIT_SYMBOL } from './card-label';

type Props = {
  slots: string[];
  onChange: (slots: string[]) => void;
  /** One short label per slot, shown while the slot is empty. */
  labels: string[];
  /** Cards already used elsewhere in the hand; they cannot be picked again. */
  blocked?: string[];
  ariaLabel: string;
};

/** A row of card slots sharing one rank + suit picker; the picker shows while a slot is empty. */
export function CardGrid({ slots, onChange, labels, blocked = [], ariaLabel }: Props) {
  const t = useTranslations('hand');
  const [active, setActive] = useState(0);
  const [rank, setRank] = useState<string | null>(null);
  // Tapping a filled slot reopens the picker; it closes again after the next card is placed.
  const [reopened, setReopened] = useState(false);
  const showPicker = reopened || slots.some((c) => !c);

  const used = new Set([
    ...blocked.filter((c) => c && !c.endsWith('?')),
    ...slots.filter((c, i) => c && i !== active && !c.endsWith('?')),
  ]);
  const rankFull = (r: string) => SUITS.every((s) => used.has(`${r}${s}`));

  const clear = () => {
    const next = [...slots];
    next[active] = '';
    onChange(next);
    setRank(null);
  };

  const place = (card: string) => {
    const next = [...slots];
    next[active] = card;
    onChange(next);
    setRank(null);
    setReopened(false);
    // Jump to the next empty slot after this one.
    const following = next.findIndex((c, i) => i > active && !c);
    if (following >= 0) setActive(following);
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${slots.length}, minmax(0, 1fr))` }}
        role="group"
        aria-label={ariaLabel}
      >
        {slots.map((card, i) => (
          <CardSlot
            key={i}
            on={active === i && showPicker}
            aria-label={labels[i]}
            onClick={() => {
              setActive(i);
              setRank(null);
              setReopened(true);
            }}
          >
            {card ? cardLabel(card) : <span className="text-xs text-muted">{labels[i]}</span>}
          </CardSlot>
        ))}
      </div>

      {showPicker && (
        <>
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
                onClick={() => rank && place(`${rank}${s}`)}
                aria-label={s === '?' ? t('unknownSuit') : s}
              >
                {SUIT_SYMBOL[s]}
              </CardKey>
            ))}
            <CardKey disabled={!slots[active]} onClick={clear} aria-label={t('clearCard')}>
              ⌫
            </CardKey>
          </div>
        </>
      )}
    </div>
  );
}
