import { describe, expect, it } from 'vitest';
import { activeTab, navTabs } from './nav';

describe('activeTab', () => {
  it.each([
    ['/', 'home'],
    ['/sessions/abc', 'home'],
    ['/sessions/abc/hands', 'home'],
    ['/sessions/abc/summary', 'home'],
    ['/hands/h1', 'home'],
    ['/sessions/abc/edit', 'home'],
    ['/sessions/new', 'home'],
    ['/sessions/abc/before', 'home'],
    ['/sessions/abc/record', 'home'],
    ['/sessions/abc/structure', 'home'],
    ['/sessions/abc/end', 'home'],
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
  it('three tabs in order, one of them active', () => {
    const tabs = navTabs('/stats');
    expect(tabs.map((t) => t.key)).toEqual(['home', 'stats', 'settings']);
    expect(tabs.map((t) => t.href)).toEqual(['/', '/stats', '/settings']);
    expect(tabs.filter((t) => t.active).map((t) => t.key)).toEqual(['stats']);
  });
});
