'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './button';

type Props = {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** The action is running: both buttons off. */
  pending?: boolean;
};

/** Asks before something that cannot be undone (deleting a session). Escape and the backdrop cancel. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  pending = false,
}: Props) {
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
        if (!pending) onCancel();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !pending) onCancel();
      }}
      className="m-auto w-[calc(100%-3rem)] max-w-sm rounded-md border border-line bg-surface p-4 text-foreground backdrop:bg-background/70"
    >
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="text-sm text-muted">{children}</div>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <Button variant="danger" onClick={onConfirm} disabled={pending}>
          {confirmLabel}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          {cancelLabel}
        </Button>
      </div>
    </dialog>
  );
}
