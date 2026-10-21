import type { ReactNode } from 'react';
import { BackButton } from './back-button';

type Props = {
  title: string;
  /** Small text line under the title (stake, venue...). */
  subtitle?: string;
  /** Child screen: a bar with `<` at the left. `label` is the accessible name of the arrow. */
  back?: { href: string; label: string };
  action?: ReactNode;
  /**
   * For the working screen (Ghi nhanh) that has its own sticky bar and 12px side padding: the
   * bar scrolls away with the page instead of sticking, so only one bar is stuck to the top.
   */
  compact?: boolean;
};

/**
 * Screen header. A tab's root screen gets the large title; a child screen (`back`) gets a bar
 * stuck to the top with the `<` arrow, title and one action on the right. Put it first in a
 * `main` with 24px padding: the bar reaches the screen edges and rests on the status bar's safe area.
 */
export function TopBar({ title, subtitle, back, action, compact = false }: Props) {
  if (!back) {
    return (
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">{title}</h1>
          {action && <div className="flex items-center gap-3">{action}</div>}
        </div>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </header>
    );
  }
  return (
    <header
      data-back-href={back.href}
      className={`border-b border-line bg-background px-2 pt-[env(safe-area-inset-top)] ${
        compact ? '-mx-3 -mt-6' : 'sticky top-0 z-10 -mx-6 -mt-6'
      }`}
    >
      <div className="flex min-h-14 items-center gap-1">
        <BackButton href={back.href} label={back.label} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">{title}</h1>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
        {action && <div className="flex shrink-0 items-center gap-3 pr-2">{action}</div>}
      </div>
    </header>
  );
}
