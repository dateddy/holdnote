'use client';

import { useEffect } from 'react';

/** Registers the service worker in production builds only; in dev it would serve stale pages. */
export function RegisterSw() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch(() => {});
  }, []);
  return null;
}
