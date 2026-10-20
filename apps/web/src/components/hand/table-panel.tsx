'use client';

import { useTranslations } from 'next-intl';
import { maxStraddles, parseAmount, tableOrder, type Position } from 'poker-core';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { Stepper } from '@/components/ui/stepper';
import { Toggle } from '@/components/ui/toggle';
import { levelAnte, pickedOpponents, type HandDraft, type HandSession } from '@/lib/hands/build';
import { MAX_PLAYERS, MIN_PLAYERS, STAGES, type OpponentOption } from '@/lib/hands/table';
import { MiniTable } from './mini-table';
import { OpponentRow } from './opponent-row';

export type PanelRole = 'hero' | 'villain';

type Props = {
  session: HandSession;
  draft: HandDraft;
  players: number;
  role: PanelRole;
  onRole: (role: PanelRole) => void;
  /** Seats that were dropped by the last head count change, to ask for them again. */
  dropped: Position[];
  options: OpponentOption[];
  onHeroSeat: (pos: Position) => void;
  onOpponentSeat: (pos: Position) => void;
  onPlayers: (n: number) => void;
  onOpponentStack: (pos: string, stack: string) => void;
  onOpponentName: (pos: string, id: string) => void;
  onOpponentCreate?: (pos: string, name: string) => void;
  onStraddles: (count: number) => void;
  set: <K extends keyof HandDraft>(key: K, value: HandDraft[K]) => void;
  mode: 'buttons' | 'shorthand';
  onMode: (mode: 'buttons' | 'shorthand') => void;
  /** Hands saved before forced bets were actions can only be edited as a shorthand line. */
  modeLocked: boolean;
  /** Switching back to actions was refused: the line has errors or actions that do not fit. */
  switchBlocked: boolean;
};

/**
 * What slides out of the context bar (spec section 3): two bars (Mình / Đối thủ), the mini table
 * with the head count, a row per opponent, hero's stack, straddle or level, and the entry mode.
 */
export function TablePanel({
  session,
  draft,
  players,
  role,
  onRole,
  dropped,
  options,
  onHeroSeat,
  onOpponentSeat,
  onPlayers,
  onOpponentStack,
  onOpponentName,
  onOpponentCreate,
  onStraddles,
  set,
  mode,
  onMode,
  modeLocked,
  switchBlocked,
}: Props) {
  const t = useTranslations('record');
  const th = useTranslations('hand');
  const order = tableOrder(players);
  const opponents = pickedOpponents(draft);
  const isMtt = session.kind === 'mtt';
  const maxS = isMtt ? 0 : maxStraddles(players);
  const bbNow = parseAmount(isMtt ? draft.levelBb : String(session.bb ?? '')) ?? 0;
  const pickedPos = new Set(opponents.map((o) => o.pos));

  return (
    <div role="region" aria-label={t('tablePanel')} className="space-y-3 pb-3">
      <div className="grid grid-cols-2 gap-1.5" role="group" aria-label={t('tableHint')}>
        <Chip on={role === 'hero'} onClick={() => onRole('hero')}>
          {t('roleHero')}
          {draft.heroPos && ` · ${draft.heroPos}`}
        </Chip>
        <Chip tone="villain" on={role === 'villain'} onClick={() => onRole('villain')}>
          {t('roleVillain')}
          {opponents.length > 0 && ` · ${opponents.map((o) => o.pos).join(' ')}`}
        </Chip>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 text-xs text-muted">
          {role === 'hero' ? t('pickHero') : t('pickVillain')}
        </p>
        <Stepper
          value={players}
          min={MIN_PLAYERS}
          max={MAX_PLAYERS}
          onChange={onPlayers}
          text={t('players', { n: players })}
          minusLabel={t('playersLess')}
          plusLabel={t('playersMore')}
          className="shrink-0"
        />
      </div>
      {dropped.length > 0 && (
        <p role="status" className="rounded-md bg-warn/10 p-2 text-sm">
          {t('seatsGone', { seats: dropped.join(', '), n: players })}
        </p>
      )}

      <MiniTable
        seats={players}
        onSeat={(pos) => (role === 'hero' ? onHeroSeat(pos) : onOpponentSeat(pos))}
        view={(pos) => {
          const hero = pos === draft.heroPos;
          const villain = pickedPos.has(pos);
          return {
            tone: hero ? 'hero' : 'villain',
            selected: hero || villain,
            label: `${pos}${hero ? `, ${t('roleHero')}` : villain ? `, ${t('roleVillain')}` : ''}`,
            disabled: !order.includes(pos) || (role === 'villain' && hero),
          };
        }}
      />

      {opponents.map((o) => (
        <OpponentRow
          key={o.pos}
          opponent={o}
          options={options.filter((x) => x.id === o.opponentId || !opponentTaken(opponents, x.id))}
          onStack={(stack) => onOpponentStack(o.pos, stack)}
          onName={(id) => onOpponentName(o.pos, id)}
          {...(onOpponentCreate && { onCreate: (name: string) => onOpponentCreate(o.pos, name) })}
        />
      ))}

      <label className="flex flex-col gap-1 text-sm">
        {t('stackHero')}
        <Input
          inputMode="decimal"
          autoComplete="off"
          value={draft.heroStack}
          onChange={(e) => set('heroStack', e.target.value)}
        />
      </label>

      {!isMtt && (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-medium">{t('straddle')}</h3>
            <Toggle
              aria-label={t('straddle')}
              checked={draft.straddles.length > 0}
              disabled={maxS === 0}
              onClick={() => onStraddles(draft.straddles.length > 0 ? 0 : 1)}
            />
          </div>
          {maxS === 0 && (
            <p className="text-xs text-muted">{t('straddleLocked', { n: players })}</p>
          )}
          {draft.straddles.length > 0 && (
            <>
              <div className="flex gap-1.5" role="group" aria-label={t('straddleCount')}>
                {Array.from({ length: maxS }, (_, i) => i + 1).map((n) => (
                  <Chip
                    key={n}
                    on={draft.straddles.length === n}
                    onClick={() => onStraddles(n)}
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

      {!modeLocked && (
        <div className="space-y-1.5">
          <div className="flex gap-1.5" role="group" aria-label={th('actions')}>
            {(['buttons', 'shorthand'] as const).map((m) => (
              <Chip key={m} on={mode === m} onClick={() => onMode(m)} className="flex-1">
                {t(m === 'buttons' ? 'modeActions' : 'modeShorthand')}
              </Chip>
            ))}
          </div>
          {switchBlocked && (
            <p role="alert" className="text-sm text-loss">
              {th('fixLineFirst')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const opponentTaken = (opponents: { opponentId: string }[], id: string) =>
  opponents.some((o) => o.opponentId === id);
