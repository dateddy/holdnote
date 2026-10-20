import { roundMoney } from '../amount';
import {
  STREETS,
  isPostAct,
  type Action,
  type HandInput,
  type Position,
  type Street,
} from '../types';

export type PotIssue =
  'missing_players_for_ante' | 'missing_amount' | 'all_in_without_stack' | 'missing_actor';

export interface ActionStep {
  /** Index in `HandInput.actions`. */
  index: number;
  /** The action with its amount resolved. */
  action: Action;
  /** Pot (all streets, current bets included) just before / after this action. */
  potBefore: number;
  potAfter: number;
  /** What the actor had to put in to call before acting, capped by their stack. */
  toCall: number;
  /** Largest bet on the table this street just before this action (preflop: blinds included). */
  level: number;
  /** Index of the last bet/raise on this street before this action, if any. */
  facingIndex: number | null;
}

export interface StreetSummary {
  street: Street;
  /** Pot before the first action of the street (preflop: dead antes only). */
  potStart: number;
  /** Pot after the street, uncalled bets returned. */
  potEnd: number;
  heroInvestedAtStart: number;
  villainInvestedAtStart: number;
}

export interface PotResult {
  steps: ActionStep[];
  /** Streets that have at least one action (preflop always). */
  streets: StreetSummary[];
  pot: number;
  /** Total put in per seat key (`hero`, `villain`, a position, or a label like `V1`), antes included. */
  invested: Record<string, number>;
  heroInvested: number;
  villainInvested: number;
  heroSeen: boolean;
  /** False when something needed for exact money is missing; see `issues`. */
  exact: boolean;
  /** Hero's own chips are known even if the pot is not (only the player count is missing). */
  heroExact: boolean;
  issues: PotIssue[];
}

const HERO = 'hero';
const VILLAIN = 'villain';

/**
 * Walk the hand and compute the pot after every action.
 *
 * Amounts are street totals ("raise to"). Calls match the current level, all-ins without an
 * amount use the remaining stack, and both are capped by the stack when it is known. At the end
 * of each street the uncalled part of the largest bet goes back to its owner. Antes are dead
 * money: they go into the pot and count as invested, but never as a bet on the street.
 */
