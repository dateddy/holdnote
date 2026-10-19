'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import {
  computePot,
  parseAmount,
  POSITIONS,
  previewNext,
  STREETS,
  suggestAmount,
  type Action,
  type PlayerAct,
  type HandInput,
  type Position,
  type Street,
} from 'poker-core';
import { defaultActor, removeLastOnStreet } from '@/lib/hands/actions';
import { isOneOf } from '@/lib/sessions/form';
import { CardGrid } from './card-grid';

const FRACTIONS = [
  ['1/3', 1 / 3],
  ['1/2', 1 / 2],
  ['2/3', 2 / 3],
  ['pot', 1],
] as const;

const BTN = 'flex h-11 flex-1 items-center justify-center rounded-md border px-2 text-sm';
const OFF = 'border-line bg-surface';
const ON = 'border-accent bg-accent text-accent-foreground';

type Who = { actor: Action['actor']; pos?: Position };

type Props = {
  actions: Action[];
  onChange: (actions: Action[]) => void;
  /** Hand with the current actions; null when the blinds are unknown. */
  input: HandInput | null;
  heroPos: string;
  villPos: string;
  /** Number of board cards entered (0, 3, 4, 5), to open the matching street. */
  boardCount: number;
  money: (n: number) => string;
  /** The seven card slots (hero 2 + board 5) and a way to change them; each street edits its own cards. */
  slots: string[];
  onSlots: (slots: string[]) => void;
  /** Cards used outside the slots (opponent hand), which cannot be picked again. */
  blocked: string[];
};

/** Board slots each street owns: flop 2-4, turn 5, river 6. */
const BOARD_RANGE: Partial<Record<Street, [number, number]>> = {
  flop: [2, 5],
  turn: [5, 6],
  river: [6, 7],
};

