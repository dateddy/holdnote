import type { ButtonHTMLAttributes } from 'react';
import { SUIT_TEXT } from './playing-card';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> & {
  on?: boolean;
  /** Suit code (`s h d c ?`) tints the key like the card it places. */
  suit?: string;
  /** `rank`: 17px mono bold. `suit`: 20px glyph. `action`: the delete key. */
  kind?: 'rank' | 'suit' | 'action';
};

const KIND: Record<NonNullable<Props['kind']>, string> = {
  rank: 'font-mono text-[17px] font-semibold',
  suit: 'text-xl',
  action: 'text-lg',
};

/** Key of the card picker (48px high): a rank, a suit or the delete key. */
export function CardKey({
  on = false,
  suit,
  kind = 'rank',
  className,
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      type={type}
      aria-pressed={on}
      className={`h-12 min-w-0 rounded-xl border disabled:opacity-30 ${KIND[kind]} ${
        on ? 'border-accent bg-accent text-accent-foreground' : 'border-line bg-surface'
      } ${suit && !on ? (SUIT_TEXT[suit] ?? '') : ''} ${className ?? ''}`.trim()}
      {...rest}
    />
  );
}

type SlotProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> & {
  /** The picker is open on this slot. */
  on?: boolean;
  /**
   * `missing`: still empty at a street the betting reached (pulses in `warn`, never blocks).
   * `extra`: a card the hand does not need. `need`: a hole card still to enter (pulses in `accent`).
   * `duplicate`: the same card sits twice in the hand.
   */
  state?: 'missing' | 'extra' | 'need' | 'duplicate';
  /** Slot belongs to the street tab that is selected. */
  highlight?: boolean;
  /** `card`: 41×57px tile of the card row (56×80px from 1024px). Default: fills its grid cell, 56px high. */
  size?: 'card' | 'fill';
};

/** One card slot (hole card or board card) that opens the picker. Pass `disabled` for a locked slot. */
export function CardSlot({
  on = false,
  state,
  highlight = false,
  size = 'fill',
  className,
  type = 'button',
  ...rest
}: SlotProps) {
  // The slot being filled shows as chosen even while it is a reminder (missing / need / extra).
  const border =
    on && state !== 'duplicate'
      ? 'border-accent bg-accent/15'
      : state === 'missing'
        ? 'animate-pulse border-warn bg-warn/10'
        : state === 'need'
          ? 'animate-pulse border-accent bg-accent/10'
          : state === 'extra'
            ? 'border-dashed border-warn bg-surface'
            : state === 'duplicate'
              ? 'border-loss bg-loss/10'
              : on
                ? 'border-accent bg-accent/15'
                : highlight
                  ? 'border-accent bg-surface'
                  : 'border-line bg-surface';
  return (
    <button
      type={type}
      aria-pressed={on}
      className={`flex shrink-0 flex-col items-center justify-center rounded-lg border text-lg motion-reduce:animate-none disabled:opacity-40 ${
        size === 'card' ? 'h-[57px] w-[41px] lg:h-20 lg:w-14 lg:text-xl' : 'h-14'
      } ${border} ${className ?? ''}`.trim()}
      {...rest}
    />
  );
}