export function computePot(input: HandInput): PotResult {
  const { blinds, heroPos, villPos } = input;
  const issues = new Set<PotIssue>();
  const invested: Record<string, number> = {};
  const add = (key: string, n: number) => {
    invested[key] = roundMoney((invested[key] ?? 0) + n);
  };

  const keyOfPos = (pos: Position): string =>
    pos === heroPos ? HERO : pos === villPos ? VILLAIN : pos;
  const keyOf = (a: Action): string | null => {
    if (a.actor === 'hero') return HERO;
    if (a.actor === 'villain') return VILLAIN;
    if (a.pos) return keyOfPos(a.pos);
    return a.who ?? null;
  };
  const stackOf = (key: string): number | undefined =>
    key === HERO
      ? input.heroStack
      : key === VILLAIN
        ? input.villStack
        : input.seatStacks?.[key as Position];

  // Forced bets recorded as actions (DEC-045) replace the ones derived from `blinds`.
  const hasPosts = input.actions.some((a) => isPostAct(a.act));

  // A seat is out of the hand once it folds; a seat that only posted forced bets and never chose
  // to act (and is neither hero nor villain) is out too, as long as somebody else is still in.
  // Chips are never returned to a seat that is out. When nobody known is left (a lone "H f"), the
  // unknown seat that takes the pot is the one holding the biggest forced bet: a walk.
  const folded = new Set<string>();
  const acted = new Set<string>();
  for (const a of input.actions) {
    const key = keyOf(a);
    if (!key || isPostAct(a.act) || a.act === 'dead') continue;
    acted.add(key);
    if (a.act === 'fold') folded.add(key);
  }
  const known = new Set(acted);
  if (heroPos || input.actions.some((a) => a.actor === 'hero')) known.add(HERO);
  if (villPos || input.actions.some((a) => a.actor === 'villain')) known.add(VILLAIN);
  const someoneLeft = [...known].some((k) => !folded.has(k));
  const inHand = (key: string) =>
    !folded.has(key) && (key === HERO || key === VILLAIN || acted.has(key) || !someoneLeft);

  // Dead antes.
  let pot = 0;
  const ante = blinds.ante;
  if (hasPosts) {
    // Posted ante actions are added to the pot below, before the first street.
  } else if (ante.mode === 'each' && ante.amount > 0) {
    // Hero and villain always pay their own ante; the pot also needs the head count.
    add(HERO, ante.amount);
    if (villPos || input.actions.some((a) => a.actor === 'villain')) add(VILLAIN, ante.amount);
    if (input.playersDealt && input.playersDealt > 0) {
      pot = roundMoney(ante.amount * input.playersDealt);
    } else {
      pot = roundMoney((invested[HERO] ?? 0) + (invested[VILLAIN] ?? 0));
      issues.add('missing_players_for_ante');
    }
  } else if (ante.mode === 'bb' && ante.amount > 0) {
    pot = roundMoney(ante.amount);
    add(keyOfPos('BB'), ante.amount);
  }

  const steps: ActionStep[] = [];
  const streets: StreetSummary[] = [];
  const indexed = input.actions.map((action, index) => ({ action, index }));

  // Posted antes and later dead money go straight into the pot and count as invested.
  const addDead = (key: string, amount: number, prior?: Record<string, number>) => {
    pot = roundMoney(pot + amount);
    add(key, amount);
    if (prior) prior[key] = roundMoney((prior[key] ?? 0) + amount);
  };
  for (const { action } of indexed) {
    const key = keyOf(action);
    if (action.act === 'post_ante' && key && action.amount) addDead(key, action.amount);
  }

  for (const street of STREETS) {
    const streetActions = indexed.filter((x) => x.action.street === street);
    if (street !== 'preflop' && streetActions.length === 0) continue;

    const summary: StreetSummary = {
      street,
      potStart: pot,
      potEnd: pot,
      heroInvestedAtStart: invested[HERO] ?? 0,
      villainInvestedAtStart: invested[VILLAIN] ?? 0,
    };
    const bets: Record<string, number> = {};
    const priorInvested = { ...invested };
    /** Most this seat can have in front of it on this street. */
    const cap = (key: string): number => {
      const stack = stackOf(key);
      return stack === undefined ? Infinity : roundMoney(stack - (priorInvested[key] ?? 0));
    };
    const streetSum = () => Object.values(bets).reduce((s, n) => s + n, 0);
    let level = 0;
    let facingIndex: number | null = null;

    if (street === 'preflop' && !hasPosts) {
      const post = (pos: Position, amount: number) => {
        const key = keyOfPos(pos);
        bets[key] = Math.min(amount, cap(key));
        level = Math.max(level, amount);
      };
      post('SB', blinds.sb);
      post('BB', blinds.bb);
      if (blinds.straddle) post(blinds.straddlePos ?? 'UTG', blinds.straddle);
    }

    for (const { action, index } of streetActions) {
      const key = keyOf(action);
      const potBefore = roundMoney(pot + streetSum());
      const before = key ? (bets[key] ?? 0) : 0;
      const toCall = key ? roundMoney(Math.max(0, Math.min(level, cap(key)) - before)) : 0;
      const facing = facingIndex;
      const resolved: Action = { ...action };
      delete resolved.amount;

      if (action.act === 'post_ante') {
        resolved.amount = action.amount;
      } else if (action.act === 'dead') {
        if (!key) issues.add('missing_actor');
        else if (action.amount !== undefined) {
          addDead(key, action.amount, priorInvested);
          resolved.amount = action.amount;
        }
      } else if (
        action.act === 'post_sb' ||
        action.act === 'post_bb' ||
        action.act === 'post_straddle'
      ) {
        if (!key) issues.add('missing_actor');
        else if (action.amount !== undefined) {
          bets[key] = roundMoney(Math.min(action.amount, cap(key)));
          level = Math.max(level, action.amount);
          resolved.amount = action.amount;
        }
      } else if (
        action.act === 'call' ||
        action.act === 'bet' ||
        action.act === 'raise' ||
        action.act === 'all-in'
      ) {
        if (!key) {
          issues.add('missing_actor');
        } else {
          let target: number | undefined;
          if (action.act === 'call') target = level;
          else if (action.amount !== undefined) target = action.amount;
          else if (action.act === 'all-in') {
            target = cap(key);
            if (target === Infinity) {
              issues.add('all_in_without_stack');
              target = undefined;
            }
          } else issues.add('missing_amount');

          if (target !== undefined) {
            const amount = roundMoney(Math.max(before, Math.min(target, cap(key))));
            bets[key] = amount;
            resolved.amount = amount;
            if (amount > level) {
              level = amount;
              facingIndex = index;
            }
          }
        }
      }

      steps.push({
        index,
        action: resolved,
        potBefore,
        potAfter: roundMoney(pot + streetSum()),
        toCall: isPostAct(action.act) || action.act === 'dead' ? 0 : toCall,
        level,
        facingIndex: facing,
      });
    }

    // Return the uncalled part of the largest bet.
    const sorted = Object.entries(bets).sort((a, b) => b[1] - a[1]);
    const top = sorted[0];
    if (top && inHand(top[0])) {
      const second = sorted[1]?.[1] ?? 0;
      if (top[1] > second) bets[top[0]] = second;
    }
    for (const [key, amount] of Object.entries(bets)) add(key, amount);
    pot = roundMoney(pot + streetSum());
    summary.potEnd = pot;
    streets.push(summary);
  }

  return {
    steps,
    streets,
    pot,
    invested,
    heroInvested: invested[HERO] ?? 0,
    villainInvested: invested[VILLAIN] ?? 0,
    heroSeen: input.actions.some((a) => a.actor === 'hero'),
    exact: issues.size === 0,
    heroExact: [...issues].every((i) => i === 'missing_players_for_ante'),
    issues: [...issues],
  };
}

/** Actions with call / all-in amounts filled in. Shared by both entry modes. */
export function resolveActions(input: HandInput): Action[] {
  return computePot(input).steps.map((s) => s.action);
}
