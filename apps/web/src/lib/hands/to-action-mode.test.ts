import { describe, expect, it } from 'vitest';
import { fromHandRow, type HandRowIn, type HandSession } from './build';

// The live 20/50/100 session of the owner's account (straddle 100, table size not saved).
const SESSION: HandSession = {
  kind: 'cash',
  mode: 'live',
  sb: 20,
  bb: 50,
  straddle: 100,
  ante_mode: 'none',
  ante: null,
  buyin: 5000,
  seats: null,
  mtt: null,
};

const row = (over: Partial<HandRowIn>): HandRowIn => ({
  hero_cards: null,
  board: null,
  villain_cards: null,
  hero_pos: null,
  villain_pos: null,
  opponent_id: null,
  actions: [],
  raw_line: null,
  outcome: null,
  result: null,
  hero_stack: null,
  villain_stack: null,
  level_bb: null,
  players_dealt: null,
  ante: null,
  stage: null,
  thought: null,
  flagged: false,
  ...over,
});

const a = (
  street: string,
  actor: string,
  pos: string,
  act: string,
  amount?: number,
): Record<string, unknown> => ({
  street,
  actor,
  pos,
  act,
  ...(amount !== undefined && { amount }),
});

describe('fromHandRow: saved hands open in Theo action', () => {
  it('saved hand 3 (raise, two callers, bet, fold) converts and keeps its result', () => {
    const d = fromHandRow(
      SESSION,
      row({
        hero_cards: ['9s', '9h'],
        board: ['Jd', '7s', '5h', 'As'],
        hero_pos: 'UTG+1',
        villain_pos: 'MP',
        outcome: 'win',
        result: 3270,
        hero_stack: 7150,
        actions: [
          a('preflop', 'hero', 'UTG+1', 'raise', 800),
          a('preflop', 'villain', 'MP', 'call', 800),
          a('preflop', 'other', 'LJ', 'call', 800),
          a('flop', 'hero', 'UTG+1', 'bet', 1500),
          a('flop', 'villain', 'MP', 'call', 1500),
          a('flop', 'other', 'LJ', 'fold'),
          a('turn', 'hero', 'UTG+1', 'bet', 2200),
          a('turn', 'villain', 'MP', 'fold'),
        ],
      }),
    );
    expect(d.legacyReason).toBeUndefined();
    expect(d.legacy).toBe(false);
    expect(d.rawLine).toBe('');
  });

  it('saved hand 1 (raise, all-in of an unknown stack) stays a shorthand line, with the reason', () => {
    const d = fromHandRow(
      SESSION,
      row({
        hero_pos: 'UTG+1',
        villain_pos: 'MP',
        outcome: 'win',
        raw_line: 'H r500 V ai / AhKhQh / Jd / 9c',
        actions: [
          a('preflop', 'hero', 'UTG+1', 'raise', 500),
          a('preflop', 'villain', 'MP', 'all-in'),
        ],
      }),
    );
    expect(d.legacy).toBe(true);
    expect(d.legacyReason).toBe('missing_stack');
    expect(d.rawLine).toBe('H r500 V ai / AhKhQh / Jd / 9c');
  });

  it('a hand whose actions do not fit the table order stays legacy with out_of_turn', () => {
    const d = fromHandRow(
      SESSION,
      row({
        hero_pos: 'BTN',
        villain_pos: 'UTG',
        outcome: 'fold',
        result: -1800,
        hero_stack: 8950,
        actions: [
          a('preflop', 'villain', 'UTG', 'check'),
          a('preflop', 'hero', 'BTN', 'raise', 600),
          a('preflop', 'other', 'SB', 'call', 600),
          a('preflop', 'other', 'BB', 'call', 600),
          a('preflop', 'villain', 'UTG', 'call', 600),
        ],
      }),
    );
    expect(d.legacy).toBe(true);
    expect(d.legacyReason).toBeDefined();
  });

  it('a result the conversion would change is refused', () => {
    const d = fromHandRow(
      SESSION,
      row({
        hero_pos: 'UTG+1',
        villain_pos: 'MP',
        outcome: 'win',
        result: 999,
        hero_stack: 7150,
        actions: [
          a('preflop', 'hero', 'UTG+1', 'raise', 800),
          a('preflop', 'villain', 'MP', 'fold'),
        ],
      }),
    );
    expect(d.legacy).toBe(true);
    expect(d.legacyReason).toBe('result_changed');
  });
});
