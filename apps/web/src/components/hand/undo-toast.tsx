'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

export const UNDO_WINDOW_MS = 10_000;

type Props = {
  num: number;
  busy: boolean;
  failed: boolean;
  onUndo: () => void;
  onExpire: () => void;
};

/** "Saved hand #n · Undo", gone after 10 seconds (spec 3.5). */
export function UndoToast({ num, busy, failed, onUndo, onExpire }: Props) {
  const t = useTranslations('hand');

  useEffect(() => {
    const timer = setTimeout(onExpire, UNDO_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [num, onExpire]);

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-28 z-30 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl bg-accent p-3 text-accent-foreground shadow-lg"
    >
      <span className="text-sm">{failed ? t('undoFailed') : t('saved', { num })}</span>
      <button
        type="button"
        onClick={onUndo}
        disabled={busy}
        className="h-10 rounded-xl border border-background/40 px-4 text-sm font-medium disabled:opacity-50"
      >
        {t('undo')}
      </button>
    </div>
  );
}
