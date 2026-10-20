'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navTabs } from '@/lib/nav';

/** Fixed bottom bar with four tabs (DEC-044), phone only. Hidden during onboarding. */
export function BottomNav({ recordHref }: { recordHref: string }) {
  const t = useTranslations('nav');
  const path = usePathname();
  // Onboarding and the Ghi nhanh screen have their own bottom bar.
  if (path.startsWith('/onboarding') || /^\/sessions\/[^/]+\/record$/.test(path)) return null;

  const tabs = navTabs(path, recordHref);

  return (
    <>
      <div aria-hidden className="h-20 shrink-0 lg:hidden" />
      <nav
        aria-label={t('label')}
        className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-cols-4">
          {tabs.map((tab) => (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={tab.active ? 'page' : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-xs ${
                  tab.active ? 'font-medium text-accent' : 'text-muted'
                }`}
              >
                <span
                  className={`h-1 w-6 rounded-full ${tab.active ? 'bg-accent' : 'bg-transparent'}`}
                />
                {t(tab.key)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
