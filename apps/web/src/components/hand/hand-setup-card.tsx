'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { maxStraddles, parseAmount, tableOrder, type Position } from 'poker-core';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { Toggle } from '@/components/ui/toggle';
import { levelAnte, type HandDraft, type HandSession } from '@/lib/hands/build';
import { CardGrid } from './card-grid';
import { MiniTable } from './mini-table';

export const STAGES = [
  'early',
  'mid',
  'near_bubble',
  'bubble',
  'itm',
  'final_table',
  'heads_up',
] as const;

export type OpponentOption = { id: string; name: string };

type Props = {
  session: HandSession;
  draft: HandDraft;
  seats: number;
  opponents: OpponentOption[];
  /** Last villain stack seen against each opponent. */
  opponentStacks: Record<string, number>;
  set: <K extends keyof HandDraft>(key: K, value: HandDraft[K]) => void;
  onPositions: (heroPos: string, villPos: string) => void;
  /** Disabled with a hint until the positions are chosen. */
  canStart: boolean;
  onStart: () => void;
  startLabel: string;
  /** Hand number for the title. */
  num: number;
  mode: 'buttons' | 'shorthand';
  onMode: (mode: 'buttons' | 'shorthand') => void;
  /** Hands saved before forced bets were actions can only be edited as a shorthand line. */
  modeLocked: boolean;
  /** Switching back to actions was refused: the line has errors or actions that do not fit. */
  switchBlocked: boolean;
};

