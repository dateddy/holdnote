export type TabKey = 'sessions' | 'record' | 'stats' | 'settings';

export type NavTab = { key: TabKey; href: string; active: boolean };

/** Which of the four tabs a path belongs to; a child screen keeps its parent tab lit (DEC-058). */
export function activeTab(path: string): TabKey | null {
  if (path === '/' || path.startsWith('/hands')) return 'sessions';
  if (path === '/stats' || path.startsWith('/rules') || path.startsWith('/opponents')) {
    return 'stats';
  }
  if (path.startsWith('/settings')) return 'settings';
  if (path === '/sessions/new') return 'record';
  const m = /^\/sessions\/[^/]+(?:\/([^/]+))?$/.exec(path);
  if (m) {
    const sub = m[1];
    // The session page and its hand list / debrief are reading screens; the rest is at the table.
    return !sub || sub === 'hands' || sub === 'summary' || sub === 'edit' ? 'sessions' : 'record';
  }
  return null;
}

export function navTabs(path: string, recordHref: string): NavTab[] {
  const active = activeTab(path);
  const tab = (key: TabKey, href: string): NavTab => ({ key, href, active: active === key });
  return [
    tab('sessions', '/'),
    tab('record', recordHref),
    tab('stats', '/stats'),
    tab('settings', '/settings'),
  ];
}
