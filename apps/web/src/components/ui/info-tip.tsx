'use client';

import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { useFloatingStyle } from './use-floating';

// Only one tip is open at a time: the open one is kept here and every tip reads it.
let openId: string | null = null;
const listeners = new Set<() => void>();
function setOpenId(id: string | null) {
  if (openId === id) return;
  openId = id;
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

type Props = {
  /** One sentence, about 15 words at most. */
  text: string;
  /** Accessible name of the "?" button, e.g. "Giải thích". */
  label: string;
};

/**
 * "?" next to a figure or term. Touch: tap opens, tap elsewhere closes, one open at a time.
 * Mouse: hover. Keyboard: focus.
 */
export function InfoTip({ text, label }: Props) {
  const id = useId();
  const anchor = useRef<HTMLSpanElement>(null);
  const current = useSyncExternalStore(
    subscribe,
    () => openId,
    () => null,
  );
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const open = current === id;
  const visible = open || hover || focus;
  const style = useFloatingStyle(visible, anchor, 224);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!anchor.current?.contains(e.target as Node)) setOpenId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenId(null);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span ref={anchor} className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-expanded={visible}
        aria-describedby={visible ? id : undefined}
        onClick={() => setOpenId(open ? null : id)}
        onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(true)}
        onPointerLeave={() => setHover(false)}
        onFocus={(e) => setFocus(e.currentTarget.matches(':focus-visible'))}
        onBlur={() => setFocus(false)}
        className="relative inline-flex size-5 items-center justify-center rounded-full border border-line text-xs text-muted after:absolute after:-inset-3"
      >
        ?
      </button>
      {visible && (
        <span
          id={id}
          role="tooltip"
          style={style}
          className="z-20 overflow-y-auto rounded-md border border-line bg-surface p-2 text-xs font-normal text-foreground"
        >
          {text}
        </span>
      )}
    </span>
  );
}
