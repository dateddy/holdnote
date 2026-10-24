'use client';

import { useEffect, useRef } from 'react';
import { Button } from './button';

type Props = {
  open: boolean;
  title: string;
  closeLabel: string;
  /** One row per group: what the keys do, and the keys. */
  rows: readonly { label: string; keys: readonly string[] }[];
  onClose: () => void;
};

/** The list of keyboard shortcuts of a screen (desktop), opened with "?". Escape and the backdrop close it. */
export function ShortcutsDialog({ open, title, closeLabel, rows, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto w-[calc(100%-3rem)] max-w-md rounded-md border border-line bg-surface p-4 text-foreground backdrop:bg-background/70"
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      <dl className="mt-3 flex flex-col gap-2 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start justify-between gap-4">
            <dt className="text-muted">{r.label}</dt>
            <dd className="flex shrink-0 flex-wrap justify-end gap-1">
              {r.keys.map((k) => (
                <kbd
                  key={k}
                  className="rounded-md border border-line bg-background px-2 py-0.5 font-mono text-xs"
                >
                  {k}
                </kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-4">
        <Button variant="secondary" onClick={onClose}>
          {closeLabel}
        </Button>
      </div>
    </dialog>
  );
}
