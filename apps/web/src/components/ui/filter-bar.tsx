'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

type Props = {
  /** `row`: one line that scrolls sideways (phone). `column`: stacked (desktop side column). */
  orientation?: 'row' | 'column';
  /** Name of the group for screen readers. */
  label: string;
  /** Row only: from 1024px the controls wrap onto more lines instead of scrolling (desktop). */
  wrapOnDesktop?: boolean;
  children: ReactNode;
};

/**
 * Layout of filter controls: `Segmented`, `ChipMenu` and toggle `Chip`s. In a row, controls keep
 * their width and the bar scrolls sideways with no scrollbar; the right edge fades out while more
 * controls are hidden past it. In a column they stack.
 */
export function FilterBar({ orientation = 'row', label, wrapOnDesktop = false, children }: Props) {
  const row = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  useEffect(() => {
    const el = row.current;
    if (!el || orientation !== 'row') return;
    const measure = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    // The observer reports once when it starts, so the first measure needs no call of its own.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);
    el.addEventListener('scroll', measure, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', measure);
    };
  }, [orientation, children]);

  if (orientation === 'column') {
    return (
      <div role="group" aria-label={label} className="flex flex-col gap-3">
        {children}
      </div>
    );
  }
  return (
    <div
      ref={row}
      role="group"
      aria-label={label}
      data-hscroll
      className={`flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0 ${
        wrapOnDesktop ? 'lg:flex-wrap lg:overflow-visible' : ''
      } ${
        more ? '[mask-image:linear-gradient(to_right,black_calc(100%_-_2.5rem),transparent)]' : ''
      }`}
    >
      {children}
    </div>
  );
}
