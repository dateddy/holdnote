'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  parseAmount,
  previewAmount,
  quickSizes,
  toBb,
  type HandState,
  type Position,
} from 'poker-core';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { NumPad } from '@/components/ui/num-pad';

export type AmountKind = 'open' | 'bet' | 'raise' | 'all-in' | 'dead';

type Props = {
  kind: AmountKind;
  state: HandState;
  bb: number;
  money: (n: number) => string;
  /** Seats that can pay "other money" (not followed in the hand). */
  deadSeats: Position[];
  onConfirm: (kind: AmountKind, to: number, seat?: Position) => void;
  onClose: () => void;
};

const SHORT: Record<string, string> = { '1/3': '⅓', '1/2': '½', '2/3': '⅔' };

/** Keypad that opens inside the Action card for open / bet / raise, an all-in without a known stack, or dead money. */
export function AmountPad({ kind, ...rest }: Props & { kind: AmountKind }) {
  return <AmountBody key={kind} kind={kind} {...rest} />;
}

function AmountBody({
  kind,
  state,
  bb,
  money,
  deadSeats,
  onConfirm,
  onClose,
}: Props & { kind: AmountKind }) {
  const t = useTranslations('record');
  const [text, setText] = useState('');
  const [seat, setSeat] = useState<Position | null>(deadSeats[0] ?? null);

  const value = parseAmount(text.replace(/k$/i, 'k'));
  const n = value != null && value > 0 ? value : null;
  const sized = kind === 'open' || kind === 'bet' || kind === 'raise';
  const preview = n !== null && sized ? previewAmount(state, n) : null;

  const key = (k: string) => {
    if (k === '.' && /[.k]/.test(text)) return;
    if (k === 'k' && (!text || text.includes('k'))) return;
    if (text.includes('k')) return;
    setText(text + k);
  };

  return (
    <div
      role="group"
      aria-label={kind === 'dead' ? t('deadTitle') : t('upTo')}
      className="space-y-2"
    >
      {kind === 'dead' && (
        <div className="space-y-1">
          <p className="text-sm text-muted">{t('deadWho')}</p>
          <div className="flex flex-wrap gap-1.5">
            {deadSeats.map((p) => (
              <Chip key={p} on={seat === p} onClick={() => setSeat(p)}>
                {p}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted">{kind === 'dead' ? t('deadTitle') : t('upTo')}</span>
        <p className="text-2xl font-semibold tabular-nums" aria-live="polite">
          {n === null ? '0' : `${money(n)} (${toBb(n, bb)}bb)`}
        </p>
      </div>

      {sized && (
        <div className="flex flex-wrap gap-1.5">
          {quickSizes(state, kind).map((q) => (
            <Chip key={q.key} on={n === q.to} onClick={() => setText(String(q.to))}>
              {q.key === 'pot' ? t('size_pot') : (SHORT[q.key] ?? q.key.replace('x', '×'))}
            </Chip>
          ))}
        </div>
      )}

      {preview?.belowMin && (
        <p role="status" className="rounded-md bg-warn/10 p-2 text-sm">
          {t('sheetBelowMin', { min: money(state.minRaiseTo) })}
        </p>
      )}
      {preview?.becomesAllIn && (
        <p role="status" className="rounded-md bg-warn/10 p-2 text-sm">
          {t('warnAutoAllIn')}
        </p>
      )}

      <NumPad
        onKey={key}
        onBackspace={() => setText(text.slice(0, -1))}
        backspaceLabel={t('backspace')}
      />
      <div className="grid grid-cols-2 gap-1.5">
        <Button variant="secondary" onClick={onClose}>
          {t('close')}
        </Button>
        <Button
          disabled={n === null || (kind === 'dead' && !seat)}
          onClick={() => n !== null && onConfirm(kind, n, seat ?? undefined)}
        >
          {t('confirm')}
        </Button>
      </div>
    </div>
  );
}
