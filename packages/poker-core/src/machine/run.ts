import { roundMoney } from '../amount';
import { isPostAct, type Action, type Actor, type Position, type Street } from '../types';
import { actorAt, canonPos, forcedBets, maxStraddles, tableOrder } from './seats';
import type {
  BoardInput,
  ButtonKind,
  HandSetup,
  HandState,
  Notice,
  Phase,
  SeatState,
} from './types';

const NEXT_STREET: Record<Street, Exclude<Street, 'preflop'> | null> = {
  preflop: 'flop',
  flop: 'turn',
  turn: 'river',
  river: null,
};

interface Seat {
  pos: Position;
  actor: Actor;
  tracked: boolean;
  stack?: number;
  /** Closed streets, antes and dead money. */
  committed: number;
  /** In front of the seat on the current street. */
  bet: number;
  folded: boolean;
  allIn: boolean;
  needsAct: boolean;
  mayRaise: boolean;
}

/** Forced bets are part of `actions` (DEC-045); hands saved without them get them prepended. */
export function ensureForced(setup: HandSetup, actions: readonly Action[]): Action[] {
  return actions.some((a) => isPostAct(a.act)) ? [...actions] : [...forcedBets(setup), ...actions];
}

/**
 * Walk the hand from the first forced bet. Actions that do not fit the betting (out of turn,
 * after the hand ended, an illegal button) are skipped and listed in `invalid`; nothing is removed.
 * `extra` seats are treated as followed, which is how `addable` is found.
 */
