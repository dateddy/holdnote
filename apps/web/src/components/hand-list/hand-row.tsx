'use client';

import Link from 'next/link';
import { BoardRow, CardRow } from '@/components/ui/playing-card';
import { Result } from '@/components/ui/result';
import type { HandRow as HandRowData } from '@/lib/hands/session-hands';
import { AllChips } from './hand-chips';
import { HandLabels } from './hand-labels';
import { useHandText } from './use-hand-text';

/**
 * One hand on the phone, four lines: number, seats, pot type and result; my cards and the board;
 * the action chips; labels and a piece of the note. Tapping opens the hand page.
 */
export function HandRow({
  row,
  href,
  selected = false,
  onSelect,
}: {
  row: HandRowData;
  href: string;
  /** The hand open in the replayer (desktop list). */
  selected?: boolean;
  /** Desktop: tapping opens the replayer in place instead of the hand page. */
  onSelect?: (id: string) => void;
}) {
  const x = useHandText();
  const { t } = x;
  const line1 = [
    `#${row.num}`,
    x.seats(row),
    row.potType ? t(`pot_${row.potType}`) : null,
    row.sessionLabel ?? null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link
      href={href}
      aria-label={t('rowLabel', { num: row.num })}
      aria-current={selected ? 'true' : undefined}
      onClick={
        onSelect
          ? (e) => {
              e.preventDefault();
              onSelect(row.id);
            }
          : undefined
      }
      className={`flex flex-col gap-2 p-3 ${selected ? 'bg-accent/10' : ''}`.trim()}
    >
      <span className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-sm">{line1}</span>
        <span className="shrink-0 text-base font-medium">
          <Result value={row.resultBb}>{x.bb(row.resultBb)}</Result>
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {row.heroCards.length > 0 ? <CardRow cards={row.heroCards} size="sm" /> : <span>–</span>}
        {row.board.length > 0 && <BoardRow cards={row.board} />}
        {x.levelStage(row) && (
          <span className="ml-auto text-xs whitespace-nowrap text-muted">{x.levelStage(row)}</span>
        )}
      </span>
      <AllChips row={row} />
      {(row.needsReview || row.aiReviewed || row.missing || row.thought) && (
        <span className="flex flex-col gap-1">
          <HandLabels row={row} />
          {row.thought && <span className="truncate text-xs text-muted">{row.thought}</span>}
        </span>
      )}
    </Link>
  );
}
