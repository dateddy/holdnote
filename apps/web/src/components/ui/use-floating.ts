'use client';

import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';
import { placeFloating } from '@/lib/floating';

/**
 * Fixed position for a small panel next to `anchor`, kept inside the viewport (flipping above the
 * anchor when it does not fit below) and re-measured on scroll and resize. Fixed (not absolute) so
 * a horizontally scrolling parent does not clip it. Pass `panel` (the rendered panel) so the
 * flip knows its height; the first pass has no panel yet and a second one follows at once.
 */
export function useFloatingStyle(
  open: boolean,
  anchor: RefObject<HTMLElement | null>,
  width: number,
  {
    panel,
    align = 'start',
  }: { panel?: RefObject<HTMLElement | null>; align?: 'start' | 'center' } = {},
): CSSProperties | undefined {
  const [style, setStyle] = useState<CSSProperties>();
  useLayoutEffect(() => {
    if (!open) return;
    let frame = 0;
    const place = () => {
      const el = anchor.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const p = placeFloating({
        anchor: r,
        viewport: {
          width: document.documentElement.clientWidth,
          height: document.documentElement.clientHeight,
        },
        width,
        height: panel?.current?.offsetHeight ?? 0,
        align,
      });
      setStyle({
        position: 'fixed',
        left: p.left,
        width: p.width,
        maxHeight: p.maxHeight,
        ...(p.side === 'below' ? { top: p.offset } : { bottom: p.offset }),
      });
      // The panel was not in the page yet: measure it once it is, then place again.
      if (panel && !panel.current) frame = requestAnimationFrame(place);
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, anchor, panel, width, align]);
  return open ? style : undefined;
}
