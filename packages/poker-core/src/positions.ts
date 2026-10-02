import { POSITIONS, type Position } from './types';

const ALIASES: Record<string, Position> = {
  BU: 'BTN',
  '+1': 'UTG+1',
  'U+1': 'UTG+1',
  UTG1: 'UTG+1',
};

/** Canonical position for a typed token (`btn`, `BU`, `+1`, `SB:`), or null. */
export function normalizePosition(token: string): Position | null {
  const t = token
    .trim()
    .toUpperCase()
    .replace(/[:,]+$/, '');
  if ((POSITIONS as readonly string[]).includes(t)) return t as Position;
  return ALIASES[t] ?? null;
}
