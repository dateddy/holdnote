'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { BoardCheck, Street } from 'poker-core';
import { Card } from '@/components/ui/card';
import { CardSlot } from '@/components/ui/card-key';
import { Sheet } from '@/components/ui/sheet';
import { CardPicker } from './card-picker';
import { cardLabel } from './card-label';

/** Board slots 0..4 of each street. */
const STREET_SLOTS: Record<Street, readonly number[]> = {
  preflop: [],
  flop: [0, 1, 2],
  turn: [3],
  river: [4],
};

type Props = {
  /** The five board cards, `''` when empty. */
  slots: string[];
  /** Slot states from the betting; null = all open (shorthand mode, no betting to follow). */
  check: BoardCheck | null;
  /** Cards used elsewhere in the hand (hero, opponent). */
  blocked: string[];
  /** The street tab that is selected: its slots get an outline. */
  highlight: Street | null;
  onChange: (slots: string[]) => void;
};

/** Five slots in a row: Flop (3) | Turn | River. Tap a slot to pick its card; the next open slot follows. */
export function BoardCard({ slots, check, blocked, highlight, onChange }: Props) {
  const t = useTranslations('hand');
  const tr = useTranslations('record');
  const [active, setActive] = useState<number | null>(null);

  const stateOf = (i: number) => check?.slots[i] ?? 'open';
  const lit = new Set(highlight ? STREET_SLOTS[highlight] : []);
  const used = new Set([
    ...blocked.filter((c) => c && !c.endsWith('?')),
    ...slots.filter((c, i) => c && i !== active && !c.endsWith('?')),
  ]);

  function pick(card: string) {
    if (active === null) return;
    const next = [...slots];
    next[active] = card;
    onChange(next);
    // On to the next open slot that is still empty; close when there is none.
    const following = next.findIndex((c, i) => i > active && !c && stateOf(i) !== 'locked');
    setActive(following >= 0 ? following : null);
  }

  const group = (title: string, indexes: readonly number[]) => (
    <div className="space-y-1" style={{ flex: indexes.length }}>
      <p className="text-center text-xs text-muted">{title}</p>
      <div className="flex gap-1">
        {indexes.map((i) => {
          const s = stateOf(i);
          return (
            <CardSlot
              key={i}
              compact
              className="min-w-0 flex-1"
              disabled={s === 'locked'}
              highlight={lit.has(i)}
              {...((s === 'missing' || s === 'extra') && { state: s })}
              aria-label={`${title} ${indexes.indexOf(i) + 1}`}
              onClick={() => setActive(i)}
            >
              {slots[i] ? cardLabel(slots[i], 'sm') : null}
            </CardSlot>
          );
        })}
      </div>
    </div>
  );

  return (
    <Card tight>
      <h2 className="sr-only">{t('board')}</h2>
      <div className="flex items-end gap-2">
        {group(t('flop'), [0, 1, 2])}
        <div aria-hidden className="h-12 w-px shrink-0 bg-line" />
        {group(t('turn'), [3])}
        <div aria-hidden className="h-12 w-px shrink-0 bg-line" />
        {group(t('river'), [4])}
      </div>
      <Sheet
        open={active !== null}
        onClose={() => setActive(null)}
        title={tr('pickBoardCard')}
        closeLabel={tr('close')}
      >
        {active !== null && (
          <CardPicker
            key={active}
            used={used}
            canClear={Boolean(slots[active])}
            onPick={pick}
            onClear={() => {
              const next = [...slots];
              next[active] = '';
              onChange(next);
            }}
          />
        )}
      </Sheet>
    </Card>
  );
}
