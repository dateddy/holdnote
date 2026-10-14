import { PlayingCard } from '@/components/ui/playing-card';

export const SUIT_SYMBOL: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣', '?': '?' };
export const RED = new Set(['h', 'd']);

export const cardLabel = (card: string, size?: 'sm' | 'md') => (
  <PlayingCard card={card} {...(size && { size })} />
);
