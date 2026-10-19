'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, type ReactNode } from 'react';
import { BarButton } from '@/components/ui/bar-button';
import { Collapse } from '@/components/ui/collapse';
import { PosTag } from '@/components/ui/pos-tag';

type Props = {
  num: number;
  heroPos: string;
  /** Seats of the opponents picked, first picked first. */
  opponents: string[];
  players: number;
  /** Hero stack as shown, "18.000". Empty = not typed yet. */
  stack: string;
  /** Straddle (cash) or "Level 50 · Bubble" (MTT), already put together; empty = nothing to show. */
  extra: string;
  open: boolean;
  onToggle: () => void;
  /** Tap outside the bar: slide it shut. */
  onClose: () => void;
  /** The table panel. */
  children: ReactNode;
};

/**
 * The bar that stays at the top of Ghi nhanh: [MP] vs [LJ] [BTN] · 6 người · stack · straddle.
 * Tap it and the table panel slides out below; tapping anywhere else slides it shut.
 */
export function ContextBar({
  num,
  heroPos,
  opponents,
  players,
  stack,
  extra,
  open,
  onToggle,
  onClose,
  children,
}: Props) {
  const t = useTranslations('record');
  const th = useTranslations('hand');
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Bring the bar to the top so the panel under it sits above the save bar.
    root.current?.scrollIntoView({ block: 'start' });
    const away = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open, onClose]);

  return (
    <div ref={root} className="sticky top-0 z-10 -mx-3 border-b border-line bg-background px-3">
      <BarButton aria-expanded={open} onClick={onToggle}>
        <span className="font-medium">{th('title', { num })}</span>
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5 tabular-nums">
          {heroPos ? <PosTag tone="hero">{heroPos}</PosTag> : <span className="text-muted">?</span>}
          <span className="text-muted">{t('versus')}</span>
          {opponents.length > 0 ? (
            opponents.map((p) => (
              <PosTag key={p} tone="villain">
                {p}
              </PosTag>
            ))
          ) : (
            <span className="text-muted">?</span>
          )}
          <span className="text-muted">· {t('players', { n: players })}</span>
          {stack && <span className="text-muted">· {stack}</span>}
          {extra && <span className="text-muted">· {extra}</span>}
        </span>
        <span aria-hidden className="text-muted">
          {open ? '▴' : '▾'}
        </span>
      </BarButton>
      <Collapse open={open}>{children}</Collapse>
    </div>
  );
}
