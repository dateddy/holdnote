import type { HTMLAttributes } from 'react';

/**
 * The one bar stuck to the bottom of a working screen (Ghi nhanh): solid background, top border,
 * clear of the home indicator. Pair with `StickyBarSpacer` so content is not hidden behind it.
 */
export function StickyBar({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] ${
        className ?? ''
      }`.trim()}
      {...rest}
    />
  );
}

export function StickyBarSpacer() {
  return <div aria-hidden className="h-24 shrink-0" />;
}
