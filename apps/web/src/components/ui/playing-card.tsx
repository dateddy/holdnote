const SUIT_SYMBOL: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣', '?': '?' };
const RED = new Set(['h', 'd']);

/** One card as a small tile: rank + suit, red for hearts and diamonds. */
export function PlayingCard({ card, size = 'md' }: { card: string; size?: 'sm' | 'md' }) {
  const rank = card.slice(0, 1);
  const suit = card.slice(1);
  const dims = size === 'sm' ? 'h-7 min-w-6 px-1 text-sm' : 'h-9 min-w-8 px-1.5 text-lg';
  return (
    <span
      className={`inline-flex items-center justify-center rounded border border-line bg-surface font-semibold tabular-nums ${dims} ${
        RED.has(suit) ? 'text-loss' : ''
      }`}
    >
      {rank}
      {SUIT_SYMBOL[suit] ?? ''}
    </span>
  );
}

/** Several cards in a row. */
export function CardRow({ cards, size }: { cards: readonly string[]; size?: 'sm' | 'md' }) {
  return (
    <span className="inline-flex gap-1">
      {cards.map((c, i) => (
        <PlayingCard key={`${c}${i}`} card={c} {...(size && { size })} />
      ))}
    </span>
  );
}
