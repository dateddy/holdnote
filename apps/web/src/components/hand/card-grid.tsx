'use client';

import { useState } from 'react';
import { CardSlot } from '@/components/ui/card-key';
import { CardPicker } from './card-picker';
import { cardLabel } from './card-label';

type Props = {
  slots: string[];
  onChange: (slots: string[]) => void;
  /** One short label per slot, shown while the slot is empty. */
  labels: string[];
  /** Cards already used elsewhere in the hand; they cannot be picked again. */
  blocked?: string[];
  ariaLabel: string;
};

/** A row of card slots sharing one picker; the picker shows while a slot is empty. */
export function CardGrid({ slots, onChange, labels, blocked = [], ariaLabel }: Props) {
  const [active, setActive] = useState(0);
  // Tapping a filled slot reopens the picker; it closes again after the next card is placed.
  const [reopened, setReopened] = useState(false);
  const showPicker = reopened || slots.some((c) => !c);

  const used = new Set([
    ...blocked.filter((c) => c && !c.endsWith('?')),
    ...slots.filter((c, i) => c && i !== active && !c.endsWith('?')),
  ]);

  const place = (card: string) => {
    const next = [...slots];
    next[active] = card;
    onChange(next);
    setReopened(false);
    // Jump to the next empty slot after this one.
    const following = next.findIndex((c, i) => i > active && !c);
    if (following >= 0) setActive(following);
  };

  const clear = () => {
    const next = [...slots];
    next[active] = '';
    onChange(next);
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
              setReopened(true);
            }}
          >
            {card ? cardLabel(card) : <span className="text-xs text-muted">{labels[i]}</span>}
          </CardSlot>
        ))}
      </div>

      {showPicker && (
        <CardPicker
          key={active}
          used={used}
          canClear={Boolean(slots[active])}
          onPick={place}
          onClear={clear}
        />
      )}
    </div>
  );
}
