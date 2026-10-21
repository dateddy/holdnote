import { act, forcedBets, parseShorthand, type ActInput } from 'poker-core';
import { emptyDraft, toHandRow, type HandDraft, type HandSession } from './build';
import { boardInput, draftToSetup } from './setup';

/**
 * Hands used by the replayer tests and by the screenshot script (`scripts/screens-session.mjs`
 * reads the same rows from `scripts/fixtures/hands-5.1d-2b.json`, written by fixtures.test.ts).
 */

export const CASH: HandSession = {
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

/** Online tournament at level 8: blinds 500/1000, 9 seats, chips as tournament chips. */
export const MTT: HandSession = {
  kind: 'mtt',
  mode: 'online',
  sb: 500,
  bb: 1000,
  straddle: null,
  ante_mode: 'none',
  ante: null,
  buyin: 500000,
  seats: 9,
  mtt: { name: 'Sunday Million', type: 'regular', reentry: false },
};

const GOLD = 'H lp V o500 H c / H x V b500 H c / H x V b1k H c / H b5000 V ai H c';

/** The golden hand to the river: hero AK loses to a set of nines, −360 bb. */
export function goldenDraft(): HandDraft {
  const d = emptyDraft(CASH, null);
  d.slots = ['Ah', 'Kd', '7c', '8d', '2s', 'Jh', '3c'];
  d.heroPos = 'MP';
  d.villPos = 'BTN';
  d.heroStack = '18000';
  d.villStack = '20000';
  d.opponents = [{ pos: 'BTN', stack: '20000', opponentId: '', cards: ['9d', '9s'] }];
  d.thought = 'Call river all-in quá rộng? Đối thủ chỉ có nut hoặc bluff.';
  d.flagged = true;
  d.actions = parseShorthand(GOLD, { heroPos: 'MP', villPos: 'BTN' }).actions;
  return d;
}

/** BTN (hero, 1000) shoves, SB (3000) and BB (5000) call: pots of 3000 and 4000. */
export function sidePotDraft(): HandDraft {
  const d = emptyDraft(CASH, null);
  d.playersDealt = '3';
  d.heroPos = 'BTN';
  d.heroStack = '1000';
  d.slots = ['Ah', 'Ad', 'Qs', '7d', '5h', '2s', '9c'];
  d.opponents = [
    { pos: 'SB', stack: '3000', opponentId: '', cards: ['Kh', 'Kd'] },
    { pos: 'BB', stack: '5000', opponentId: '', cards: ['Tc', '3c'] },
  ];
  d.villPos = 'SB';
  d.villStack = '3000';
  d.thought = 'Shove ngắn stack, hai người call.';
  const setup = draftToSetup(CASH, d, 50);
  if (!setup) throw new Error('side pot setup');
  let full = forcedBets(setup);
  const play = (input: ActInput) => {
    const r = act(setup, full, input, boardInput(d));
    if (!r.accepted) throw new Error(`refused ${input.act}`);
    full = r.actions;
  };
  play({ act: 'all-in' });
  play({ act: 'all-in' });
  play({ act: 'all-in' });
  d.actions = full.filter((a) => !a.act.startsWith('post_'));
  return d;
}

/** A tournament hand at 500/1000: villain opens, hero calls, folds the river to a bet. */
export function mttDraft(): HandDraft {
  const d = emptyDraft(MTT, null);
  d.playersDealt = '9';
  d.levelBb = '1000';
  d.levelSb = '500';
  d.level = '8';
  d.stage = 'bubble';
  d.slots = ['Qh', 'Jh', 'Ts', '6h', '2c', '', ''];
  d.heroPos = 'CO';
  d.villPos = 'BB';
  d.heroStack = '60000';
  d.villStack = '80000';
  d.opponents = [{ pos: 'BB', stack: '80000', opponentId: '', cards: [] }];
  d.thought = 'Bubble, chip lead gọi rộng.';
  d.actions = parseShorthand('H o2k V c / V x H b3k V r9k H f', {
    heroPos: 'CO',
    villPos: 'BB',
  }).actions;
  return d;
}

/** Rows as saved, for the screenshot seed. `num` is the hand number in its session. */
export function fixtureRows() {
  return {
    golden: toHandRow(CASH, goldenDraft(), 7),
    sidePot: toHandRow(CASH, sidePotDraft(), 8),
    mtt: toHandRow(MTT, mttDraft(), 3),
  };
}
