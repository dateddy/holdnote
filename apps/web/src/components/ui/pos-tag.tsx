import type { HTMLAttributes } from 'react';

export type PosTone = 'hero' | 'villain';

const TONE: Record<PosTone, string> = {
  hero: 'border-accent bg-accent text-accent-foreground',
  villain: 'border-villain bg-villain text-villain-foreground',
};

type Props = HTMLAttributes<HTMLSpanElement> & { tone: PosTone };

/** Seat name as a small coloured tag: `[MP]` in green for hero, `[BTN]` in orange for an opponent. */
export function PosTag({ tone, className, ...rest }: Props) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-md border px-1.5 text-xs font-medium ${TONE[tone]} ${
        className ?? ''
      }`.trim()}
      {...rest}
    />
  );
}
