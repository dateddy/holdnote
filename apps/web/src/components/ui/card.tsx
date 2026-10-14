import type { HTMLAttributes } from 'react';

export const CARD_CLASS = 'space-y-2 rounded-md border border-line bg-surface p-4';

export function Card({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return <section className={`${CARD_CLASS} ${className ?? ''}`.trim()} {...rest} />;
}
