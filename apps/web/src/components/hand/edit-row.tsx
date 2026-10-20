'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import type { Action, ActInput, ButtonKind, HandState, Position } from 'poker-core';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { revealAboveBar } from '@/lib/hands/reveal';
import { AmountPad } from './amount-pad';

type Props = {
  /** The action being edited. */
  action: Action;
  /** Where the hand stood just before that action. */
  before: HandState;
  bb: number;
  money: (n: number) => string;
  onApply: (input: ActInput) => void;
  onDeleteFrom: () => void;
  /** Tap outside: close without changing anything. */
  onClose: () => void;
};

const SIZED: readonly ButtonKind[] = ['open', 'bet', 'raise'];

function kindOf(a: Action): ButtonKind | 'dead' {
  if (a.act === 'raise' && a.verb === 'open') return 'open';
  if (a.act === 'dead') return 'dead';
  return a.act as ButtonKind;
}

/**
 * The row that slides out under a tapped action chip (spec 12): the buttons that were legal at
 * that moment, the number pad when the choice needs an amount, Xác nhận and Xóa từ đây. Nothing
 * dims; tapping outside closes it unchanged.
 */
export function EditRow({ action, before, bb, money, onApply, onDeleteFrom, onClose }: Props) {
  const t = useTranslations('record');
  const th = useTranslations('hand');
  const root = useRef<HTMLDivElement>(null);
  const current = kindOf(action);
  const [kind, setKind] = useState<ButtonKind | 'dead'>(current);

  useEffect(() => {
    const away = (e: PointerEvent) => {
      const target = e.target as Element;
      // A tap on an action chip is handled by the chip (switch to it, or close).
      if (root.current?.contains(target) || target.closest('[data-pill]')) return;
      onClose();
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [onClose]);

  // Bring the row (and the pad, once it opens) above the save bar, after layout has settled.
  const padOpen = kind === 'dead' || SIZED.includes(kind);
  useEffect(() => {
    const timer = setTimeout(() => revealAboveBar(root.current), 200);
    return () => clearTimeout(timer);
  }, [padOpen]);

  const options: ButtonKind[] =
    current === 'dead' ? [] : [...new Set<ButtonKind>(['fold', ...before.buttons])];
  const sized = kind === 'dead' || SIZED.includes(kind);
  const label = (k: ButtonKind | 'dead') =>
    k === 'open' ? t('act_open') : k === 'dead' ? t('deadMoney') : th(`act_${k}`);

  return (
    <div
      ref={root}
      role="group"
      aria-label={t('editAction')}
      className="space-y-2 rounded-md border border-line bg-background p-2"
    >
      <div className="flex flex-wrap gap-1.5">
        {(current === 'dead' ? (['dead'] as const) : options).map((k) => (
          <Chip key={k} on={kind === k} onClick={() => setKind(k)}>
            {label(k)}
          </Chip>
        ))}
      </div>
      {sized ? (
        <AmountPad
          kind={kind as 'open' | 'bet' | 'raise' | 'dead'}
          state={before}
          bb={bb}
          money={money}
          deadSeats={action.pos ? [action.pos as Position] : []}
          {...(action.amount !== undefined &&
            kind === current && { initial: String(action.amount) })}
          onConfirm={(k, to) => onApply({ act: k, to })}
          onClose={() => (kind === current ? onClose() : setKind(current))}
        />
      ) : (
        <Button onClick={() => onApply({ act: kind as ButtonKind })}>{t('confirm')}</Button>
      )}
      <Button variant="secondary" onClick={onDeleteFrom}>
        {t('deleteFrom')}
      </Button>
    </div>
  );
}
