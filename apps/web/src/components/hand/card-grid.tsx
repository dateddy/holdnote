'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { RANKS, SUITS } from 'poker-core';
import { SLOT_COUNT } from '@/lib/hands/build';

const SUIT_SYMBOL: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣', '?': '?' };
const RED = new Set(['h', 'd']);

export const cardLabel = (card: string) => {
  const suit = card.slice(1);
  return (
    <span className={RED.has(suit) ? 'text-red-600' : undefined}>
      {card.slice(0, 1)}
      {SUIT_SYMBOL[suit] ?? ''}
    </span>
  );
};

const BTN = 'h-11 min-w-0 flex-1 rounded-md border border-current/20 text-base';

/** Seven card slots (2 hero, flop, turn, river) sharing one rank + suit picker. */
export function CardGrid({
  slots,
  onChange,
}: {
  slots: string[];
  onChange: (slots: string[]) => void;
}) {
  const t = useTranslations('hand');
  const [active, setActive] = useState(0);
  const [rank, setRank] = useState<string | null>(null);

  const used = new Set(slots.filter((c, i) => c && i !== active && !c.endsWith('?')));
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
    // Jump to the next empty slot after this one.
    const following = [...Array(SLOT_COUNT).keys()].find((i) => i > active && !next[i]);
    if (following !== undefined) setActive(following);
  };

  const label = (i: number) =>
    i < 2
      ? t(i === 0 ? 'slotHero1' : 'slotHero2')
      : [t('flop'), t('flop'), t('flop'), t('turn'), t('river')][i - 2];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-7 gap-1.5" role="group" aria-label={t('cards')}>
        {slots.map((card, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              setActive(i);
              setRank(null);
            }}
            aria-pressed={active === i}
            aria-label={label(i)}
            className={`flex h-14 flex-col items-center justify-center rounded-md border text-lg ${
              active === i ? 'border-foreground bg-foreground/10' : 'border-current/20'
            } ${i === 2 ? 'ml-2' : ''}`}
          >
            {card ? cardLabel(card) : <span className="text-xs opacity-50">{label(i)}</span>}
          </button>
        ))}
      </div>

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
              className={`${BTN} basis-[13%] ${rank === r ? 'bg-foreground text-background' : ''} disabled:opacity-30`}
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
            className={`${BTN} h-12 text-xl disabled:opacity-30 ${RED.has(s) ? 'text-red-600' : ''}`}
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
    </div>
  );
}
