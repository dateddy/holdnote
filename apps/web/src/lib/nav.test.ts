import { describe, expect, it } from 'vitest';
import { activeTab, navTabs } from './nav';

describe('activeTab', () => {
  it.each([
    ['/', 'sessions'],
    ['/sessions/abc', 'sessions'],
    ['/sessions/abc/hands', 'sessions'],
    ['/sessions/abc/summary', 'sessions'],
    ['/hands/h1', 'sessions'],
    ['/sessions/new', 'record'],
    ['/sessions/abc/before', 'record'],
    ['/sessions/abc/record', 'record'],
    ['/sessions/abc/structure', 'record'],
    ['/sessions/abc/end', 'record'],
    ['/stats', 'stats'],
    ['/rules', 'stats'],
    ['/opponents', 'stats'],
    ['/opponents/new', 'stats'],
    ['/opponents/o1', 'stats'],
    ['/settings', 'settings'],
  ])('%s -> %s', (path, tab) => {
    expect(activeTab(path)).toBe(tab);
  });

  it('unknown paths light no tab', () => {
    expect(activeTab('/onboarding')).toBeNull();
    expect(activeTab('/somewhere')).toBeNull();
  });
});

describe('navTabs', () => {
  it('four tabs in order, the Record tab points where the layout says, one is active', () => {
    const tabs = navTabs('/stats', '/sessions/x/record');
    expect(tabs.map((t) => t.key)).toEqual(['sessions', 'record', 'stats', 'settings']);
    expect(tabs.map((t) => t.href)).toEqual(['/', '/sessions/x/record', '/stats', '/settings']);
    expect(tabs.filter((t) => t.active).map((t) => t.key)).toEqual(['stats']);
  });
});
