import { canonPos, parseAmount, tableOrder, type BoardInput, type HandSetup } from 'poker-core';
import { POSITIONS, type Position } from 'poker-core';
import { isOneOf } from '@/lib/sessions/form';
import { blindsFor, boardCards, type HandDraft, type HandSession } from './build';

const num = (raw: string): number | undefined => {
  const n = parseAmount(raw);
  return n == null ? undefined : n;
};

/**
 * What the state machine needs before the first action. Null while the positions are missing or do
 * not sit at this table, so the screen shows the setup step instead of a half-built hand.
 */
export function draftToSetup(session: HandSession, draft: HandDraft, bb: number): HandSetup | null {
  if (!isOneOf(POSITIONS, draft.heroPos) || !isOneOf(POSITIONS, draft.villPos)) return null;
  const dealt = Number(draft.playersDealt.trim());
  const seats = Number.isInteger(dealt) && dealt >= 2 ? dealt : (session.seats ?? 9);
  const order = tableOrder(seats);
  const hero = canonPos(seats, draft.heroPos);
  const vill = canonPos(seats, draft.villPos);
  if (!order.includes(hero) || !order.includes(vill) || hero === vill) return null;

  const blinds = blindsFor(session, bb, draft.ante);
  const sbTyped = session.kind === 'mtt' ? num(draft.levelSb) : undefined;
  const heroStack = num(draft.heroStack);
  const villStack = num(draft.villStack);
  const straddles =
    session.kind === 'cash'
      ? draft.straddles.map((s) => num(s)).filter((n): n is number => n !== undefined && n > 0)
      : [];

  return {
    seats,
    sb: sbTyped && sbTyped > 0 ? sbTyped : blinds.sb,
    bb,
    ante: blinds.ante,
    ...(straddles.length > 0 && { straddles }),
    heroPos: draft.heroPos as Position,
    villPos: draft.villPos as Position,
    stacks: {
      ...(heroStack !== undefined && { [hero]: heroStack }),
      ...(villStack !== undefined && { [vill]: villStack }),
    },
  };
}

/** The board as the machine reads it. */
export function boardInput(draft: HandDraft): BoardInput {
  return {
    cards: boardCards(draft) as BoardInput['cards'],
    skipped: draft.boardSkipped,
  };
}
