'use client';

import { useSyncExternalStore } from 'react';

/** The screen is at least 1024px wide: the desktop layout (matches Tailwind's `lg`). */
const QUERY = '(min-width: 1024px)';

const subscribe = (onChange: () => void) => {
  const list = window.matchMedia(QUERY);
  list.addEventListener('change', onChange);
  return () => list.removeEventListener('change', onChange);
};

/** True on desktop. The server and the first client render say false, so they agree. */
export function useDesktop(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
