'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { RANKS, SUITS } from 'poker-core';
import { cardLabel, RED, SUIT_SYMBOL } from './card-label';

const BTN = 'h-11 min-w-0 flex-1 rounded-md border border-line bg-surface text-base';

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
          <button
            key={i}
            type="button"
            onClick={() => {
              setActive(i);
              setRank(null);
              setReopened(true);
            }}
            aria-pressed={active === i && showPicker}
            aria-label={labels[i]}
            className={`flex h-14 flex-col items-center justify-center rounded-md border text-lg ${
              active === i && showPicker ? 'border-accent bg-accent/15' : 'border-line bg-surface'
            }`}
          >
            {card ? cardLabel(card) : <span className="text-xs text-muted">{labels[i]}</span>}
          </button>
        ))}
      </div>

      {showPicker && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {RANKS.slice()
              .reverse()
              .map((r) => (
                <button
                  key={r}
                  type="button"
                  disabled={rankFull(r)}
                  aria-pressed={rank === r}
                  onClick={() => setRank(r)}
                  className={`${BTN} basis-[13%] ${rank === r ? 'bg-accent text-accent-foreground' : ''} disabled:opacity-30`}
                >
                  {r}
                </button>
              ))}
          </div>

          <div className="flex gap-1.5">
            {[...SUITS, '?'].map((s) => (
              <button
                key={s}
                type="button"
                disabled={!rank || used.has(`${rank}${s}`)}
                onClick={() => rank && place(`${rank}${s}`)}
                aria-label={s === '?' ? t('unknownSuit') : s}
                className={`${BTN} h-12 text-xl disabled:opacity-30 ${RED.has(s) ? 'text-loss' : ''}`}
              >
                {SUIT_SYMBOL[s]}
              </button>
            ))}
            <button
              type="button"
              disabled={!slots[active]}
              onClick={clear}
              aria-label={t('clearCard')}
              className={`${BTN} h-12 disabled:opacity-30`}
            >
              ⌫
            </button>
          </div>
        </>
      )}
    </div>
  );
}
