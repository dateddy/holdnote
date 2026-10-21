'use client';

import { STREETS } from 'poker-core';
import { Button } from '@/components/ui/button';
import { BoardRow, CardRow } from '@/components/ui/playing-card';
import { Result } from '@/components/ui/result';
import type { HandRow } from '@/lib/hands/session-hands';
import { StreetChips } from './hand-chips';
import { HandLabels } from './hand-labels';
import { useHandText } from './use-hand-text';

type Props = {
  rows: HandRow[];
  /** Hand shown in the side panel. */
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Adds the Session column, for a list across sessions. */
  showSession?: boolean;
};

const STREET_COL = {
  preflop: 'colPreflop',
  flop: 'colFlop',
  turn: 'colTurn',
  river: 'colRiver',
} as const;

/** Desktop table of hands: one column per street, each holding its action chips. */
export function HandTable({ rows, selectedId, onSelect, showSession = false }: Props) {
  const x = useHandText();
  const { t } = x;
  const th = 'px-2 py-2 text-left text-xs font-medium whitespace-nowrap text-muted';
  // Result and labels stay in view while the street columns scroll sideways.
  const stickyResult = 'sticky right-32 w-24 min-w-24 border-l border-line bg-surface';
  const stickyLabels = 'sticky right-0 w-32 min-w-32 bg-surface';

  return (
    <div className="overflow-x-auto rounded-md border border-line bg-surface">
      <table className="w-full text-sm" aria-label={t('table')}>
        <thead>
          <tr className="border-b border-line">
            <th className={th}>{t('colNum')}</th>
            {showSession && <th className={th}>{t('colSession')}</th>}
            <th className={th}>{t('colPos')}</th>
            <th className={th}>{t('colCards')}</th>
            <th className={th}>{t('colBoard')}</th>
            <th className={th}>{t('colPot')}</th>
            {STREETS.map((s) => (
              <th key={s} className={th}>
                {t(STREET_COL[s])}
              </th>
            ))}
            <th className={`${th} text-right`}>{t('colPotSize')}</th>
            <th className={`${th} ${stickyResult} text-right`}>{t('colResult')}</th>
            <th className={`${th} ${stickyLabels}`}>{t('colLabels')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const selected = row.id === selectedId;
            return (
              <tr
                key={row.id}
                data-hand-id={row.id}
                aria-selected={selected}
                onClick={() => onSelect(row.id)}
                className={`cursor-pointer border-t border-line align-top ${selected ? 'bg-accent/10' : ''}`.trim()}
              >
                <td className="px-2 py-2 whitespace-nowrap">
                  <Button
                    variant="ghost"
                    full={false}
                    aria-label={t('rowLabel', { num: row.num })}
                    onClick={() => onSelect(row.id)}
                  >
                    #{row.num}
                  </Button>
                </td>
                {showSession && (
                  <td className="px-2 py-2 whitespace-nowrap">{row.sessionLabel ?? ''}</td>
                )}
                <td className="px-2 py-2 whitespace-nowrap">
                  {x.seats(row)}
                  {x.levelStage(row) && (
                    <span className="block text-xs text-muted">{x.levelStage(row)}</span>
                  )}
                </td>
                <td className="px-2 py-2">
                  {row.heroCards.length > 0 ? <CardRow cards={row.heroCards} size="sm" /> : '–'}
                </td>
                <td className="px-2 py-2">
                  {row.board.length > 0 ? <BoardRow cards={row.board} /> : '–'}
                </td>
                <td className="px-2 py-2 whitespace-nowrap">
                  {row.potType ? t(`potShort_${row.potType}`) : '–'}
                </td>
                {STREETS.map((s) => (
                  <td key={s} className="px-2 py-2">
                    <StreetChips row={row} street={s} />
                  </td>
                ))}
                <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">
                  {x.potSize(row)}
                </td>
                <td
                  className={`px-2 py-2 text-right font-medium whitespace-nowrap ${stickyResult}`}
                >
                  <Result value={row.resultBb}>{x.bb(row.resultBb)}</Result>
                </td>
                <td className={`px-2 py-2 ${stickyLabels}`}>
                  <HandLabels row={row} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
