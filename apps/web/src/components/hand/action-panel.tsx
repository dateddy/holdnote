'use client';

import { useTranslations } from 'next-intl';
import type { ButtonKind, HandState } from 'poker-core';
import { Button } from '@/components/ui/button';

type Props = {
  state: HandState;
  /** Who the seat to act is: "Mình", "Đối thủ" or its position. */
  who: string;
  /** Amount to call as "450 (9bb)". */
  toCallText: string;
  canUndo: boolean;
  onButton: (kind: ButtonKind) => void;
  onDead: () => void;
  onUndo: () => void;
};

/** The seat to act, the buttons the state machine allows, and the side actions. */
export function ActionPanel({ state, who, toCallText, canUndo, onButton, onDead, onUndo }: Props) {
  const t = useTranslations('record');
  const th = useTranslations('hand');
  const phase = state.phase;
  const label = (k: ButtonKind) => (k === 'open' ? t('act_open') : th(`act_${k}`));

  return (
    <section className="space-y-3 rounded-md border border-line bg-surface p-3">
      {phase.kind === 'act' && (
        <>
          <p className="text-base font-medium">{t('turnOf', { pos: phase.toAct, who })}</p>
          <p className="text-sm tabular-nums text-muted">
            {state.toCall > 0 ? t('toCall', { amount: toCallText }) : t('noCall')}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {state.buttons.map((k) => (
              <Button key={k} variant="secondary" onClick={() => onButton(k)}>
                {label(k)}
              </Button>
            ))}
          </div>
        </>
      )}
      {phase.kind === 'board' && (
        <p className="text-sm">{t('boardNeeded', { street: th(phase.street) })}</p>
      )}
      {phase.kind === 'runout' && <p className="text-sm">{t('runout')}</p>}
      {phase.kind === 'won' && <p className="text-sm">{t('wonBy', { pos: phase.winner })}</p>}
      <div className="flex gap-1.5">
        <Button variant="ghost" full={false} onClick={onDead}>
          {t('deadMoney')}
        </Button>
        <Button variant="ghost" full={false} disabled={!canUndo} onClick={onUndo}>
          {t('undo')}
        </Button>
      </div>
    </section>
  );
}
