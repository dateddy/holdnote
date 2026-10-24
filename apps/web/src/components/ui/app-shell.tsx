'use client';

import { CircleUser } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, type ReactNode } from 'react';
import { navTabs } from '@/lib/nav';
import { TAB_ICONS } from './bottom-nav';
import { Icon } from './icon';
import { MoreMenu } from './more-menu';

/**
 * Frame of every signed-in screen from 1024px (5.1d-4, after GTO Wizard):
 *
 * - a bar across the top with HoldNote on its own at the left and the account menu at the right
 *   (Cài đặt · Đăng xuất);
 * - a rail on the left, always open: icon with its name under it (Trang chủ, Thống kê);
 * - the page inside one large panel (`bg-panel`), the page's own cards inside it. The panel
 *   stops growing at 1800px so tables and cards stay readable on very wide screens.
 *
 * `--nav-w` is the rail's width, so fixed bars of the page (`StickyBar`) keep clear of it. On a
 * phone the frame is just the page; its bottom bar is `BottomNav` (Cài đặt stays a tab there).
 * Onboarding has no frame.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const path = usePathname();
  const signOut = useRef<HTMLFormElement>(null);
  const tabs = navTabs(path).filter((tab) => tab.key !== 'settings');

  if (path.startsWith('/onboarding')) return <div className="flex flex-1 flex-col">{children}</div>;
  return (
    <div className="flex flex-1 flex-col lg:pt-14 lg:[--nav-w:8rem]">
      <header className="fixed inset-x-0 top-0 z-30 hidden h-14 items-center justify-between bg-background px-6 lg:flex">
        <Link href="/" className="text-lg font-semibold">
          HoldNote
        </Link>
        <MoreMenu
          label={t('profile')}
          glyph={<Icon icon={CircleUser} />}
          items={[
            { key: 'settings', label: t('settings'), href: '/settings' },
            {
              key: 'signout',
              label: tCommon('signOut'),
              onSelect: () => signOut.current?.requestSubmit(),
            },
          ]}
        />
        <form ref={signOut} action="/auth/signout" method="post" hidden />
      </header>
      <nav
        aria-label={t('label')}
        className="fixed top-14 bottom-4 left-4 z-20 hidden w-24 flex-col gap-2 rounded-xl bg-panel py-4 lg:flex"
      >
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={tab.active ? 'page' : undefined}
            className={`mx-2 flex flex-col items-center gap-1 rounded-md py-3 text-xs font-medium uppercase ${
              tab.active ? 'bg-accent/10 text-accent' : 'text-muted'
            }`}
          >
            <Icon icon={TAB_ICONS[tab.key]} />
            {t(tab.key)}
          </Link>
        ))}
      </nav>
      <div className="flex flex-1 flex-col lg:pr-4 lg:pb-4 lg:pl-(--nav-w)">
        <div className="flex flex-1 flex-col lg:mx-auto lg:w-full lg:max-w-[1800px] lg:rounded-xl lg:bg-panel">
          {children}
        </div>
      </div>
    </div>
  );
}
