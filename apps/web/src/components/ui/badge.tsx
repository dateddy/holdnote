import type { ReactNode } from 'react';

type Tone = 'warn' | 'accent' | 'muted';

const TONE: Record<Tone, string> = {
  warn: 'bg-warn/15 text-warn',
  accent: 'bg-accent/15 text-accent',
  muted: 'bg-line text-muted',
};

/** Small label on a row: "Cần xem lại", "AI đã review", "Thiếu dữ liệu". */
export function Badge({ tone = 'muted', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex h-5 items-center rounded px-1.5 text-xs whitespace-nowrap ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}
