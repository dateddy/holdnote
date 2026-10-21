import { describe, expect, it } from 'vitest';
import { createNavHistory, isEdgeSwipe } from './nav-history';

describe('createNavHistory', () => {
  it('has nothing behind the first screen of a page load', () => {
    const h = createNavHistory();
    h.visit('/sessions/a', false);
    expect(h.canGoBack()).toBe(false);
  });

  it('counts forward moves and takes one off for each Back', () => {
    const h = createNavHistory();
    h.visit('/', false);
    h.visit('/sessions/a', false);
    h.visit('/hands/1', false);
    expect(h.canGoBack()).toBe(true);
    h.visit('/sessions/a', true);
    expect(h.canGoBack()).toBe(true);
    h.visit('/', true);
    expect(h.canGoBack()).toBe(false);
    h.visit('/', true);
    expect(h.canGoBack()).toBe(false);
  });

  it('a repeat of the same path (a filter in the address) is not a move', () => {
    const h = createNavHistory();
    h.visit('/', false);
    h.visit('/', false);
    expect(h.canGoBack()).toBe(false);
  });
});

describe('isEdgeSwipe', () => {
  it('from the left edge, long and flat', () => {
    expect(isEdgeSwipe({ x: 8, y: 300 }, { x: 120, y: 330 })).toBe(true);
  });

  it('not when it starts away from the edge, is short, or goes up and down', () => {
    expect(isEdgeSwipe({ x: 60, y: 300 }, { x: 200, y: 300 })).toBe(false);
    expect(isEdgeSwipe({ x: 8, y: 300 }, { x: 40, y: 300 })).toBe(false);
    expect(isEdgeSwipe({ x: 8, y: 300 }, { x: 100, y: 500 })).toBe(false);
  });

  it('not to the left', () => {
    expect(isEdgeSwipe({ x: 8, y: 300 }, { x: -50, y: 300 })).toBe(false);
  });
});
