import type { ButtonHTMLAttributes } from 'react';

export type SeatTone = 'hero' | 'villain' | 'other';

/** Outline for an empty seat, fill for a chosen one. Colour is the tone; the words live in aria-label. */
const FILLED: Record<SeatTone, string> = {
  hero: 'border-accent bg-accent text-accent-foreground',
  villain: 'border-villain bg-villain text-villain-foreground',
  other: 'border-line bg-surface',
};

export const TONE_CLASS: Record<SeatTone, string> = {
  hero: 'border-accent bg-accent/15',
  villain: 'border-villain bg-villain/15',
  other: 'border-line bg-surface',
};

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  position: string;
  tone: SeatTone;
  /** Chosen: filled. Empty: outline only. */
  selected?: boolean;
  /** Seat that is to act. */
  toAct?: boolean;
};

/** A seat on the mini table. */
export function Seat({
  position,
  tone,
  selected = false,
  toAct = false,
  className,
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      type={type}
      aria-current={toAct || undefined}
      aria-pressed={selected}
      className={`flex h-11 min-w-11 items-center justify-center rounded-md border px-1 text-xs font-medium leading-tight disabled:cursor-default ${
        selected ? FILLED[tone] : 'border-line bg-surface'
      } ${toAct ? 'ring-2 ring-accent' : ''} ${className ?? ''}`.trim()}
      {...rest}
    >
      {position}
    </button>
  );
}
