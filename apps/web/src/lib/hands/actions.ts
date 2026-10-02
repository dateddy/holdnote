import { POSITIONS, type Action, type Position, type Street } from 'poker-core';
import { isOneOf } from '@/lib/sessions/form';

/** Postflop order: SB first, BTN last. */
const POSTFLOP_ORDER: Position[] = ['SB', 'BB', 'UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN'];

/** Who acts next in the heads-up line: first actor of the street, then alternate. */
export function defaultActor(
  street: Street,
  actions: Action[],
  heroPos: string,
  villPos: string,
): 'hero' | 'villain' {
  const onStreet = actions.filter((a) => a.street === street);
  const last = onStreet[onStreet.length - 1];
  if (last) return last.actor === 'hero' ? 'villain' : 'hero';
  if (!isOneOf(POSITIONS, heroPos) || !isOneOf(POSITIONS, villPos)) return 'hero';
  const order = street === 'preflop' ? [...POSITIONS] : POSTFLOP_ORDER;
  return order.indexOf(heroPos) <= order.indexOf(villPos) ? 'hero' : 'villain';
}

export function removeLastOnStreet(actions: Action[], street: Street): Action[] {
  for (let i = actions.length - 1; i >= 0; i--) {
    if (actions[i]?.street === street) return actions.filter((_, j) => j !== i);
  }
  return actions;
}
