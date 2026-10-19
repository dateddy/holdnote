'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { Result } from '@/components/ui/result';
import { OUTCOMES, type HandDraft } from '@/lib/hands/build';
import { CardGrid } from './card-grid';

type Props = {
  draft: HandDraft;
  set: <K extends keyof HandDraft>(key: K, value: HandDraft[K]) => void;
  /** Outcome after the betting had its say (hero folded, everyone else folded). */
  outcome: string;
  /** Hand ended by the betting alone: no winner to choose. */
  decided: boolean;
  /** Shorthand mode offers all four outcomes; action mode offers who won. */
  mode: 'actions' | 'shorthand';
  result: number | null;
  resultBb: number | null;
  money: (n: number) => string;
  /** "Mình thắng (đối thủ fold)" and the like, when the betting decided the hand. */
  wonText?: string;
};

/** Who won, the opponent's cards, and the result with its manual override. */
export function ShowdownBlock({
  draft,
  set,
  outcome,
  decided,
  mode,
  result,
  resultBb,
  money,
  wonText,
}: Props) {
  const t = useTranslations('record');
  const th = useTranslations('hand');
  const [editing, setEditing] = useState(false);
  const choices = mode === 'actions' ? (['win', 'lose', 'split'] as const) : OUTCOMES;
  const label = (o: string) =>
    mode === 'actions'
      ? t(o === 'win' ? 'winHero' : o === 'lose' ? 'winVillain' : 'winSplit')
      : th(`outcome_${o as (typeof OUTCOMES)[number]}`);

  return (
    <section className="space-y-3 rounded-md border border-line bg-surface p-3">
      <h3 className="text-base font-medium">
        {decided ? (wonText ?? t('resultLabel')) : t('winnerTitle')}
      </h3>
      {!decided && (
        <div className={`grid gap-1.5 ${mode === 'actions' ? 'grid-cols-3' : 'grid-cols-4'}`}>
          {choices.map((o) => (
            <Chip
              key={o}
              on={draft.outcome === o}
              onClick={() => set('outcome', draft.outcome === o ? '' : o)}
            >
              {label(o)}
            </Chip>
          ))}
        </div>
      )}
      {outcome && outcome !== 'fold' && !decided && (
        <div className="space-y-1">
          <p className="text-sm">{th('villCards')}</p>
          <CardGrid
            ariaLabel={th('villCards')}
            labels={[th('slotVill1'), th('slotVill2')]}
            slots={[draft.villCards[0] ?? '', draft.villCards[1] ?? '']}
            blocked={draft.slots}
            onChange={(cards) => set('villCards', cards)}
          />
        </div>
      )}
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted">{th('result')}</span>
        <Result value={result}>
          <span className="text-2xl font-semibold">
            {result == null
              ? '–'
              : `${resultBb == null ? money(result) : `${resultBb > 0 ? '+' : ''}${resultBb}bb`}`}
          </span>
          {result != null && resultBb != null && (
            <span className="ml-2 text-sm">{money(result)}</span>
          )}
        </Result>
      </div>
      {editing || draft.resultText.trim() ? (
        <label className="flex flex-col gap-1 text-sm">
          {t('manualResult')}
          <Input
            inputMode="decimal"
            autoComplete="off"
            value={draft.resultText}
            placeholder={result == null ? '' : String(result)}
            onChange={(e) => set('resultText', e.target.value)}
          />
          {draft.resultText.trim() && <span className="text-xs text-muted">{t('manualFlag')}</span>}
        </label>
      ) : (
        <Button variant="ghost" full={false} onClick={() => setEditing(true)}>
          {t('manualLink')}
        </Button>
      )}
    </section>
  );
}
