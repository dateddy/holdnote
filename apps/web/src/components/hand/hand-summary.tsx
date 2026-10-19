import { useTranslations } from 'next-intl';
import { STREETS, isPostAct, type Action, type Street } from 'poker-core';
import { Card } from '@/components/ui/card';
import { CardRow } from '@/components/ui/playing-card';
import { Result } from '@/components/ui/result';

export type SummaryStep = { action: Action; potAfter: number };

type Props = {
  heroCards: string[];
  board: string[];
  heroPos: string;
  villPos: string;
  steps: SummaryStep[];
  /** Result in session money and bb; null when unknown. */
  result: { text: string; value: number } | null;
  eff: string | null;
  thought: string;
  flagged: boolean;
  money: (n: number) => string;
};

/** The hand as a reader sees it: cards, positions, then what happened street by street. */
export function HandSummary({
  heroCards,
  board,
  heroPos,
  villPos,
  steps,
  result,
  eff,
  thought,
  flagged,
  money,
}: Props) {
  const t = useTranslations('hand');
  const actor = (a: Action) =>
    a.actor === 'hero' ? t('hero') : a.actor === 'villain' ? t('villain') : (a.pos ?? a.who ?? '?');
  // Forced bets and dead money are not choices; the pot column already counts them.
  const byStreet = (street: Street) =>
    steps.filter(
      (s) => s.action.street === street && !isPostAct(s.action.act) && s.action.act !== 'dead',
    );

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          {heroCards.length > 0 ? <CardRow cards={heroCards} /> : <span>–</span>}
          {flagged && <span aria-label={t('flag')}>⚑</span>}
        </span>
        {result && (
          <Result value={result.value}>
            <b className="text-lg">{result.text}</b>
          </Result>
        )}
      </div>

      <p className="text-sm text-muted">
        {[heroPos, villPos].filter(Boolean).join(' vs ')}
        {eff && ` · ${t('eff')}: ${eff}`}
      </p>

      {board.length > 0 && <CardRow cards={board} size="sm" />}

      <div className="space-y-2 pt-1">
        {STREETS.map((street) => {
          const rows = byStreet(street);
          if (rows.length === 0) return null;
          return (
            <div key={street} className="space-y-0.5">
              <h3 className="text-xs uppercase tracking-wide text-muted">
                {t(`street_${street}`)}
              </h3>
              <ol className="space-y-0.5 text-sm">
                {rows.map((s, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span>
                      <b>{actor(s.action)}</b> {t(`act_${s.action.act}`)}
                      {s.action.amount !== undefined && ` ${money(s.action.amount)}`}
                    </span>
                    <span className="tabular-nums text-muted">{money(s.potAfter)}</span>
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>

      {thought && <p className="border-t border-line pt-2 text-sm italic">{thought}</p>}
    </Card>
  );
}