/** Button entry mode: one row per street (spec 3.5). */
export function ActionRows({
  actions,
  onChange,
  input,
  heroPos,
  villPos,
  boardCount,
  money,
  slots,
  onSlots,
  blocked,
}: Props) {
  const t = useTranslations('hand');
  const [picked, setPicked] = useState<Partial<Record<Street, Who>>>({});
  const [sizing, setSizing] = useState<{ street: Street; act: 'bet' | 'raise' } | null>(null);
  const [amountText, setAmountText] = useState('');

  const steps = useMemo(() => (input ? computePot(input).steps : []), [input]);

  const hasActions = (s: Street) => actions.some((a) => a.street === s);
  const boardNeeded: Record<Street, number> = { preflop: 0, flop: 3, turn: 4, river: 5 };
  // Show a street once the previous one has actions or its board cards are in.
  const visible = STREETS.filter((s, i) => {
    if (i === 0 || hasActions(s) || boardCount >= boardNeeded[s]) return true;
    const prev = STREETS[i - 1];
    return (
      prev !== undefined && hasActions(prev) && STREETS.slice(i + 1).every((x) => !hasActions(x))
    );
  });

  const whoFor = (street: Street): Who => {
    const chosen = picked[street];
    if (chosen) return chosen;
    const actor = defaultActor(street, actions, heroPos, villPos);
    const pos = actor === 'hero' ? heroPos : villPos;
    return { actor, ...(isOneOf(POSITIONS, pos) && { pos }) };
  };

  const actorLabel = (a: Action) =>
    a.actor === 'hero' ? t('hero') : a.actor === 'villain' ? t('villain') : (a.pos ?? a.who ?? '?');

  function add(street: Street, who: Who, act: PlayerAct, amount?: number) {
    const action: Action = {
      street,
      actor: who.actor,
      ...(who.pos && { pos: who.pos }),
      act,
      ...(amount !== undefined && { amount }),
    };
    onChange([...actions, action]);
    setPicked((p) => ({ ...p, [street]: undefined }));
    setSizing(null);
    setAmountText('');
  }

  return (
    <div className="flex flex-col gap-4">
      {visible.map((street) => {
        const who = whoFor(street);
        const spot = input
          ? previewNext({ ...input, actions }, street, {
              actor: who.actor,
              ...(who.pos && { pos: who.pos }),
            })
          : null;
        const range = BOARD_RANGE[street];
        const sized: 'bet' | 'raise' = spot && spot.level > 0 ? 'raise' : 'bet';
        const rows = actions.map((a, index) => ({ a, index })).filter((x) => x.a.street === street);

        return (
          <section key={street} className="space-y-2 rounded-md border border-line bg-surface p-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">{t(`street_${street}`)}</h4>
              {spot && (
                <span className="text-sm text-muted">{t('potNow', { pot: money(spot.pot) })}</span>
              )}
            </div>

            {range && (
              <CardGrid
                ariaLabel={t(`street_${street}`)}
                labels={Array<string>(range[1] - range[0]).fill(
                  street === 'turn' ? t('turn') : street === 'river' ? t('river') : t('flop'),
                )}
                slots={slots.slice(range[0], range[1])}
                blocked={[...slots.slice(0, range[0]), ...slots.slice(range[1]), ...blocked]}
                onChange={(part) =>
                  onSlots([...slots.slice(0, range[0]), ...part, ...slots.slice(range[1])])
                }
              />
            )}

            {rows.length > 0 && (
              <ol className="space-y-1 text-sm">
                {rows.map(({ a, index }) => {
                  const step = steps.find((s) => s.index === index);
                  const amount = step?.action.amount;
                  return (
                    <li key={index} className="flex justify-between gap-2">
                      <span>
                        <b>{actorLabel(a)}</b> {t(`act_${a.act}`)}
                        {amount !== undefined && ` ${money(amount)}`}
                      </span>
                      {step && <span className="text-muted">{money(step.potAfter)}</span>}
                    </li>
                  );
                })}
              </ol>
            )}

            <div className="flex gap-1.5" role="group" aria-label={t('who')}>
              {(['hero', 'villain', 'other'] as const).map((actor) => (
                <button
                  key={actor}
                  type="button"
                  aria-pressed={who.actor === actor}
                  onClick={() =>
                    setPicked((p) => ({
                      ...p,
                      [street]: {
                        actor,
                        ...(actor === 'hero' && isOneOf(POSITIONS, heroPos) && { pos: heroPos }),
                        ...(actor === 'villain' && isOneOf(POSITIONS, villPos) && { pos: villPos }),
                      },
                    }))
                  }
                  className={`${BTN} ${who.actor === actor ? ON : OFF}`}
                >
                  {t(actor)}
                </button>
              ))}
            </div>

            {who.actor === 'other' && (
              <div className="flex flex-wrap gap-1.5">
                {POSITIONS.filter((p) => p !== heroPos && p !== villPos).map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={who.pos === p}
                    onClick={() =>
                      setPicked((s) => ({ ...s, [street]: { actor: 'other', pos: p } }))
                    }
                    className={`${BTN} flex-none ${who.pos === p ? ON : OFF}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {(spot?.facing
                ? (['fold', 'call', 'raise', 'all-in'] as const)
                : spot && spot.level > 0
                  ? (['check', 'raise', 'all-in'] as const)
                  : (['check', 'bet', 'all-in'] as const)
              ).map((act) => (
                <button
                  key={act}
                  type="button"
                  disabled={who.actor === 'other' && !who.pos}
                  onClick={() => {
                    if (act === 'bet' || act === 'raise') {
                      setSizing({ street, act });
                      setAmountText('');
                    } else add(street, who, act);
                  }}
                  className={`${BTN} ${sizing?.street === street && sizing.act === act ? ON : OFF} disabled:opacity-40`}
                >
                  {t(`act_${act}`)}
                </button>
              ))}
              {rows.length > 0 && (
                <button
                  type="button"
                  aria-label={t('undoAction')}
                  onClick={() => onChange(removeLastOnStreet(actions, street))}
                  className={`${BTN} ${OFF} flex-none`}
                >
                  ⌫
                </button>
              )}
            </div>

            {sizing?.street === street && spot && (
              <div className="space-y-2">
                <div className="flex gap-1.5">
                  {FRACTIONS.map(([label, fraction]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setAmountText(String(suggestAmount(sized, fraction, spot)))}
                      className={`${BTN} ${OFF}`}
                    >
                      {label === 'pot' ? t('potSize') : label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <input
                    inputMode="decimal"
                    autoComplete="off"
                    value={amountText}
                    placeholder={t('amountTo')}
                    onChange={(e) => setAmountText(e.target.value)}
                    className="h-11 min-w-0 flex-1 rounded-md border border-line bg-surface px-3 text-base"
                  />
                  <button
                    type="button"
                    disabled={!((parseAmount(amountText) ?? 0) > 0)}
                    onClick={() =>
                      add(street, who, sizing.act, parseAmount(amountText) ?? undefined)
                    }
                    className="h-11 rounded-md bg-accent px-4 text-accent-foreground disabled:opacity-40"
                  >
                    {t('confirm')}
                  </button>
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
