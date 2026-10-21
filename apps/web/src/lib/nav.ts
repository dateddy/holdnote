export type TabKey = 'home' | 'stats' | 'settings';

export type NavTab = { key: TabKey; href: string; active: boolean };

/**
 * Which of the three tabs a path belongs to; a child screen keeps its parent tab lit. Every
 * session screen, including the one at the table, belongs to Home (5.1d-3).
 */
export function activeTab(path: string): TabKey | null {
  if (path === '/stats' || path.startsWith('/rules') || path.startsWith('/opponents')) {
    return 'stats';
  }
  if (path.startsWith('/settings')) return 'settings';
  if (path === '/' || path.startsWith('/hands') || path.startsWith('/sessions')) return 'home';
  return null;
}

export function navTabs(path: string): NavTab[] {
  const active = activeTab(path);
  const tab = (key: TabKey, href: string): NavTab => ({ key, href, active: active === key });
  return [tab('home', '/'), tab('stats', '/stats'), tab('settings', '/settings')];
}
