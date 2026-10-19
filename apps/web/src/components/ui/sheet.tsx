'use client';

import { useEffect, type ReactNode } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
};

/** Panel that slides up from the bottom edge, over a dimmed page. */
export function Sheet({ open, onClose, title, closeLabel, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center"
      role="dialog"
      aria-modal
      aria-label={title}
    >
      <button
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40"
      />
      <div className="relative z-10 flex max-h-[90dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-md border border-b-0 border-line bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <h2 className="text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
