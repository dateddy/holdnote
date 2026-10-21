import { toBb } from '../amount';
import {
  isPostAct,
  type Action,
  type Actor,
  type HandInput,
  type PlayerAct,
  type Position,
  type Street,
  type Verb,
} from '../types';
import { potType, type PotType } from './handfacts';
import { computePot } from './pot';

/** One chip of a hand row: who did what, and the size in bb (none for check and fold). */
export interface ActionChip {
  /** Index in `HandInput.actions` (forced bets included). */
  index: number;
  actor: Actor;
  pos?: Position;
  who?: string;
  act: PlayerAct;
  verb?: Verb;
  /** Street total after the action ("raise to"), in bb. */
  amountBb?: number;
}

export interface ActionChips {
  potType: PotType;
  streets: Record<Street, ActionChip[]>;
}

/**
 * The choices of a hand street by street, ready for a table row. Amounts come from the pot walk
 * (calls and all-ins resolved, capped by the stacks), so the screen never does poker math.
 */
export function actionChips(input: HandInput, bb: number): ActionChips {
  const { steps } = computePot(input);
  const streets: Record<Street, ActionChip[]> = { preflop: [], flop: [], turn: [], river: [] };
  for (const { index, action: a } of steps) {
    if (isPostAct(a.act) || a.act === 'dead') continue;
    const sized = a.amount !== undefined && a.act !== 'fold' && a.act !== 'check' && bb > 0;
    streets[a.street].push({
      index,
      actor: a.actor,
      ...(a.pos && { pos: a.pos }),
      ...(a.who && { who: a.who }),
      act: a.act,
      ...(a.verb && { verb: a.verb }),
      ...(sized && { amountBb: toBb(a.amount!, bb) }),
    });
  }
  return { potType: potType(steps, input.blinds.bb), streets };
}

/**
 * True when at least two players were still in at the end: nobody won by everyone else folding.
 * Hero and villain count as in the hand when their position is known.
 */
export function wentToShowdown(input: HandInput): boolean {
  const { heroPos, villPos } = input;
  const keyOf = (a: Action): string | null => {
    if (a.actor === 'hero') return 'hero';
    if (a.actor === 'villain') return 'villain';
    if (a.pos) return a.pos === heroPos ? 'hero' : a.pos === villPos ? 'villain' : a.pos;
    return a.who ?? null;
  };
  const seen = new Set<string>();
  const folded = new Set<string>();
  if (heroPos) seen.add('hero');
  if (villPos) seen.add('villain');
  for (const a of input.actions) {
    const key = keyOf(a);
    if (!key || a.act === 'dead') continue;
    seen.add(key);
    if (a.act === 'fold') folded.add(key);
  }
  return [...seen].filter((k) => !folded.has(k)).length >= 2;
}
