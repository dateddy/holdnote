import type { ButtonHTMLAttributes } from 'react';
import { TONE_CLASS, type SeatTone } from './seat';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  tone: SeatTone;
  /** Who: "Mình", "Đối thủ" or the position. */
  who: string;
  /** What: "Raise", "Call"... */
  what: string;
  /** Amount text such as "10bb", already formatted. */
  amount?: string;
  /** The action no longer fits the betting (after an edit). */
  invalid?: boolean;
  /** The chip whose edit row is open. */
  active?: boolean;
};

/** One chip of the street timeline. Tap to edit. */
export function ActionPill({
  tone,
  who,
  what,
  amount,
  invalid = false,
  active = false,
  className,
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      type={type}
      data-pill=""
      aria-pressed={active}
      className={`flex h-9 items-center gap-1 rounded-md border px-2 text-sm tabular-nums ${
        invalid ? 'border-loss bg-loss/10 text-loss' : TONE_CLASS[tone]
      } ${active ? 'ring-2 ring-accent' : ''} ${className ?? ''}`.trim()}
      {...rest}
    >
      {invalid && <span aria-hidden>⚠</span>}
      <span className="font-medium">{who}</span>
      <span>{what}</span>
      {amount && <span className="text-muted">{amount}</span>}
    </button>
  );
}
