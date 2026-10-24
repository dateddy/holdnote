import type { ComponentProps } from 'react';

export const CARD_CLASS = 'space-y-2 rounded-xl border border-line bg-surface p-4';
/** Same card with less padding, for working screens that must fit one phone screen. */
export const CARD_TIGHT_CLASS = 'space-y-2 rounded-xl border border-line bg-surface p-3';

/** Same card with 8px padding: the card row of the Ghi nhanh screen (335px inside at 375px). */
export const CARD_SNUG_CLASS = 'space-y-2 rounded-xl border border-line bg-surface p-2';

export function Card({
  className,
  tight = false,
  snug = false,
  ...rest
}: ComponentProps<'section'> & { tight?: boolean; snug?: boolean }) {
  return (
    <section
      className={`${snug ? CARD_SNUG_CLASS : tight ? CARD_TIGHT_CLASS : CARD_CLASS} ${className ?? ''}`.trim()}
      {...rest}
    />
  );
}
