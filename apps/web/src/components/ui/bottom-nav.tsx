'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Tab = { key: 'home' | 'record' | 'stats' | 'settings'; href: string; active: boolean };

/** Fixed bottom bar with four tabs (DEC-044). Hidden during onboarding. */
export function BottomNav({ recordHref }: { recordHref: string }) {
  const t = useTranslations('nav');
  const path = usePathname();
  if (path.startsWith('/onboarding')) return null;

  const tabs: Tab[] = [
    { key: 'home', href: '/', active: path === '/' },
    {
      key: 'record',
      href: recordHref,
      active: path.startsWith('/sessions') || path.startsWith('/hands'),
    },
    { key: 'stats', href: '/stats', active: path.startsWith('/stats') },
    {
      key: 'settings',
      href: '/settings',
      active:
        path.startsWith('/settings') || path.startsWith('/rules') || path.startsWith('/opponents'),
    },
  ];

  return (
    <>
      <div aria-hidden className="h-20 shrink-0" />
      <nav
        aria-label={t('label')}
        className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
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
