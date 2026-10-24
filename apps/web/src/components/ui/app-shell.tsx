'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore, type ReactNode } from 'react';
import { readNavOpen, writeNavOpen } from '@/lib/nav-state';
import { navTabs, type NavTab } from '@/lib/nav';
import { TAB_ICONS } from './bottom-nav';
import { Icon } from './icon';
import { IconButton } from './icon-button';

// The menu state lives in localStorage; this tiny store lets React re-render when it changes.
const listeners = new Set<() => void>();
let fallback: boolean | null = null; // used when storage is blocked: still toggles this visit
const storage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};
const snapshot = () => fallback ?? readNavOpen(storage());
const toggle = () => {
  const next = !snapshot();
  fallback = next;
  writeNavOpen(next, storage());
  listeners.forEach((cb) => cb());
};

/**
 * Frame of every signed-in screen from 1024px: a bar across the top (menu button + HoldNote) and a
 * menu on the left that opens (icon + text) or collapses (icons only). `--nav-w` is the menu's
 * width, so fixed bars inside the page (`StickyBar`) can keep clear of it. On a phone the frame
 * is just the page; the bottom bar is `BottomNav`. Onboarding has no menu.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations('nav');
  const path = usePathname();
  const open = useSyncExternalStore(subscribe, snapshot, () => true);
  const bare = path.startsWith('/onboarding');
  const tabs = navTabs(path);
  const link = (tab: NavTab) => (
    <Link
      key={tab.key}
      href={tab.href}
      title={open ? undefined : t(tab.key)}
      aria-label={t(tab.key)}
      aria-current={tab.active ? 'page' : undefined}
      className={`flex h-11 items-center gap-3 rounded-md px-3 text-base ${
        tab.active ? 'bg-accent/10 font-medium text-accent' : 'text-muted'
      }`}
    >
      <Icon icon={TAB_ICONS[tab.key]} size={20} />
      {open && <span className="truncate">{t(tab.key)}</span>}
    </Link>
  );

  if (bare) return <div className="flex flex-1 flex-col">{children}</div>;
  return (
    <div
      className={`flex flex-1 flex-col lg:pt-14 ${
        open ? 'lg:[--nav-w:14rem]' : 'lg:[--nav-w:4rem]'
      }`}
    >
      <header className="fixed inset-x-0 top-0 z-30 hidden h-14 items-center gap-3 border-b border-line bg-surface px-2 lg:flex">
        <IconButton
          glyph="☰"
          label={open ? t('collapse') : t('expand')}
          aria-expanded={open}
          onClick={toggle}
        />
        <p className="text-lg font-semibold">HoldNote</p>
      </header>
      <nav
        aria-label={t('label')}
        className="fixed top-14 bottom-0 left-0 z-20 hidden w-(--nav-w) flex-col gap-1 border-r border-line bg-surface p-2 lg:flex"
      >
        {tabs.filter((tab) => tab.key !== 'settings').map(link)}
        <div className="mt-auto">{tabs.filter((tab) => tab.key === 'settings').map(link)}</div>
      </nav>
      <div className="flex flex-1 flex-col lg:pl-(--nav-w)">{children}</div>
    </div>
  );
}
