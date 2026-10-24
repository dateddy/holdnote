/** The bet in front of a seat on the replay table, already formatted (bb). */
export function BetChip({ children }: { children: string }) {
  return (
    <span className="inline-flex h-6 items-center rounded-xl border border-line bg-background px-1.5 text-xs font-medium whitespace-nowrap tabular-nums">
      {children}
    </span>
  );
}
