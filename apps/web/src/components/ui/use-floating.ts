'use client';

import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

/**
 * Fixed position for a small panel under `anchor`, kept inside the viewport and re-measured on
 * scroll and resize. Fixed (not absolute) so a horizontally scrolling parent does not clip it.
 */
export function useFloatingStyle(
  open: boolean,
  anchor: RefObject<HTMLElement | null>,
  width: number,
): CSSProperties | undefined {
  const [style, setStyle] = useState<CSSProperties>();
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const el = anchor.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;
      const w = Math.min(width, vw - 16);
      setStyle({
        position: 'fixed',
        top: r.bottom + 4,
        left: Math.min(Math.max(8, r.left), vw - w - 8),
        width: w,
        maxHeight: Math.max(120, vh - r.bottom - 16),
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, anchor, width]);
  return open ? style : undefined;
}
