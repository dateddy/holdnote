import type { Action, Position, Street } from '../types';
import { replay } from './index';
import { postflopOrder } from './seats';
import type { BoardInput, HandSetup } from './types';

export interface StreetPlayers {
  street: Street;
  /** Seats still in at the start of the street, in postflop acting order. */
  players: Position[];
}

/** Who is still in when each postflop street that has actions begins. */
export function playersByStreet(
  setup: HandSetup,
  actions: readonly Action[],
  board?: BoardInput,
): StreetPlayers[] {
  const order = postflopOrder(setup.seats);
  const out: StreetPlayers[] = [];
  for (const street of ['flop', 'turn', 'river'] as const) {
    const first = actions.findIndex((a) => a.street === street);
    if (first < 0) continue;
    const state = replay(setup, actions.slice(0, first), board);
    const players = state.players
      .filter((p) => p.tracked && !p.folded)
      .map((p) => p.pos)
      .sort((a, b) => order.indexOf(a) - order.indexOf(b));
    out.push({ street, players });
  }
  return out;
}
