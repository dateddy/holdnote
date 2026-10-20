'use client';

import { useEffect, useRef, useState } from 'react';
import { Chip } from './chip';
import { useFloatingStyle } from './use-floating';

type Props = {
  /** Chip text while nothing is chosen, e.g. "Tháng". */
  label: string;
  /** Chosen value; `''` = none. */
  value: string;
  options: readonly { value: string; label: string }[];
  /** Text of the entry that clears the choice. */
  allLabel: string;
  onChange: (value: string) => void;
  className?: string;
};

/** A chip that opens a short list: "Tháng ▾". Choose one, or clear it with the first entry. */
export function ChipMenu({ label, value, options, allLabel, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  const style = useFloatingStyle(open, anchor, 224);
  const chosen = options.find((o) => o.value === value);

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

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };
  const item = (v: string, text: string) => (
    <button
      key={v || 'all'}
      type="button"
      aria-pressed={v === value}
      onClick={() => pick(v)}
      className={`flex h-11 w-full items-center px-3 text-left text-sm ${
        v === value ? 'font-medium text-accent' : 'text-foreground'
      }`}
    >
      {text}
    </button>
  );

  return (
    <span ref={anchor} className={`inline-flex ${className ?? ''}`.trim()}>
      <Chip
        on={value !== ''}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="w-full justify-between gap-2 whitespace-nowrap"
      >
        <span className="truncate">{chosen?.label ?? label}</span>
        <span aria-hidden>▾</span>
      </Chip>
      {open && (
        <div
          role="group"
          aria-label={label}
          style={style}
          className="z-20 overflow-y-auto rounded-md border border-line bg-surface"
        >
          {item('', allLabel)}
          {options.map((o) => item(o.value, o.label))}
        </div>
      )}
    </span>
  );
}
