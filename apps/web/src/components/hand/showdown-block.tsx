'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { ShowdownResult } from 'poker-core';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Collapse } from '@/components/ui/collapse';
import { Input } from '@/components/ui/input';
import { Result } from '@/components/ui/result';
import { OUTCOMES, type HandDraft } from '@/lib/hands/build';
import { CardGrid } from './card-grid';
import { cardLabel } from './card-label';

/** An opponent still in the hand at showdown. */
export type ShowdownOpponent = {
  /** The seat as the draft stores it (what `onCards` gets back). */
  key: string;
  /** The seat as the state machine names it (what `showdown` reports). */
  seat: string;
  /** Shown name: "Đối thủ" or "Đối thủ · BTN". */
  name: string;
  cards: [string, string];
};

type Props = {
  draft: HandDraft;
  set: <K extends keyof HandDraft>(key: K, value: HandDraft[K]) => void;
  /** Outcome after the betting had its say (hero folded, everyone else folded). */
  outcome: string;
  /** Hand ended by the betting alone: no winner to choose. */
  decided: boolean;
  /** Shorthand mode offers all four outcomes; action mode reads the pots. */
  mode: 'actions' | 'shorthand';
  result: number | null;
  resultBb: number | null;
  money: (n: number) => string;
  /** "Mình thắng (đối thủ fold)" and the like, when the betting decided the hand. */
  wonText?: string;
  /** Pots, winners and hand names from `showdown`; null in shorthand mode. */
  showdown: ShowdownResult | null;
  heroSeat: string;
  opponents: ShowdownOpponent[];
  /** Display name of any seat in the pots. */
  nameOf: (seat: string) => string;
  onCards: (key: string, cards: string[]) => void;
  /** Winners the player picked for pot `index`; null clears the pick. */
  onPick: (index: number, winners: string[] | null) => void;
};

