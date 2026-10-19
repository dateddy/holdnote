import { describe, expect, it } from 'vitest';
import { emptyDraft, pickedOpponents, type HandSession } from './build';
import {
  nameOpponent,
  pickHero,
  playersOf,
  setPlayers,
  setStraddleCount,
  sortOpponents,
  toggleOpponent,
} from './table';

const cash: HandSession = {
  kind: 'cash',
  mode: 'live',
  sb: 25,
  bb: 50,
  straddle: null,
  ante_mode: 'none',
  ante: null,
  buyin: 18000,
  seats: 9,
  mtt: null,
};

const base = () => ({ ...emptyDraft(cash, null), heroPos: 'MP' });

describe('picking seats', () => {
  it('opponents are toggled in the order picked; the first is mirrored in villPos', () => {
    let d = toggleOpponent(base(), 'BTN');
    d = toggleOpponent(d, 'CO');
    expect(pickedOpponents(d).map((o) => o.pos)).toEqual(['BTN', 'CO']);
    expect(d.villPos).toBe('BTN');
    d = toggleOpponent(d, 'BTN');
    expect(pickedOpponents(d).map((o) => o.pos)).toEqual(['CO']);
    expect(d.villPos).toBe('CO');
  });

  it("hero's own seat cannot be picked as an opponent", () => {
    expect(pickedOpponents(toggleOpponent(base(), 'MP'))).toEqual([]);
  });

  it('moving hero onto an opponent seat frees it', () => {
    const d = pickHero(toggleOpponent(base(), 'CO'), 'CO');
    expect(d.heroPos).toBe('CO');
    expect(pickedOpponents(d)).toEqual([]);
  });

  it('a name fills the last stack once, and sits on one seat only', () => {
    let d = toggleOpponent(toggleOpponent(base(), 'BTN'), 'CO');
    d = nameOpponent(d, 'BTN', 'p1', 4000);
    expect(pickedOpponents(d)[0]).toMatchObject({ opponentId: 'p1', stack: '4000' });
    d = nameOpponent(d, 'CO', 'p1', 9000);
    expect(pickedOpponents(d).map((o) => o.opponentId)).toEqual(['', 'p1']);
    expect(pickedOpponents(d)[1]?.stack).toBe('9000');
  });
});

describe('head count', () => {
  it('uses the draft, then the session, then 9', () => {
    expect(playersOf(cash, { ...base(), playersDealt: '6' })).toBe(6);
    expect(playersOf(cash, { ...base(), playersDealt: '' })).toBe(9);
    expect(playersOf({ seats: null }, { ...base(), playersDealt: '' })).toBe(9);
    expect(playersOf(cash, { ...base(), playersDealt: '12' })).toBe(10);
  });

  it('9 -> 8 while hero sits MP: hero is unpicked and listed; the others stay', () => {
    const d = toggleOpponent(base(), 'CO');
    const r = setPlayers(cash, d, 8);
    expect(r.draft.playersDealt).toBe('8');
    expect(r.draft.heroPos).toBe('');
    expect(r.dropped).toEqual(['MP']);
    expect(pickedOpponents(r.draft).map((o) => o.pos)).toEqual(['CO']);
  });

  it('seats that still exist are kept; straddles are cut to what the table allows', () => {
    let d = toggleOpponent(base(), 'BTN');
    d = { ...d, straddles: ['100', '200', '400'] };
    const r = setPlayers(cash, d, 5);
    expect(r.dropped).toEqual(['MP']);
    expect(r.draft.straddles).toEqual(['100', '200']);
    expect(setPlayers(cash, d, 10).dropped).toEqual([]);
    expect(setPlayers(cash, d, 3).draft.straddles).toEqual([]);
  });

  it('straddle switch is locked where the table cannot have one', () => {
    expect(setStraddleCount(cash, base(), 3, 1, 50).straddles).toEqual([]);
    expect(setStraddleCount(cash, base(), 6, 2, 50).straddles).toEqual(['100', '200']);
  });
});

describe('opponent list', () => {
  it('shows everyone, same venue first', () => {
    const list = sortOpponents([
      { id: '1', name: 'Zed', sameVenue: false },
      { id: '2', name: 'Bao', sameVenue: false },
      { id: '3', name: 'Hùng', sameVenue: true },
    ]);
    expect(list.map((o) => o.name)).toEqual(['Hùng', 'Bao', 'Zed']);
  });
});
