'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { computePot, replayFrames, STREETS, toBb, type Street } from 'poker-core';
import { ActionPill } from '@/components/ui/action-pill';
import { Badge } from '@/components/ui/badge';
import { buttonClass } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { CardRow } from '@/components/ui/playing-card';
import { Result } from '@/components/ui/result';
import { opponentLabel } from '@/lib/hands/labels';
import type { ReplayHand } from '@/lib/hands/replay';
import { formatMoney, signedNumber } from '@/lib/sessions/format';
import { ReplayTable } from './replay-table';

export type ReplayMeta = {
  id: string;
  num: number;
  thought: string;
  needsReview: boolean;
  aiReviewed: boolean;
  missing: boolean;
};

type Props = {
  hand: ReplayHand;
  meta: ReplayMeta;
  /** Currency of the session; the money lines are formatted here (a function cannot cross from the server). */
  currency: string;
  onClose?: () => void;
  /** The hand number above the result; the hand page already has it in its title. */
  showNum?: boolean;
};

const BOARD_AT: Record<Street, number> = { preflop: 0, flop: 3, turn: 4, river: 5 };
const COLUMN: Record<Street, 'colPreflop' | 'colFlop' | 'colTurn' | 'colRiver'> = {
  preflop: 'colPreflop',
  flop: 'colFlop',
  turn: 'colTurn',
  river: 'colRiver',
};

