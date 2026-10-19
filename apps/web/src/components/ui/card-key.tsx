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

type SlotProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> & { on?: boolean };

/** One card slot (hole card or board card) that opens the picker. */
export function CardSlot({ on = false, className, type = 'button', ...rest }: SlotProps) {
  return (
    <button
      type={type}
      aria-pressed={on}
      className={`flex h-14 flex-col items-center justify-center rounded-md border text-lg ${
        on ? 'border-accent bg-accent/15' : 'border-line bg-surface'
      } ${className ?? ''}`.trim()}
      {...rest}
    />
  );
}
