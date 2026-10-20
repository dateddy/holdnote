import type { ReactNode } from 'react';
import { InfoTip } from './info-tip';

type Props = {
  label: string;
  /** One-sentence explanation behind the "?"; leave out for self-evident figures. */
  tip?: { text: string; label: string };
  /** The figure, e.g. `<Result value={n}>+120 bb</Result>`. */
  children: ReactNode;
  /** Smaller line under the figure. */
  sub?: ReactNode;
};

/** Label with an optional "?", and one big figure. */
export function StatTile({ label, tip, children, sub }: Props) {
  return (
    <div className="min-w-0 space-y-1 rounded-md border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center gap-x-1 text-xs text-muted">
        <span>{label}</span>
        {tip && <InfoTip text={tip.text} label={tip.label} />}
      </div>
      <div className="text-lg font-semibold tabular-nums lg:text-2xl">{children}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}
