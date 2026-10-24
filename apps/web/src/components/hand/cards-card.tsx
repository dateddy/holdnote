'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { duplicateCards, type BoardCheck, type Street } from 'poker-core';
import { Card } from '@/components/ui/card';
import { CardSlot } from '@/components/ui/card-key';
import { Collapse } from '@/components/ui/collapse';
import { revealAboveBar } from '@/lib/hands/reveal';
import { cardEntry, isTypingTarget } from '@/lib/hands/shortcuts';
import { CardPicker } from './card-picker';
import { cardLabel } from './card-label';

/** Slots 0-1 are hero's, 2-4 the flop, 5 the turn, 6 the river. */
const STREET_SLOTS: Record<Street, readonly number[]> = {
  preflop: [],
  flop: [2, 3, 4],
  turn: [5],
  river: [6],
};
const HERO = [0, 1] as const;

type Props = {
  /** The seven slots, `''` when empty. */
  slots: string[];
  /** Board slot states from the betting; null = all open (shorthand mode, no betting to follow). */
  check: BoardCheck | null;
  /** Cards used elsewhere in the hand (the opponent's). */
  blocked: string[];
  /** The street tab that is selected: its slots get an outline. */
  highlight: Street | null;
  onChange: (slots: string[]) => void;
  /** The picker opened (true) or closed (false). */
  onPicking: (picking: boolean) => void;
};

/**
 * One card with seven slots: hero (2) | flop (3) | turn | river. Tap a slot and the picker slides
 * open inside the card; the next empty slot follows after each card. Tapping outside closes it.
 */
export function CardsCard({ slots, check, blocked, highlight, onChange, onPicking }: Props) {
  const t = useTranslations('hand');
  const tr = useTranslations('record');
  const [active, setActive] = useState<number | null>(null);
  const root = useRef<HTMLElement>(null);
  const pickerArea = useRef<HTMLDivElement>(null);

  const open = (i: number | null) => {
    setActive(i);
    onPicking(i !== null);
  };

  // Tap outside the card: close. Scroll the keypad into view when it opens.
  useEffect(() => {
    if (active === null) return;
    const close = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) {
        setActive(null);
        onPicking(false);
      }
    };
    document.addEventListener('pointerdown', close);
    // After the 150ms slide, when the keypad has its full height.
    const timer = setTimeout(() => revealAboveBar(pickerArea.current), 180);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', close);
    };
  }, [active, onPicking]);

  const stateOf = (i: number) => (i < 2 ? 'open' : (check?.slots[i - 2] ?? 'open'));
  const duplicates = new Set(duplicateCards(slots));
  const lit = new Set(highlight ? STREET_SLOTS[highlight] : []);
  const used = new Set([
    ...blocked.filter((c) => c && !c.endsWith('?')),
    ...slots.filter((c, i) => c && i !== active && !c.endsWith('?')),
  ]);

  // Keyboard: while a slot is selected, a rank key and a suit key fill it and move to the next.
  const typed = useRef('');
  const keyPick = useRef<(card: string) => void>(() => {});
  const keyUsed = useRef<ReadonlySet<string>>(new Set());
  useEffect(() => {
    if (active === null) return;
    typed.current = '';
    const onKey = (ev: KeyboardEvent) => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey || isTypingTarget(ev.target as HTMLElement)) return;
      const r = cardEntry(typed.current, ev.key);
      typed.current = r.pending;
      if (r.card && !keyUsed.current.has(r.card)) keyPick.current(r.card);
      if (r.card || r.pending || ev.key === 'Backspace') ev.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active]);

  function pick(card: string) {
    if (active === null) return;
    const next = [...slots];
    next[active] = card;
    onChange(next);
    const following = next.findIndex((c, i) => i > active && !c && stateOf(i) !== 'locked');
    open(following >= 0 ? following : null);
  }

  useEffect(() => {
    keyPick.current = pick;
    keyUsed.current = used;
  });

  const slotLabel = (i: number) =>
    i < 2 ? t(i === 0 ? 'slotHero1' : 'slotHero2') : `${groupOf(i).title} ${groupOf(i).at}`;
  const groupOf = (i: number) =>
    i < 5
      ? { title: t('flop'), at: i - 1 }
      : i === 5
        ? { title: t('turn'), at: 1 }
        : { title: t('river'), at: 1 };

  const slot = (i: number) => {
    const s = stateOf(i);
    const state = duplicates.has(i)
      ? 'duplicate'
      : i < 2
        ? slots[i]
          ? undefined
          : 'need'
        : s === 'missing' || s === 'extra'
          ? s
          : undefined;
    return (
      <CardSlot
        key={i}
        size="card"
        on={active === i}
        disabled={s === 'locked'}
        highlight={lit.has(i)}
        {...(state && { state })}
        aria-label={slotLabel(i)}
        onClick={() => open(i)}
      >
        {slots[i] ? cardLabel(slots[i], 'sm') : null}
      </CardSlot>
    );
  };

  const group = (title: string, indexes: readonly number[]) => (
    <div className="flex flex-col gap-1">
      <p className="text-[11px] uppercase tracking-[0.06em] text-muted">{title}</p>
      <div className="flex gap-1">{indexes.map(slot)}</div>
    </div>
  );

  return (
    <Card snug ref={root}>
      <h2 className="sr-only">{t('cards')}</h2>
      <div className="flex gap-3">
        {group(tr('groupHero'), HERO)}
        {group(t('flop'), [2, 3, 4])}
        {group(t('turn'), [5])}
        {group(t('river'), [6])}
      </div>
      <p className="text-xs text-muted">{tr('cardsHint')}</p>
      <Collapse open={active !== null}>
        <div ref={pickerArea}>
          {active !== null && (
            <div role="group" aria-label={t('cards')}>
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
            </div>
          )}
        </div>
      </Collapse>
    </Card>
  );
}
