'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getCounts, startAutoSync, subscribe, type SyncCounts } from '@/lib/offline/sync';

/** Hands waiting for the network or refused by the server. Also starts the background sync. */
export function SyncStatus() {
  const t = useTranslations('sync');
  const router = useRouter();
  const [counts, setCounts] = useState<SyncCounts>({ pending: 0, failed: 0 });

  useEffect(() => {
    startAutoSync();
    getCounts()
      .then(setCounts)
      .catch(() => {});
    return subscribe((next, result) => {
      setCounts(next);
      // New hands reached the server: refresh the server-rendered lists and totals.
      if (result && result.synced.length > 0) router.refresh();
    });
  }, [router]);

  if (counts.pending === 0 && counts.failed === 0) return null;
  return (
    <div role="status" className="space-y-1 rounded-md bg-warn/15 p-3 text-sm text-warn">
      {counts.pending > 0 && <p>{t('pending', { count: counts.pending })}</p>}
      {counts.failed > 0 && (
        <p role="alert" className="text-loss">
          {t('failed', { count: counts.failed })}
        </p>
      )}
    </div>
  );
}
