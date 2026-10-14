import Link from 'next/link';
import type { ReactNode } from 'react';

type Props = {
  title: string;
  /** Small text line under the title (stake, venue...). */
  subtitle?: string;
  back?: { href: string; label: string };
  action?: ReactNode;
};

/** Screen header: title, optional back link and one action on the right. */
export function TopBar({ title, subtitle, back, action }: Props) {
  return (
    <header className="space-y-1">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {back ? (
          <Link href={back.href} className="text-sm text-muted underline underline-offset-4">
            {back.label}
          </Link>
        ) : (
          action
        )}
      </div>
      {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
    </header>
  );
}
