'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navTabs } from '@/lib/nav';

/** Left navigation of the desktop layout (from 1024px): the same four tabs as the bottom bar. */
export function SideNav({ recordHref }: { recordHref: string }) {
  const t = useTranslations('nav');
  const path = usePathname();
  if (path.startsWith('/onboarding')) return null;

  return (
    <nav
      aria-label={t('label')}
      className="fixed inset-y-0 left-0 z-10 hidden w-56 flex-col gap-1 border-r border-line bg-surface p-3 lg:flex"
    >
      <p className="px-3 py-3 text-lg font-semibold">HoldNote</p>
      {navTabs(path, recordHref).map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.active ? 'page' : undefined}
          className={`flex h-11 items-center rounded-md px-3 text-base ${
            tab.active ? 'bg-accent/10 font-medium text-accent' : 'text-muted'
          }`}
        >
          {t(tab.key)}
        </Link>
      ))}
    </nav>
  );
}