const isTyping = (el: EventTarget | null): boolean =>
  el instanceof HTMLElement &&
  (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

/**
 * One hand played back: the table with stacks and pot in bb at every step, the chips of each
 * street to step through with ‹ ›, the showdown with its pots at the end. Starts on the result.
 */
export function Replayer({ hand, meta, currency, onClose, showNum = true }: Props) {
  const t = useTranslations('replay');
  const tHand = useTranslations('hand');
  const tList = useTranslations('handList');
  const tRecord = useTranslations('record');
  const locale = useLocale();
  const money = (n: number) => formatMoney(n, currency, locale);

  const frames = useMemo(() => replayFrames(hand.input), [hand.input]);
  const resolved = useMemo(
    () => new Map(computePot(hand.input).steps.map((s) => [s.index, s.action])),
    [hand.input],
  );
  const last = frames.length - 1;
  const [step, setStep] = useState(last);
  const frame = frames[step] ?? frames[last]!;
  const go = useCallback((n: number) => setStep(Math.min(last, Math.max(0, n))), [last]);

  // ← → step through the hand while the replayer is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setStep((s) => Math.max(0, s - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setStep((s) => Math.min(last, s + 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [last]);

  const fmt = (bb: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(bb);
  const bbText = (n: number) => `${fmt(toBb(n, hand.bb))}bb`;

  const seatByPos = new Map(hand.table.map((s) => [s.pos, s]));
  const nameOf = (key: string, pos: string, role: string): string =>
    role === 'hero' || key === 'hero'
      ? tHand('hero')
      : role === 'opponent' || key === 'villain'
        ? opponentLabel(tHand('villain'), pos, hand.opponents)
        : pos;
  const nameOfKey = (key: string): string => {
    const info = hand.table.find((s) => s.key === key);
    return info ? nameOf(info.key, info.pos, info.role) : key;
  };

  const boardShown = frame.final
    ? hand.board
    : hand.board.slice(0, Math.min(hand.board.length, BOARD_AT[frame.street]));

  // Chips by street; each jumps to the step it was played at.
  const timeline = STREETS.flatMap((street) => {
    const items = frames.flatMap((f, i) => {
      if (f.index === null || f.street !== street) return [];
      const action = resolved.get(f.index);
      return action ? [{ i, action }] : [];
    });
    return items.length > 0 ? [{ street, items }] : [];
  });

  const shownRows = [
    ...(hand.ranks.hero ? [{ key: 'hero', cards: hand.heroCards }] : []),
    ...Object.entries(hand.shown).map(([key, cards]) => ({ key, cards })),
  ];
  const rankName = (key: string) => {
    const category = hand.ranks[key];
    return category ? tRecord(`rank_${category}` as 'rank_pair') : null;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          {showNum && <p className="text-sm text-muted">{t('handNum', { num: meta.num })}</p>}
          <p className="text-2xl font-semibold" data-result-bb={hand.resultBb ?? undefined}>
            {hand.resultBb == null ? (
              '—'
            ) : (
              <Result value={hand.resultBb}>{signedNumber(hand.resultBb, locale)} bb</Result>
            )}
          </p>
          {hand.result != null && (
            <p className="text-sm text-muted tabular-nums">
              {hand.result > 0 ? '+' : ''}
              {money(hand.result)}
            </p>
          )}
        </div>
        {onClose && <IconButton glyph="✕" label={t('close')} onClick={onClose} />}
      </div>

      <ReplayTable
        hand={hand}
        frame={frame}
        board={boardShown}
        who={nameOf}
        fmt={fmt}
        note={{ allIn: t('allIn'), fold: t('fold') }}
        seatLabel={(pos, who, stack) =>
          stack === null
            ? t('seatNoStack', { pos, who })
            : t('seatLabel', { pos, who, stack: t('behind', { amount: stack }) })
        }
        potLabel={t('pot')}
        moneyOf={money}
      />

      <div className="flex items-center justify-between gap-3">
        <IconButton
          glyph="‹"
          label={t('prev')}
          disabled={step === 0}
          onClick={() => go(step - 1)}
        />
        <span className="text-sm text-muted tabular-nums" aria-live="polite">
          {t('step', { step, total: last })}
        </span>
        <IconButton
          glyph="›"
          label={t('next')}
          disabled={step === last}
          onClick={() => go(step + 1)}
        />
      </div>

      <section aria-label={t('timeline')} className="space-y-2">
        {timeline.map(({ street, items }) => (
          <div key={street} className="space-y-1">
            <h3 className="text-xs tracking-wide text-muted uppercase">{tList(COLUMN[street])}</h3>
            <div className="flex flex-wrap gap-1.5">
              {items.map(({ i, action }) => {
                const info = action.pos ? seatByPos.get(action.pos) : undefined;
                const tone =
                  action.actor === 'hero'
                    ? 'hero'
                    : action.actor === 'villain' || info?.role === 'opponent'
                      ? 'villain'
                      : 'other';
                const amount =
                  action.amount !== undefined && action.act !== 'fold' && action.act !== 'check'
                    ? bbText(action.amount)
                    : undefined;
                return (
                  <ActionPill
                    key={i}
                    tone={tone}
                    who={
                      action.actor === 'hero'
                        ? tHand('hero')
                        : action.actor === 'villain'
                          ? opponentLabel(tHand('villain'), action.pos ?? '', hand.opponents)
                          : (action.pos ?? action.who ?? '?')
                    }
                    what={
                      action.act === 'raise' && action.verb === 'open'
                        ? tRecord('act_open')
                        : tHand(`act_${action.act as 'check'}`)
                    }
                    {...(amount && { amount })}
                    active={i === step}
                    invalid={false}
                    onClick={() => go(i)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {frame.final && (
        <Card>
          <h3 className="text-base font-medium">{t('showdown')}</h3>
          {shownRows.length > 0 && (
            <ul className="space-y-1">
              {shownRows.map((r) => (
                <li key={r.key} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{nameOfKey(r.key)}</span>
                  <CardRow cards={r.cards} size="sm" />
                  {rankName(r.key) && <span className="text-muted">{rankName(r.key)}</span>}
                </li>
              ))}
            </ul>
          )}
          {hand.pots.length === 0 ? (
            <p className="text-sm text-muted">
              {hand.potStatus === 'unknown' ? t('potUnknown') : t('noShowdown')}
            </p>
          ) : (
            <ul className="space-y-1" data-pots={hand.pots.length}>
              {hand.pots.map((p, n) => (
                <li key={n} className="flex justify-between gap-3 text-sm">
                  <span>
                    <span className="font-medium">
                      {hand.pots.length === 1
                        ? t('pot')
                        : n === 0
                          ? t('potMain')
                          : t('potSide', { n })}
                    </span>{' '}
                    <span className="text-muted">
                      {p.winners.length === 0
                        ? ''
                        : p.winners.length > 1
                          ? t('splitBetween', { who: p.winners.map(nameOfKey).join(' + ') })
                          : t('winnerOf', { who: nameOfKey(p.winners[0]!) })}
                    </span>
                  </span>
                  <span className="tabular-nums">{bbText(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {(meta.thought || meta.needsReview || meta.aiReviewed || meta.missing) && (
        <div className="space-y-2">
          {(meta.needsReview || meta.aiReviewed || meta.missing) && (
            <div className="flex flex-wrap gap-1.5">
              {meta.needsReview && <Badge tone="warn">{tList('needsReview')}</Badge>}
              {meta.aiReviewed && <Badge tone="accent">{tList('aiReviewed')}</Badge>}
              {meta.missing && <Badge tone="muted">{tList('missing')}</Badge>}
            </div>
          )}
          {meta.thought && <p className="text-sm italic">{meta.thought}</p>}
        </div>
      )}

      <Link
        href={`/hands/${meta.id}/edit`}
        className={buttonClass({ variant: 'secondary', full: false })}
      >
        {t('editHand')}
      </Link>
    </div>
  );
}
