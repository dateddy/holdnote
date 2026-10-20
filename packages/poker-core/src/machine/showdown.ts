import { roundMoney } from '../amount';
import { compareRanks, evaluate, type HandRank } from '../engine/evaluate';
import { buildPots, chipUnit, settlePots } from '../engine/sidepot';
import type { Action, Card, Position } from '../types';
import { replay } from './index';
import { canonPos, postflopOrder } from './seats';
import type { BoardInput, HandSetup } from './types';

export interface ShowdownInput {
  /** Hole cards known so far, by seat. */
  hole: Partial<Record<Position, readonly Card[]>>;
  /** Winners the player picked, per pot (main pot first); null = not picked. */
  choices?: readonly (readonly Position[] | null)[];
}

export interface PotOutcome {
  amount: number;
  eligible: Position[];
  /** Null while nobody is known to win it. */
  winners: Position[] | null;
  /** How `winners` was found: the others folded, the cards, or the player's pick. */
  by: 'fold' | 'cards' | 'choice' | null;
  /** Who the cards say wins; null when the cards are not all known. */
  byCards: Position[] | null;
}

export interface ShowdownResult {
  pots: PotOutcome[];
  /** Chips each seat takes back from the pots. */
  payouts: Partial<Record<Position, number>>;
  /** Hero's net result; null while a pot still has no winner. */
  heroResult: number | null;
  /** Some pot has no winner yet: ask the player. */
  needsChoice: boolean;
  /** A pick contradicts what the cards say. */
  mismatch: boolean;
  ranks: Partial<Record<Position, HandRank>>;
}

/**
 * Who wins what once the betting is over: pots by contribution level, the winner of each from the
 * cards when every eligible hand is known, else from `choices`. No rake. Null while the hand goes on.
 */
export function showdown(
  setup: HandSetup,
  actions: readonly Action[],
  board: BoardInput,
  input: ShowdownInput,
): ShowdownResult | null {
  const state = replay(setup, actions, board);
  if (!['won', 'showdown', 'runout'].includes(state.phase.kind)) return null;

  const hero = canonPos(setup.seats, setup.heroPos);
  const entries = state.players
    .filter((p) => p.tracked || p.invested > 0)
    .map((p) => ({ seat: p.pos, invested: p.invested, folded: p.folded || !p.tracked }));
  const pots = buildPots(entries);

  const full = board.cards.length >= 5 ? board.cards.slice(0, 5) : null;
  const ranks: Partial<Record<Position, HandRank>> = {};
  for (const p of state.players) {
    const hole = input.hole[p.pos];
    if (!full || !hole || hole.length !== 2 || p.folded || !p.tracked) continue;
    const r = evaluate([...hole, ...full]);
    if (r) ranks[p.pos] = r;
  }

  let mismatch = false;
  const outcomes: PotOutcome[] = pots.map((pot, i) => {
    const eligible = pot.eligible;
    let byCards: Position[] | null = null;
    const known = eligible.map((s) => ranks[s]);
    if (eligible.length > 1 && known.every((r) => r)) {
      let best: HandRank | null = null;
      let tied: Position[] = [];
      eligible.forEach((s, k) => {
        const r = known[k] as HandRank;
        const c = best ? compareRanks(r, best) : 1;
        if (c > 0) {
          best = r;
          tied = [s];
        } else if (c === 0) tied.push(s);
      });
      byCards = tied;
    }
    const picked = (input.choices?.[i] ?? []).filter((s) => eligible.includes(s));
    let winners: Position[] | null = null;
    let by: PotOutcome['by'] = null;
    if (eligible.length === 1) {
      winners = eligible;
      by = 'fold';
    } else if (picked.length > 0) {
      winners = picked;
      by = 'choice';
      if (
        byCards &&
        (byCards.length !== picked.length || byCards.some((s) => !picked.includes(s)))
      ) {
        mismatch = true;
      }
    } else if (byCards) {
      winners = byCards;
      by = 'cards';
    }
    return { amount: pot.amount, eligible, winners, by, byCards };
  });

  const unit = chipUnit([
    setup.sb,
    setup.bb,
    ...entries.map((e) => e.invested),
    ...pots.map((p) => p.amount),
  ]);
  const { payouts } = settlePots(
    entries,
    (i) => outcomes[i]?.winners ?? null,
    postflopOrder(setup.seats),
    unit,
  );

  const me = state.players.find((p) => p.pos === hero);
  const invested = me?.invested ?? 0;
  const folded = Boolean(me?.folded);
  const undecided = outcomes.some((o) => !o.winners);
  return {
    pots: outcomes,
    payouts,
    heroResult: folded
      ? roundMoney(-invested)
      : undecided
        ? null
        : roundMoney((payouts[hero] ?? 0) - invested),
    needsChoice: !folded && undecided,
    mismatch,
    ranks,
  };
}
