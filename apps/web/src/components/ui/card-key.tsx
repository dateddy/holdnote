import type { ButtonHTMLAttributes } from 'react';
import { SUIT_TEXT } from './playing-card';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> & {
  on?: boolean;
  /** Suit code (`s h d c ?`) tints the key like the card it places. */
  suit?: string;
  tall?: boolean;
};

/** Key of the card picker: a rank or a suit. */
export function CardKey({
  on = false,
  suit,
  tall = false,
  className,
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      type={type}
      aria-pressed={on}
      className={`h-11 min-w-0 flex-1 rounded-md border text-base disabled:opacity-30 ${
        tall ? 'text-xl' : ''
      } ${on ? 'border-accent bg-accent text-accent-foreground' : 'border-line bg-surface'} ${
        suit && !on ? (SUIT_TEXT[suit] ?? '') : ''
      } ${className ?? ''}`.trim()}
      {...rest}
    />
  );
}

type SlotProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> & {
  /** The picker is open on this slot. */
  on?: boolean;
  /** `missing`: still empty at a street the betting reached (pulses, never blocks). `extra`: a card the hand does not need. */
  state?: 'missing' | 'extra';
  /** Slot belongs to the street tab that is selected. */
  highlight?: boolean;
  /** Smaller slot for the board row. */
  compact?: boolean;
};

/** One card slot (hole card or board card) that opens the picker. Pass `disabled` for a locked slot. */
export function CardSlot({
  on = false,
  state,
  highlight = false,
  compact = false,
  className,
  type = 'button',
  ...rest
}: SlotProps) {
  const border =
    state === 'missing'
      ? 'animate-pulse border-warn bg-warn/10'
      : state === 'extra'
        ? 'border-dashed border-warn bg-surface'
        : on
          ? 'border-accent bg-accent/15'
          : highlight
            ? 'border-accent bg-surface'
            : 'border-line bg-surface';
  return (
    <button
      type={type}
      aria-pressed={on}
      className={`flex flex-col items-center justify-center rounded-md border text-lg disabled:opacity-40 ${
        compact ? 'h-12' : 'h-14'
      } ${border} ${className ?? ''}`.trim()}
      {...rest}
    />
  );
}
