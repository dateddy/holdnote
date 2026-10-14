/** A signed number coloured green for a win, red for a loss. */
export function Result({ value, children }: { value: number | null; children: React.ReactNode }) {
  const tone = value == null || value === 0 ? '' : value > 0 ? 'text-win' : 'text-loss';
  return <span className={`tabular-nums ${tone}`.trim()}>{children}</span>;
}