/** Step 1 (spec section 3): positions on the mini table, cards, stacks, straddle or level. */
export function HandSetupCard({
  session,
  draft,
  seats,
  opponents,
  opponentStacks,
  set,
  onPositions,
  canStart,
  onStart,
  startLabel,
  num,
  mode,
  onMode,
  modeLocked,
  switchBlocked,
}: Props) {
  const t = useTranslations('record');
  const th = useTranslations('hand');
  const [role, setRole] = useState<'hero' | 'villain'>(draft.heroPos ? 'villain' : 'hero');
  const order = tableOrder(seats);
  const isMtt = session.kind === 'mtt';
  const maxS = isMtt ? 0 : maxStraddles(seats);

  function pickSeat(pos: Position) {
    if (role === 'hero') {
      onPositions(pos, draft.villPos === pos ? '' : draft.villPos);
      if (!draft.villPos || draft.villPos === pos) setRole('villain');
    } else {
      onPositions(draft.heroPos === pos ? '' : draft.heroPos, pos);
    }
  }

  const bbNow = parseAmount(isMtt ? draft.levelBb : String(session.bb ?? '')) ?? 0;
  function setStraddleCount(n: number) {
    const next = draft.straddles.slice(0, n);
    while (next.length < n) {
      const last = parseAmount(next[next.length - 1] ?? '') ?? bbNow;
      next.push(String(last * 2));
    }
    set('straddles', next);
  }

  function pickOpponent(id: string) {
    const off = draft.opponentId === id;
    set('opponentId', off ? '' : id);
    const stack = opponentStacks[id];
    if (!off && !draft.villStack && stack !== undefined) set('villStack', String(stack));
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{th('title', { num })}</h2>
        {!modeLocked && (
          <div className="flex gap-1.5" role="group" aria-label={th('actions')}>
            {(['buttons', 'shorthand'] as const).map((m) => (
              <Chip key={m} on={mode === m} onClick={() => onMode(m)}>
                {t(m === 'buttons' ? 'modeActions' : 'modeShorthand')}
              </Chip>
            ))}
          </div>
        )}
      </div>
      <p className="text-sm text-muted">{t('setupTitle')}</p>
      {switchBlocked && (
        <p role="alert" className="text-sm text-loss">
          {th('fixLineFirst')}
        </p>
      )}

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-1.5" role="group" aria-label={t('tableHint')}>
          <Chip on={role === 'hero'} onClick={() => setRole('hero')}>
            {t('roleHero')} {draft.heroPos && `· ${draft.heroPos}`}
          </Chip>
          <Chip on={role === 'villain'} onClick={() => setRole('villain')}>
            {t('roleVillain')} {draft.villPos && `· ${draft.villPos}`}
          </Chip>
        </div>
        <p className="text-xs text-muted">{role === 'hero' ? t('pickHero') : t('pickVillain')}</p>
        <MiniTable
          seats={seats}
          onSeat={pickSeat}
          view={(pos) => ({
            tone: pos === draft.heroPos ? 'hero' : pos === draft.villPos ? 'villain' : 'other',
            ...(pos === draft.heroPos && { caption: t('roleHero') }),
            ...(pos === draft.villPos && { caption: t('roleVillain') }),
            disabled: !order.includes(pos),
          })}
        />
      </div>

      <section className="space-y-2">
        <h3 className="text-base font-medium">{th('heroCards')}</h3>
        <CardGrid
          ariaLabel={th('heroCards')}
          labels={[th('slotHero1'), th('slotHero2')]}
          slots={draft.slots.slice(0, 2)}
          blocked={[...draft.slots.slice(2), ...draft.villCards]}
          onChange={(hero) => set('slots', [...hero, ...draft.slots.slice(2)])}
        />
      </section>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          {t('stackHero')}
          <Input
            inputMode="decimal"
            autoComplete="off"
            value={draft.heroStack}
            onChange={(e) => set('heroStack', e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('stackVillain')}
          <Input
            inputMode="decimal"
            autoComplete="off"
            value={draft.villStack}
            onChange={(e) => set('villStack', e.target.value)}
          />
        </label>
      </div>

      {opponents.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-base font-medium">{t('opponent')}</h3>
          <div className="flex flex-wrap gap-1.5">
            {opponents.map((o) => (
              <Chip key={o.id} on={draft.opponentId === o.id} onClick={() => pickOpponent(o.id)}>
                {o.name}
              </Chip>
            ))}
          </div>
        </section>
      )}

      {maxS > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-medium">{t('straddle')}</h3>
            <Toggle
              aria-label={t('straddle')}
              checked={draft.straddles.length > 0}
              onClick={() => setStraddleCount(draft.straddles.length > 0 ? 0 : 1)}
            />
          </div>
          {draft.straddles.length > 0 && (
            <>
              <div className="flex gap-1.5" role="group" aria-label={t('straddleCount')}>
                {Array.from({ length: maxS }, (_, i) => i + 1).map((n) => (
                  <Chip
                    key={n}
                    on={draft.straddles.length === n}
                    onClick={() => setStraddleCount(n)}
                    className="flex-1"
                  >
                    {n}
                  </Chip>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {draft.straddles.map((value, i) => (
                  <label key={i} className="flex flex-col gap-1 text-xs text-muted">
                    {t('straddleLevel', { n: i + 1 })}
                    <Input
                      inputMode="decimal"
                      autoComplete="off"
                      value={value}
                      onChange={(e) =>
                        set(
                          'straddles',
                          draft.straddles.map((v, j) => (j === i ? e.target.value : v)),
                        )
                      }
                    />
                  </label>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {isMtt && (
        <section className="space-y-3">
          <h3 className="text-base font-medium">{t('levelSection')}</h3>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              {t('levelSb')}
              <Input
                inputMode="decimal"
                autoComplete="off"
                value={draft.levelSb}
                placeholder={bbNow ? String(bbNow / 2) : ''}
                onChange={(e) => set('levelSb', e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t('levelBb')}
              <Input
                inputMode="decimal"
                autoComplete="off"
                value={draft.levelBb}
                onChange={(e) => set('levelBb', e.target.value)}
              />
            </label>
            {levelAnte(session) === 'typed' && (
              <label className="flex flex-col gap-1 text-sm">
                {t('levelAnte')}
                <Input
                  inputMode="decimal"
                  autoComplete="off"
                  value={draft.ante}
                  onChange={(e) => set('ante', e.target.value)}
                />
              </label>
            )}
            {levelAnte(session) === 'bb' && (
              <p className="col-span-2 text-sm text-muted">{th('anteIsBb')}</p>
            )}
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-medium">{t('stage')}</h3>
            <div className="flex flex-wrap gap-1.5">
              {STAGES.map((s) => (
                <Chip
                  key={s}
                  on={draft.stage === s}
                  onClick={() => set('stage', draft.stage === s ? '' : s)}
                >
                  {t(`stage_${s}`)}
                </Chip>
              ))}
            </div>
          </div>
        </section>
      )}

      {session.ante_mode === 'each' && (
        <label className="flex flex-col gap-1 text-sm">
          {th('playersDealt')}
          <Input
            inputMode="numeric"
            autoComplete="off"
            value={draft.playersDealt}
            onChange={(e) => set('playersDealt', e.target.value)}
          />
        </label>
      )}

      {!canStart && <p className="text-sm text-muted">{t('needPositions')}</p>}
      <Button disabled={!canStart} onClick={onStart}>
        {startLabel}
      </Button>
    </Card>
  );
}
