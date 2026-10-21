'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { isEdgeSwipe, navHistory } from '@/lib/nav-history';

/** Added to the home screen on iOS: there the browser's own edge swipe does not exist. */
const isIosStandalone = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

/**
 * Keeps count of the screens behind the current one (for the `<` button) and, in the installed
 * iOS app, turns a swipe from the left edge into the same press of `<`. Renders nothing.
 */
export function HistoryNav() {
  const path = usePathname();
  const popped = useRef(false);

  useEffect(() => {
    const onPop = () => {
      popped.current = true;
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    navHistory.visit(path, popped.current);
    popped.current = false;
  }, [path]);

  useEffect(() => {
    if (!isIosStandalone()) return;
    let start: { x: number; y: number } | null = null;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      const target = e.target instanceof Element ? e.target : null;
      // A row that scrolls sideways (filters, chips) keeps its own swipe.
      start = t && !target?.closest('[data-hscroll]') ? { x: t.clientX, y: t.clientY } : null;
    };
    const onEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      const from = start;
      start = null;
      if (!from || !t || !isEdgeSwipe(from, { x: t.clientX, y: t.clientY })) return;
      document.querySelector<HTMLButtonElement>('[data-back-button]')?.click();
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchend', onEnd);
    };
  }, []);

  return null;
}
