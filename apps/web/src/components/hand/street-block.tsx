'use client';

import { useTranslations } from 'next-intl';
import type { Street } from 'poker-core';
import { ActionPill } from '@/components/ui/action-pill';
import { Button } from '@/components/ui/button';
import type { SeatTone } from '@/components/ui/seat';
import { CardGrid } from './card-grid';

export type PillData = {
  /** Index in the full actions array (forced bets included). */
  index: number;
  tone: SeatTone;
  who: string;
  what: string;
  amount?: string;
  invalid: boolean;
};

export type BoardPicker = {
  slots: string[];
  labels: string[];
  blocked: string[];
  onChange: (slots: string[]) => void;
  skipped: boolean;
  onToggleSkip: () => void;
};

type Props = {
  street: Street;
  pills: PillData[];
  board?: BoardPicker;
  /** Betting is closed and this street waits for its cards. */
  needsBoard?: boolean;
  onPill: (index: number) => void;
};

/** One street: its board cards, then the chips of its actions in order. */
export function StreetBlock({ street, pills, board, needsBoard = false, onPill }: Props) {
  const t = useTranslations('record');
  const th = useTranslations('hand');
  const name = street === 'preflop' ? t('preflopHeading') : th(street);
  return (
    <section className="space-y-2 rounded-md border border-line bg-surface p-3">
      <h3 className="text-base font-medium">{name}</h3>
      {board && (
        <div className="space-y-2">
          {!board.skipped && (
            <CardGrid
              ariaLabel={name}
              labels={board.labels}
              slots={board.slots}
              blocked={board.blocked}
              onChange={board.onChange}
            />
          )}
          {needsBoard && !board.skipped && (
            <p className="text-sm text-muted">{t('boardNeeded', { street: name })}</p>
          )}
          {board.skipped && <p className="text-sm text-warn">{t('boardSkipped')}</p>}
          {(board.skipped || board.slots.some((c) => !c)) && (
            <Button variant="secondary" onClick={board.onToggleSkip}>
              {board.skipped ? t('boardEnter') : t('boardSkip')}
            </Button>
          )}
        </div>
      )}
      {pills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {pills.map((p) => (
            <ActionPill
              key={p.index}
              tone={p.tone}
              who={p.who}
              what={p.what}
              {...(p.amount && { amount: p.amount })}
              invalid={p.invalid}
              onClick={() => onPill(p.index)}
              aria-label={`${p.who} ${p.what} ${p.amount ?? ''}${p.invalid ? ` · ${t('invalidAction')}` : ''}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
