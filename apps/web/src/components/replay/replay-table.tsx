'use client';

import { toBb, type ReplayFrame } from 'poker-core';
import { BetChip } from '@/components/ui/bet-chip';
import { CardRow } from '@/components/ui/playing-card';
import { TableSeat } from '@/components/ui/table-seat';
import type { ReplayHand } from '@/lib/hands/replay';

type Props = {
  hand: ReplayHand;
  frame: ReplayFrame;
  /** Board cards already dealt at this step. */
  board: string[];
  /** Spoken and short names of a seat. */
  who: (key: string, pos: string, role: string) => string;
  fmt: (bb: number) => string;
  note: { allIn: string; fold: string };
  seatLabel: (pos: string, who: string, stack: string | null) => string;
  potLabel: string;
  moneyOf: (n: number) => string;
};

/**
 * The table seen from above for the replayer: every seat with its stack in bb, the bet in front of
 * it, the board and the pot in the middle. The numbers come from `replayFrames`.
 */
export function ReplayTable({
  hand,
  frame,
  board,
  who,
  fmt,
  note,
  seatLabel,
  potLabel,
  moneyOf,
}: Props) {
  const seats = hand.table;
  const buttonAt = Math.max(
    0,
    seats.findIndex((s) => s.pos === 'BTN'),
  );

  return (
    <div className="relative mx-auto h-72 w-full max-w-xl">
      <div aria-hidden className="absolute inset-x-10 inset-y-9 rounded-full border border-line" />

      <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5">
        {board.length > 0 && <CardRow cards={board} size="sm" />}
        <div className="text-center" data-pot={frame.pot}>
          <div className="text-lg font-semibold tabular-nums">
            {potLabel} {fmt(toBb(frame.pot, hand.bb))} bb
          </div>
          <div className="text-xs text-muted tabular-nums">{moneyOf(frame.pot)}</div>
        </div>
      </div>

      {seats.map((info, i) => {
        const theta = (((i - buttonAt) * 360) / seats.length) * (Math.PI / 180);
        const sin = Math.sin(theta);
        const cos = Math.cos(theta);
        const s = frame.seats[info.key];
        const inHand = Boolean(s) && !s!.folded && (info.role !== 'other' || s!.invested > 0);
        const stackBb = s?.stack === undefined ? null : fmt(toBb(s.stack, hand.bb));
        const name = who(info.key, info.pos, info.role);
        return (
          <div key={info.pos}>
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${50 - 42 * sin}%`, top: `${50 + 42 * cos}%` }}
              data-seat={info.key}
              data-pos={info.pos}
              {...(s?.stack !== undefined && { 'data-stack': s.stack })}
            >
              <TableSeat
                position={info.pos}
                tone={info.role}
                inHand={inHand}
                {...(stackBb !== null && { stack: stackBb })}
                {...(s?.allIn && { note: note.allIn })}
                {...(s?.folded && { note: note.fold })}
                label={seatLabel(info.pos, name, stackBb)}
              />
            </div>
            {s && s.streetBet > 0 && (
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${50 - 25 * sin}%`, top: `${50 + 24 * cos}%` }}
                data-bet={s.streetBet}
              >
                <BetChip>{fmt(toBb(s.streetBet, hand.bb))}</BetChip>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
