import {
  canonPos,
  computePot,
  parseAmount,
  playersByStreet,
  potType,
  type Ante,
  type Position,
  type PotType,
  type Street,
} from 'poker-core';
import {
  opponentCards,
  pickedOpponents,
  type HandDerived,
  type HandDraft,
  type HandSession,
} from '@/lib/hands/build';
import { draftToSetup } from '@/lib/hands/setup';

export type OpponentFact = {
  pos: string;
  main: boolean;
  /** Chips; null when unknown. */
  stack: number | null;
  cards: string[];
  player_type: string | null;
  notes: string | null;
};

/**
 * What the state machine knows about the table and the betting, in chips. Everything here is
 * computed by poker-core; the renderer only converts to bb and words. No winners: the review
 * judges decisions, not results (DEC-036 (6)).
 */
export type TableFacts = {
  /** Straddle levels, first straddler first. */
  straddles: number[];
  ante: Ante;
  /** Blinds of the level, shown for tournaments. */
  blinds: { sb: number; bb: number };
  potType: PotType;
  streetPlayers: { street: Street; count: number }[];
  /** Main opponent first. */
  opponents: OpponentFact[];
  /** Only when there is more than one pot. Main pot first. */
  pots: { amount: number; eligible: string[] }[];
  uncalled: { street: Street; who: string; amount: number }[];
};

export type OpponentInfo = Record<string, { player_type: string | null; notes: string | null }>;

/** Null for hands without a state machine (legacy hands, no hero seat, no blinds). */
export function buildTableFacts(
  session: HandSession,
  draft: HandDraft,
  d: HandDerived,
  info: OpponentInfo = {},
): TableFacts | null {
  if (draft.legacy || !d.input || d.bb == null) return null;
  const setup = draftToSetup(session, draft, d.bb);
  if (!setup) return null;

  const seat = (p: string) => canonPos(setup.seats, p as Position);
  const hero = seat(setup.heroPos);
  const picked = pickedOpponents(draft);
  const mainPos = d.primary ? seat(d.primary.pos) : seat(setup.villPos);
  const label = (pos: string) =>
    pos === hero ? `Hero (${pos})` : pos === mainPos ? `Villain (${pos})` : pos;

  const opponents = picked
    .map((o): OpponentFact => {
      const known = info[o.opponentId];
      return {
        pos: seat(o.pos),
        main: seat(o.pos) === mainPos,
        stack: parseAmount(o.stack) ?? null,
        cards: opponentCards(o).filter(Boolean),
        player_type: known?.player_type ?? null,
        notes: known?.notes ?? null,
      };
    })
    .sort((a, b) => Number(b.main) - Number(a.main));

  const pot = computePot(d.input);
  const uncalled = pot.streets.flatMap((s) =>
    s.uncalled
      ? [
          {
            street: s.street,
            who:
              s.uncalled.key === 'hero'
                ? label(hero)
                : s.uncalled.key === 'villain'
                  ? label(mainPos)
                  : label(s.uncalled.key),
            amount: s.uncalled.amount,
          },
        ]
      : [],
  );

  const pots = d.showdown && d.showdown.pots.length > 1 ? d.showdown.pots : [];
  return {
    straddles: setup.straddles ?? [],
    ante: setup.ante,
    blinds: { sb: setup.sb, bb: setup.bb },
    potType: potType(pot.steps, setup.bb),
    streetPlayers: playersByStreet(setup, d.input.actions).map((s) => ({
      street: s.street,
      count: s.players.length,
    })),
    opponents,
    pots: pots.map((p) => ({ amount: p.amount, eligible: p.eligible.map(label) })),
    uncalled,
  };
}