export function run(
  setup: HandSetup,
  given: readonly Action[],
  board?: BoardInput,
  extra: readonly Position[] = [],
): HandState {
  const full = ensureForced(setup, given);
  const n = setup.seats;
  const order = tableOrder(n);
  const cp = (p: Position) => canonPos(n, p);
  const hero = cp(setup.heroPos);
  const vill = cp(setup.villPos);
  if (!order.includes(hero) || !order.includes(vill) || hero === vill) {
    throw new RangeError(`hero ${setup.heroPos} / villain ${setup.villPos} do not fit ${n} seats`);
  }

  const posOf = (a: Action): Position | null => {
    const p = a.pos ? cp(a.pos) : a.actor === 'hero' ? hero : a.actor === 'villain' ? vill : null;
    return p && order.includes(p) ? p : null;
  };

  const trackedSet = new Set<Position>([
    hero,
    vill,
    ...(setup.tracked ?? []).map(cp),
    ...extra.map(cp),
  ]);
  for (const a of full) {
    if (isPostAct(a.act) || a.act === 'dead') continue;
    const p = posOf(a);
    if (p) trackedSet.add(p);
  }

  const stackOf = (p: Position): number | undefined =>
    setup.stacks?.[p] ?? (n <= 2 && p === 'SB' ? setup.stacks?.BTN : undefined);

  const seatList: Seat[] = order.map((pos) => ({
    pos,
    actor: actorAt(setup, pos),
    tracked: trackedSet.has(pos),
    stack: stackOf(pos),
    committed: 0,
    bet: 0,
    folded: false,
    allIn: false,
    needsAct: false,
    mayRaise: true,
  }));
  const seatMap = new Map(seatList.map((s) => [s.pos, s]));

  const k = Math.min(full.filter((a) => a.act === 'post_straddle').length, maxStraddles(n));
  const preOrder = [...order.slice(k), ...order.slice(0, k)];
  const postOrder: Position[] =
    n <= 2 ? ['BB', 'SB'] : ['SB', 'BB', ...order.slice(0, order.indexOf('BTN')), 'BTN'];

  // Cast so TypeScript does not narrow these to their first value; the closures below reassign them.
  let street = 'preflop' as Street;
  let pending = null as Exclude<Street, 'preflop'> | null;
  let ended = null as Phase | null;
  let potClosed = 0;
  let level = 0;
  let openLevel = 0;
  let lastRaise = setup.bb;
  let ptr = -1;
  let started = false;
  let playerActed = false;
  const invalid = new Set<number>();
  const warnings: Notice[] = [];
  const resolved: Action[] = full.map((a) => ({ ...a }));

  const streetOrder = () => (street === 'preflop' ? preOrder : postOrder);
  const cap = (s: Seat) =>
    s.stack === undefined ? Infinity : Math.max(0, roundMoney(s.stack - s.committed));
  const alive = () => seatList.filter((s) => s.tracked && !s.folded);
  const bad = (i: number, code: 'illegal_act' | 'out_of_turn' | 'stack_unknown') => {
    invalid.add(i);
    warnings.push({ code, index: i });
  };

  const nextToAct = (): Seat | null => {
    const list = streetOrder();
    for (let step = 1; step <= list.length; step++) {
      const p = list[(ptr + step) % list.length];
      const s = p ? seatMap.get(p) : undefined;
      if (s && s.tracked && !s.folded && !s.allIn && s.needsAct) return s;
    }
    return null;
  };

  const resetRound = () => {
    ptr = -1;
    for (const s of seatList) {
      s.needsAct = s.tracked && !s.folded && !s.allIn;
      s.mayRaise = true;
    }
  };

  const ensureStarted = () => {
    if (started) return;
    started = true;
    openLevel = level;
    lastRaise = Math.max(level, setup.bb);
    resetRound();
  };

  const startStreet = (next: Exclude<Street, 'preflop'>) => {
    street = next;
    pending = null;
    level = 0;
    openLevel = 0;
    lastRaise = setup.bb;
    resetRound();
  };

  /** End the betting round: give the uncalled part back, move bets into the pot, pick what is next. */
  const closeStreet = () => {
    const withBets = seatList.filter((s) => s.bet > 0).sort((a, b) => b.bet - a.bet);
    const top = withBets[0];
    if (top) top.bet = Math.min(top.bet, withBets[1]?.bet ?? 0);
    for (const s of seatList) {
      s.committed = roundMoney(s.committed + s.bet);
      potClosed = roundMoney(potClosed + s.bet);
      s.bet = 0;
    }
    level = 0;

    const live = alive();
    if (live.length <= 1) {
      ended = { kind: 'won', winner: live[0]?.pos ?? hero };
      return;
    }
    if (street === 'river') {
      ended = { kind: 'showdown' };
      return;
    }
    if (live.filter((s) => !s.allIn).length <= 1) {
      const missing = 5 - (board?.cards.length ?? 0);
      ended = missing <= 0 ? { kind: 'showdown' } : { kind: 'runout', missing };
      return;
    }
    pending = NEXT_STREET[street];
  };

  /** Buttons of spec section 7 for a seat that is to act. */
  const buttonsFor = (s: Seat): ButtonKind[] => {
    const left = cap(s) - s.bet;
    const owe = level - s.bet;
    const first = street === 'preflop' && level <= openLevel;
    if (owe > 0) {
      const out: ButtonKind[] = ['fold', 'call'];
      if (s.mayRaise && left > owe) out.push(first ? 'open' : 'raise', 'all-in');
      return out;
    }
    const out: ButtonKind[] = ['check'];
    if (left > 0) out.push(first ? 'open' : level === 0 ? 'bet' : 'raise', 'all-in');
    return out;
  };

  const applyBet = (seat: Seat, target: number, allIn: boolean) => {
    seat.bet = target;
    if (allIn) seat.allIn = true;
    if (target > level) {
      const size = roundMoney(target - level);
      const reopens = !allIn || size >= lastRaise;
      level = target;
      if (reopens) {
        if (size >= lastRaise) lastRaise = size;
        for (const o of seatList) {
          if (o === seat || !o.tracked || o.folded || o.allIn) continue;
          o.needsAct = true;
          o.mayRaise = true;
        }
      } else {
        // A short all-in: those who already acted may only call or fold.
        for (const o of seatList) {
          if (o === seat || !o.tracked || o.folded || o.allIn || o.needsAct) continue;
          o.needsAct = true;
          o.mayRaise = false;
        }
      }
    }
    seat.needsAct = false;
  };

  full.forEach((a, i) => {
    // Forced bets.
    if (isPostAct(a.act)) {
      const p = posOf(a);
      const s = p ? seatMap.get(p) : undefined;
      if (playerActed || !s || a.amount === undefined) return bad(i, 'illegal_act');
      if (a.act === 'post_ante') {
        s.committed = roundMoney(s.committed + a.amount);
        potClosed = roundMoney(potClosed + a.amount);
      } else {
        s.bet = roundMoney(Math.min(a.amount, cap(s)));
        level = Math.max(level, a.amount);
      }
      return;
    }

    ensureStarted();

    // Dead money ("+ other"): in the pot, never part of the bet level.
    if (a.act === 'dead') {
      const p = posOf(a);
      const s = p ? seatMap.get(p) : undefined;
      if (ended || !s || !a.amount || a.amount <= 0) return bad(i, 'illegal_act');
      s.committed = roundMoney(s.committed + a.amount);
      potClosed = roundMoney(potClosed + a.amount);
      return;
    }

    if (ended) return bad(i, 'illegal_act');
    if (a.street !== street) {
      if (pending && a.street === pending) startStreet(pending);
      else return bad(i, 'illegal_act');
    }

    const p = posOf(a);
    const seat = p ? seatMap.get(p) : undefined;
    const expected = nextToAct();
    if (!seat || !expected) return bad(i, 'illegal_act');
    if (seat !== expected) return bad(i, 'out_of_turn');

    const owe = level - seat.bet;
    const c = cap(seat);
    const buttons = buttonsFor(seat);
    const res = resolved[i] as Action;

    switch (a.act) {
      case 'fold':
        seat.folded = true;
        seat.needsAct = false;
        break;
      case 'check':
        if (owe > 0) return bad(i, 'illegal_act');
        seat.needsAct = false;
        break;
      case 'call': {
        if (owe <= 0) return bad(i, 'illegal_act');
        const target = Math.min(level, c);
        seat.bet = target;
        if (target >= c) seat.allIn = true;
        seat.needsAct = false;
        res.amount = target;
        break;
      }
      case 'bet':
      case 'raise': {
        if (!buttons.some((b) => b === 'open' || b === 'bet' || b === 'raise')) {
          return bad(i, 'illegal_act');
        }
        if (a.amount === undefined || a.amount <= level) return bad(i, 'illegal_act');
        let target = a.amount;
        let allIn = false;
        if (target >= c) {
          if (target > c) warnings.push({ code: 'auto_all_in', index: i });
          target = c;
          allIn = true;
          res.act = 'all-in';
        } else if (target < level + lastRaise) {
          warnings.push({ code: 'below_min_raise', index: i });
        }
        applyBet(seat, target, allIn);
        res.amount = target;
        break;
      }
      case 'all-in': {
        if (!buttons.includes('all-in') && !(owe > 0 && c - seat.bet <= owe)) {
          return bad(i, 'illegal_act');
        }
        const target = a.amount !== undefined ? Math.min(a.amount, c) : c;
        if (target === Infinity) return bad(i, 'stack_unknown');
        applyBet(seat, Math.max(seat.bet, target), true);
        res.amount = seat.bet;
        break;
      }
    }

    ptr = streetOrder().indexOf(seat.pos);
    playerActed = true;
    if (alive().length <= 1 || !nextToAct()) closeStreet();
  });

  ensureStarted();

  // Where the hand stands now.
  let phase: Phase | null = ended;
  // The betting never waits for board cards: the next street starts as soon as one closes.
  if (!phase && pending) startStreet(pending);
  const toActSeat = phase ? null : nextToAct();
  if (!phase)
    phase = toActSeat ? { kind: 'act', street, toAct: toActSeat.pos } : { kind: 'showdown' };

  const live = alive();
  const total = (s: Seat) => s.committed + s.bet;
  if (live.length >= 3 && live.some((s) => s.allIn)) {
    const most = Math.max(...live.map(total));
    if (live.some((s) => s.allIn && total(s) < most)) warnings.push({ code: 'side_pot' });
  }

  const players: SeatState[] = seatList.map((s) => ({
    pos: s.pos,
    actor: s.actor,
    tracked: s.tracked,
    ...(s.stack !== undefined && { stack: s.stack, behind: roundMoney(s.stack - total(s)) }),
    streetBet: s.bet,
    invested: roundMoney(total(s)),
    folded: s.folded,
    allIn: s.allIn,
    mayRaise: s.mayRaise,
  }));

  const acting = toActSeat;
  return {
    actions: resolved,
    phase,
    buttons: acting ? buttonsFor(acting) : [],
    toCall: acting ? roundMoney(Math.max(0, Math.min(level, cap(acting)) - acting.bet)) : 0,
    currentBet: level,
    minRaiseTo: acting ? roundMoney(level + lastRaise) : 0,
    lastRaiseSize: lastRaise,
    raised: acting ? (street === 'preflop' ? level > openLevel : level > 0) : false,
    pot: roundMoney(potClosed + seatList.reduce((sum, s) => sum + s.bet, 0)),
    players,
    addable: [],
    warnings,
    invalid: [...invalid].sort((x, y) => x - y),
  };
}
