'use client';

import { tableOrder, type Position } from 'poker-core';
import { Seat, type SeatTone } from '@/components/ui/seat';

export type SeatView = {
  tone: SeatTone;
  /** Chosen: filled. Empty: outline. */
  selected: boolean;
  /** Spoken name, e.g. "BTN, Đối thủ". The colour alone says nothing to a screen reader. */
  label: string;
  disabled?: boolean;
};

type Props = {
  seats: number;
  view: (pos: Position) => SeatView;
  onSeat?: (pos: Position) => void;
  /** Desktop: taller table in its own column (288px instead of 192px). */
  large?: boolean;
};

/** The table seen from above: N seats spread evenly around an oval, the button at the bottom. */
export function MiniTable({ seats, view, onSeat, large = false }: Props) {
  const order = tableOrder(seats);
  const button = Math.max(
    0,
    order.findIndex((p) => p === 'BTN'),
  );
  return (
    <div className={`relative mx-auto w-full ${large ? 'h-72 max-w-md' : 'h-48 max-w-sm'}`}>
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
              selected={v.selected}
              aria-label={v.label}
              disabled={v.disabled ?? !onSeat}
              onClick={() => onSeat?.(pos)}
            />
          </div>
        );
      })}
    </div>
  );
}
