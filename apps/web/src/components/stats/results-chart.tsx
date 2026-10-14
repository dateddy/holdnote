import type { SeriesPoint } from 'poker-core';

const W = 320;
const H = 160;
const PAD = { top: 12, right: 12, bottom: 12, left: 12 };

type Props = {
  points: SeriesPoint[];
  /** Formats a y value for the labels, e.g. `+12 bb`. */
  format: (n: number) => string;
  /** Text read by screen readers. */
  label: string;
};

/** Running total, one point per session. Plain SVG: no chart library. */
export function ResultsChart({ points, format, label }: Props) {
  if (points.length === 0) return null;

  const values = points.map((p) => p.cumulative);
  // Always include 0 so the line shows whether you are up or down overall.
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) =>
    PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD.top + ((max - v) / span) * innerH;

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.cumulative).toFixed(1)}`)
    .join(' ');
  const last = points[points.length - 1]!;

  return (
    <figure className="space-y-1">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="h-auto w-full">
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(0)}
          y2={y(0)}
          stroke="currentColor"
          strokeOpacity="0.3"
          strokeDasharray="4 4"
        />
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <circle
            key={p.sessionId}
            cx={x(i)}
            cy={y(p.cumulative)}
            r={points.length > 40 ? 1.5 : 3}
            fill="currentColor"
          >
            <title>{`${p.date}: ${format(p.cumulative)}`}</title>
          </circle>
        ))}
      </svg>
      <figcaption className="flex justify-between text-xs opacity-70">
        <span>{points[0]!.date}</span>
        <span>
          {format(last.cumulative)} · {last.date}
        </span>
      </figcaption>
    </figure>
  );
}
