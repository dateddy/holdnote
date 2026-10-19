import type { HTMLAttributes } from 'react';

export const CARD_CLASS = 'space-y-2 rounded-md border border-line bg-surface p-4';
/** Same card with less padding, for working screens that must fit one phone screen. */
export const CARD_TIGHT_CLASS = 'space-y-2 rounded-md border border-line bg-surface p-3';

export function Card({
  className,
  tight = false,
  ...rest
}: HTMLAttributes<HTMLElement> & { tight?: boolean }) {
  return (
    <section
      className={`${tight ? CARD_TIGHT_CLASS : CARD_CLASS} ${className ?? ''}`.trim()}
      {...rest}
    />
  );
}
