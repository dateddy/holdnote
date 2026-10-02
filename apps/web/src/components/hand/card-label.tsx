export const SUIT_SYMBOL: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣', '?': '?' };
export const RED = new Set(['h', 'd']);

export const cardLabel = (card: string) => {
  const suit = card.slice(1);
  return (
    <span className={RED.has(suit) ? 'text-red-600' : undefined}>
      {card.slice(0, 1)}
      {SUIT_SYMBOL[suit] ?? ''}
    </span>
  );
};
