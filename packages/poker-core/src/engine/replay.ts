import { roundMoney } from '../amount';
import { isPostAct, type HandInput, type Position, type Street } from '../types';
import { computePot, type PotSnapshot } from './pot';

/** One seat at one moment of the replay. */
export interface ReplaySeat {
  /** Everything this seat has put in the pot so far. */
  invested: number;
  /** Chips in front of the seat on the current street. */
  streetBet: number;
  /** Chips behind; undefined when the starting stack is not known. */
  stack?: number;
  folded: boolean;
  allIn: boolean;
}

export interface ReplayFrame {
  /** Index in `HandInput.actions` of the action just played; null for the first and last frame. */
  index: number | null;
  street: Street;
  /** The last frame: uncalled bets are back with their owners, the pot is the final one. */
  final: boolean;
  /** Pot with the current street's bets in it. */
  pot: number;
  /** By seat key: `hero`, `villain`, a position, or a label such as `V1`. */
  seats: Record<string, ReplaySeat>;
}

/**
 * The hand step by step for a replayer: the table after the blinds, after every choice, and at the
 * end. Money is in the session's unit; stacks come from the starting stacks minus what went in.
 */
export function replayFrames(input: HandInput): ReplayFrame[] {
  const pot = computePot(input);
  const keyOfPos = (pos: Position): string =>
    pos === input.heroPos ? 'hero' : pos === input.villPos ? 'villain' : pos;
  const keyOf = (a: HandInput['actions'][number]): string | null =>
    a.actor === 'hero'
      ? 'hero'
      : a.actor === 'villain'
        ? 'villain'
        : a.pos
          ? keyOfPos(a.pos)
          : (a.who ?? null);
  const stack0 = (key: string): number | undefined =>
    key === 'hero'
      ? input.heroStack
      : key === 'villain'
        ? input.villStack
        : input.seatStacks?.[key as Position];

  const folded = new Set<string>();
  const known = new Set<string>();
  if (input.heroPos) known.add('hero');
  if (input.villPos) known.add('villain');
  for (const a of input.actions) {
    const key = keyOf(a);
    if (key && !isPostAct(a.act) && a.act !== 'dead') known.add(key);
  }

  const frame = (
    snap: PotSnapshot,
    street: Street,
    index: number | null,
    final: boolean,
  ): ReplayFrame => {
    const keys = new Set([
      ...known,
      ...Object.keys(snap.committed),
      ...Object.keys(snap.streetBets),
    ]);
    const seats: Record<string, ReplaySeat> = {};
    for (const key of keys) {
      const invested = snap.committed[key] ?? 0;
      const start = stack0(key);
      const stack = start === undefined ? undefined : Math.max(0, roundMoney(start - invested));
      seats[key] = {
        invested,
        streetBet: snap.streetBets[key] ?? 0,
        ...(stack !== undefined && { stack }),
        folded: folded.has(key),
        allIn: stack === 0 && !folded.has(key),
      };
    }
    return { index, street, final, pot: snap.pot, seats };
  };

  const frames: ReplayFrame[] = [frame(pot.start, 'preflop', null, false)];
  let last: Street = 'preflop';
  for (const step of pot.steps) {
    const { action } = step;
    if (isPostAct(action.act) || action.act === 'dead') continue;
    const key = keyOf(action);
    if (action.act === 'fold' && key) folded.add(key);
    last = action.street;
    frames.push(
      frame(
        { pot: step.potAfter, streetBets: step.streetBets, committed: step.committed },
        action.street,
        step.index,
        false,
      ),
    );
  }
  frames.push(frame({ pot: pot.pot, streetBets: {}, committed: pot.invested }, last, null, true));
  return frames;
}
