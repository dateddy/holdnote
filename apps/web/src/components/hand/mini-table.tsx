'use client';

import { tableOrder, type Position } from 'poker-core';
import { Seat, type SeatTone } from '@/components/ui/seat';

export type SeatView = {
  tone: SeatTone;
  /** "Mình" / "Đối thủ" under the position; other seats have none. */
  caption?: string;
  toAct?: boolean;
  folded?: boolean;
  addable?: boolean;
  disabled?: boolean;
};

type Props = {
  seats: number;
  view: (pos: Position) => SeatView;
  onSeat?: (pos: Position) => void;
  compact?: boolean;
};

/** The table seen from above: seats around an oval, the button at the bottom. */
export function MiniTable({ seats, view, onSeat, compact = false }: Props) {
  const order = tableOrder(seats);
  const button = Math.max(
    0,
    order.findIndex((p) => (seats <= 2 ? p === 'SB' : p === 'BTN')),
  );
  return (
    <div className={`relative mx-auto w-full max-w-sm ${compact ? 'h-48' : 'h-64'}`}>
      <div aria-hidden className="absolute inset-x-8 inset-y-8 rounded-full border border-line" />
      {order.map((pos, i) => {
        const theta = (((i - button) * 360) / order.length) * (Math.PI / 180);
        const x = 50 - 40 * Math.sin(theta);
        const y = 50 + 38 * Math.cos(theta);
        const v = view(pos);
        return (
          <div
            key={pos}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <Seat
              position={pos}
              tone={v.tone}
              {...(v.caption && { caption: v.caption })}
              toAct={v.toAct ?? false}
              folded={v.folded ?? false}
              addable={v.addable ?? false}
              disabled={v.disabled ?? !onSeat}
              onClick={() => onSeat?.(pos)}
            />
          </div>
        );
      })}
    </div>
  );
}
