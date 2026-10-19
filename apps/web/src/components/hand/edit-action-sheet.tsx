'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  parseAmount,
  type Action,
  type ActInput,
  type ButtonKind,
  type HandState,
} from 'poker-core';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';

type Props = {
  /** The action being edited; null = closed. */
  action: Action | null;
  /** Where the hand stood just before that action. */
  before: HandState | null;
  onApply: (input: ActInput) => void;
  onDeleteFrom: () => void;
  onClose: () => void;
};

const SIZED: readonly ButtonKind[] = ['open', 'bet', 'raise'];

/** Tap an old chip: choose another action (and amount); everything after is replayed. */
export function EditActionSheet({ action, before, onApply, onDeleteFrom, onClose }: Props) {
  const t = useTranslations('record');
  return (
    <Sheet open={action !== null} onClose={onClose} title={t('editAction')} closeLabel={t('close')}>
      {action && before && (
        <EditBody action={action} before={before} onApply={onApply} onDeleteFrom={onDeleteFrom} />
      )}
    </Sheet>
  );
}

function kindOf(a: Action): ButtonKind | 'dead' {
  if (a.act === 'raise' && a.verb === 'open') return 'open';
  if (a.act === 'dead') return 'dead';
  return a.act as ButtonKind;
}

function EditBody({
  action,
  before,
  onApply,
  onDeleteFrom,
}: Omit<Props, 'action' | 'before' | 'onClose'> & { action: Action; before: HandState }) {
  const t = useTranslations('record');
  const th = useTranslations('hand');
  const current = kindOf(action);
  const options: ButtonKind[] =
    current === 'dead' ? [] : [...new Set<ButtonKind>(['fold', ...before.buttons])];
  const [kind, setKind] = useState<ButtonKind | 'dead'>(current);
  const [text, setText] = useState(action.amount === undefined ? '' : String(action.amount));
  const amount = parseAmount(text);
  const needsAmount = kind === 'dead' || SIZED.includes(kind as ButtonKind);
  const label = (k: ButtonKind | 'dead') => (k === 'open' ? t('act_open') : th(`act_${k}`));

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {(current === 'dead' ? (['dead'] as const) : options).map((k) => (
          <Chip key={k} on={kind === k} onClick={() => setKind(k)}>
            {label(k)}
          </Chip>
        ))}
      </div>
      {needsAmount && (
        <label className="flex flex-col gap-1 text-sm">
          {t('upTo')}
          <Input
            inputMode="decimal"
            autoComplete="off"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
      )}
      <Button
        disabled={needsAmount && (amount == null || amount <= 0)}
        onClick={() =>
          onApply({
            act: kind,
            ...(needsAmount && amount != null && { to: amount }),
          })
        }
      >
        {t('confirm')}
      </Button>
      <Button variant="secondary" onClick={onDeleteFrom}>
        {t('deleteFrom')}
      </Button>
    </>
  );
}