/** Who won what: the pots, each with its winners, the opponents' cards, and the result. */
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
  showdown,
  heroSeat,
  opponents,
  nameOf,
  onCards,
  onPick,
}: Props) {
  const t = useTranslations('record');
  const th = useTranslations('hand');
  const [editing, setEditing] = useState(false);
  const [cardsFor, setCardsFor] = useState<string | null>(null);
  const rankName = (seat: string) => {
    const r = showdown?.ranks[seat as keyof ShowdownResult['ranks']];
    return r ? t(`rank_${r.category}`) : null;
  };
  const known = [...draft.slots, ...opponents.flatMap((o) => o.cards)];

  const header = decided
    ? (wonText ?? t('resultLabel'))
    : showdown?.needsChoice || mode === 'shorthand'
      ? t('winnerTitle')
      : t('showdown');

  const names = showdown
    ? Object.keys(showdown.ranks).flatMap((s) => {
        const rank = rankName(s);
        return rank ? [`${nameOf(s)}: ${rank}`] : [];
      })
    : [];

  const potName = (i: number) => (i === 0 ? t('potMain') : t('potSide', { n: i }));
  const mismatches = (showdown?.pots ?? []).flatMap((p, i) => {
    if (!showdown?.mismatch || !p.byCards || p.by !== 'choice') return [];
    const same =
      p.winners &&
      p.winners.length === p.byCards.length &&
      p.byCards.every((s) => p.winners?.includes(s));
    if (same) return [];
    const who = p.byCards.map(nameOf).join(' + ');
    const hand = rankName(p.byCards[0] ?? '') ?? '';
    const prefix = showdown.pots.length > 1 ? `${potName(i)}: ` : '';
    return [
      prefix +
        (p.byCards.length > 1 ? t('mismatchTie', { who, hand }) : t('mismatchWin', { who, hand })),
    ];
  });

  return (
    <section className="space-y-3 rounded-xl border border-line bg-surface p-3">
      <h3 className="text-base font-medium">{header}</h3>

      {mode === 'actions' && !decided && showdown && (
        <>
          {opponents.map((o) => (
            <div key={o.key} className="space-y-1.5">
              <Button
                variant="secondary"
                className="justify-between gap-2 px-3 text-sm"
                aria-expanded={cardsFor === o.key}
                onClick={() => setCardsFor((k) => (k === o.key ? null : o.key))}
              >
                <span>{t('cardsOf', { who: o.name })}</span>
                <span className="flex items-center gap-1">
                  {o.cards.some(Boolean) ? (
                    o.cards.filter(Boolean).map((c) => <span key={c}>{cardLabel(c, 'sm')}</span>)
                  ) : (
                    <span className="text-muted">{t('cardsNotShown')}</span>
                  )}
                </span>
              </Button>
              <Collapse open={cardsFor === o.key}>
                <CardGrid
                  ariaLabel={t('cardsOf', { who: o.name })}
                  labels={[th('slotVill1'), th('slotVill2')]}
                  slots={[...o.cards]}
                  blocked={known.filter((c) => !o.cards.includes(c))}
                  onChange={(cards) => onCards(o.key, cards)}
                />
              </Collapse>
            </div>
          ))}

          {names.length > 0 && <p className="text-sm tabular-nums">{names.join(' · ')}</p>}

          <div className="space-y-3">
            {showdown.pots.map((pot, i) => (
              <div key={i} className="space-y-1.5">
                <p className="flex justify-between gap-2 text-sm">
                  <span className="font-medium">
                    {showdown.pots.length > 1 ? potName(i) : t('potReceive')}
                  </span>
                  <span className="tabular-nums text-muted">{money(pot.amount)}</span>
                </p>
                <PotPicker
                  eligible={pot.eligible}
                  winners={pot.winners ?? []}
                  heroSeat={heroSeat}
                  nameOf={nameOf}
                  onChange={(w) => {
                    const same =
                      w &&
                      pot.byCards &&
                      w.length === pot.byCards.length &&
                      pot.byCards.every((s) => w.includes(s));
                    onPick(i, same ? null : w);
                  }}
                />
              </div>
            ))}
          </div>

          {mismatches.length > 0 && (
            <ul role="alert" className="space-y-1 rounded-xl bg-loss/10 p-2 text-sm text-loss">
              {mismatches.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </>
      )}

      {mode === 'shorthand' && !decided && (
        <>
          <div className="grid grid-cols-4 gap-1.5">
            {OUTCOMES.map((o) => (
              <Chip
                key={o}
                on={draft.outcome === o}
                onClick={() => set('outcome', draft.outcome === o ? '' : o)}
              >
                {th(`outcome_${o}`)}
              </Chip>
            ))}
          </div>
          {outcome && outcome !== 'fold' && opponents[0] && (
            <div className="space-y-1">
              <p className="text-sm">{th('villCards')}</p>
              <CardGrid
                ariaLabel={th('villCards')}
                labels={[th('slotVill1'), th('slotVill2')]}
                slots={[...opponents[0].cards]}
                blocked={draft.slots}
                onChange={(cards) => onCards(opponents[0]?.key ?? '', cards)}
              />
            </div>
          )}
        </>
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

/**
 * Winners of one pot. Two seats: Mình thắng / Đối thủ thắng / Chia pot. More: one chip per seat,
 * several chips on = the pot is split. One seat: nothing to choose.
 */
function PotPicker({
  eligible,
  winners,
  heroSeat,
  nameOf,
  onChange,
}: {
  eligible: string[];
  winners: string[];
  heroSeat: string;
  nameOf: (seat: string) => string;
  onChange: (winners: string[] | null) => void;
}) {
  const t = useTranslations('record');
  const same = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && a.every((s) => b.includes(s));
  const choose = (next: string[]) => onChange(same(next, winners) ? null : next);

  if (eligible.length === 1) {
    return <p className="text-sm">{t('winnerOf', { who: nameOf(eligible[0] ?? '') })}</p>;
  }
  if (eligible.length === 2) {
    const [a, b] = eligible as [string, string];
    const hero = eligible.includes(heroSeat);
    const options: [string, string[]][] = [
      [hero ? t('winHero') : t('winnerOf', { who: nameOf(a) }), [hero ? heroSeat : a]],
      [
        t('winnerOf', { who: nameOf(hero ? (a === heroSeat ? b : a) : b) }),
        [hero ? (a === heroSeat ? b : a) : b],
      ],
      [t('winSplit'), [a, b]],
    ];
    return (
      <div className="grid grid-cols-3 gap-1.5">
        {options.map(([label, seats]) => (
          <Chip key={label} on={same(seats, winners)} onClick={() => choose(seats)}>
            {label}
          </Chip>
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {eligible.map((s) => (
        <Chip
          key={s}
          on={winners.includes(s)}
          onClick={() =>
            choose(winners.includes(s) ? winners.filter((w) => w !== s) : [...winners, s])
          }
        >
          {nameOf(s)}
        </Chip>
      ))}
    </div>
  );
}
