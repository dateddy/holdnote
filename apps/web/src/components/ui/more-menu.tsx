'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconButton } from './icon-button';
import { useFloatingStyle } from './use-floating';

export type MoreMenuItem = {
  key: string;
  label: string;
  /** Opens a page. */
  href?: string;
  /** Runs an action; the menu closes first. */
  onSelect?: () => void;
  /** Red text: deleting. */
  danger?: boolean;
};

/** The "⋯" button of a screen header: a short list of actions that do not fit on the page. */
export function MoreMenu({
  label,
  items,
  glyph = '⋯',
}: {
  label: string;
  items: readonly MoreMenuItem[];
  /** What the button shows; `⋯` by default (the profile menu shows a person icon). */
  glyph?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const style = useFloatingStyle(open, anchor, 224, { panel });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!anchor.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const cls = (danger?: boolean) =>
    `flex h-11 w-full items-center px-3 text-left text-sm ${danger ? 'text-loss' : 'text-foreground'}`;

  return (
    <span ref={anchor} className="inline-flex">
      <IconButton
        glyph={glyph}
        label={label}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <div
          ref={panel}
          role="menu"
          aria-label={label}
          style={style}
          className="z-20 overflow-y-auto rounded-xl border border-line bg-surface"
        >
          {items.map((it) =>
            it.href ? (
              <Link key={it.key} role="menuitem" href={it.href} className={cls(it.danger)}>
                {it.label}
              </Link>
            ) : (
              <button
                key={it.key}
                type="button"
                role="menuitem"
                className={cls(it.danger)}
                onClick={() => {
                  setOpen(false);
                  it.onSelect?.();
                }}
              >
                {it.label}
              </button>
            ),
          )}
        </div>
      )}
    </span>
  );
}
