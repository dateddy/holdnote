import { canonPos, parseAmount, tableOrder, type BoardInput, type HandSetup } from 'poker-core';
import { POSITIONS, type Position } from 'poker-core';
import { isOneOf } from '@/lib/sessions/form';
import { blindsFor, boardCards, pickedOpponents, type HandDraft, type HandSession } from './build';

const num = (raw: string): number | undefined => {
  const n = parseAmount(raw);
  return n == null ? undefined : n;
};

/**
 * What the state machine needs before the first action. Null while the positions are missing or do
 * not sit at this table, so the screen shows the setup step instead of a half-built hand.
 */
export function draftToSetup(session: HandSession, draft: HandDraft, bb: number): HandSetup | null {
  if (!isOneOf(POSITIONS, draft.heroPos)) return null;
  const dealt = Number(draft.playersDealt.trim());
  const seats = Number.isInteger(dealt) && dealt >= 2 ? Math.min(10, dealt) : (session.seats ?? 9);
  const order = tableOrder(seats);
  const hero = canonPos(seats, draft.heroPos);
  if (!order.includes(hero)) return null;

  // Opponents that sit at this table, besides hero. The first one picked is 'villain'.
  const seen = new Set<Position>([hero]);
  const opponents = pickedOpponents(draft).flatMap((o) => {
    if (!isOneOf(POSITIONS, o.pos)) return [];
    const pos = canonPos(seats, o.pos);
    if (!order.includes(pos) || seen.has(pos)) return [];
    seen.add(pos);
    return [{ pos, stack: num(o.stack) }];
  });
  const [first, ...rest] = opponents;
  if (!first) return null;

  const blinds = blindsFor(session, bb, draft.ante);
  const sbTyped = session.kind === 'mtt' ? num(draft.levelSb) : undefined;
  const heroStack = num(draft.heroStack);
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
    villPos: first.pos,
    ...(rest.length > 0 && { tracked: rest.map((o) => o.pos) }),
    listedOnly: true,
    stacks: {
      ...(heroStack !== undefined && { [hero]: heroStack }),
      ...Object.fromEntries(
        opponents.filter((o) => o.stack !== undefined).map((o) => [o.pos, o.stack as number]),
      ),
    },
  };
}

/** The board as the machine reads it. */
export function boardInput(draft: HandDraft): BoardInput {
  return { cards: boardCards(draft) as BoardInput['cards'] };
}
