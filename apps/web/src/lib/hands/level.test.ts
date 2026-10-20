import { describe, expect, it } from 'vitest';
import { parseShorthand, readBlindLevels } from 'poker-core';
import {
  blindsFor,
  deriveHand,
  emptyDraft,
  fromHandRow,
  nextHandDefaults,
  toHandRow,
  type HandSession,
} from './build';
import { withBlindLevels } from '@/lib/sessions/structure';
import { summarize, type ListHand } from './list';
import { applyLevel, currentLevel, levelLabel, sessionLevels, stepLevel, withBb } from './level';

const levelsJson = [
  { level: 1, sb: 25, bb: 50, ante: 0, ante_mode: 'none', minutes: 20 },
  { level: 2, sb: 50, bb: 100, ante: 0, ante_mode: 'none', minutes: 20 },
  { level: 3, sb: 100, bb: 200, ante: 200, ante_mode: 'bb', minutes: 20 },
  { level: 4, sb: 150, bb: 300, ante: 50, ante_mode: 'each', minutes: null },
];

const base: HandSession = {
  kind: 'mtt',
  mode: 'live',
  sb: 25,
  bb: 50,
  straddle: null,
  ante_mode: 'none',
  ante: null,
  buyin: 1_000_000,
  seats: 9,
  mtt: { start_stack: 20000, start_level: 2, blind_levels: levelsJson },
};
const plain: HandSession = { ...base, mtt: { start_stack: 20000 } };

describe('sessionLevels', () => {
  it('reads the structure from sessions.mtt', () => {
    expect(sessionLevels(base).map((l) => l.level)).toEqual([1, 2, 3, 4]);
  });
  it('is empty for cash, no structure, or junk', () => {
    expect(sessionLevels({ ...base, kind: 'cash' })).toEqual([]);
    expect(sessionLevels(plain)).toEqual([]);
    expect(sessionLevels({ ...base, mtt: { blind_levels: 'x' } })).toEqual([]);
    expect(sessionLevels({ ...base, mtt: null })).toEqual([]);
  });
});

describe('first hand of a session with a structure', () => {
  it('starts on the start level and fills SB, BB and ante from it', () => {
    const d = emptyDraft(base, null);
    expect(d).toMatchObject({
      level: '2',
      levelBb: '100',
      levelSb: '50',
      ante: '',
      anteMode: 'none',
    });
  });
  it('falls back to the first level when there is no start level', () => {
    const s = { ...base, mtt: { blind_levels: levelsJson } };
    expect(emptyDraft(s, null)).toMatchObject({ level: '1', levelBb: '50' });
  });
  it('a start level missing from the list uses the next one up', () => {
    const s = { ...base, mtt: { start_level: 0, blind_levels: levelsJson.slice(1) } };
    expect(emptyDraft(s, null).level).toBe('2');
  });
  it('fills a BB ante and a per-player ante', () => {
    const s = { ...base, mtt: { start_level: 3, blind_levels: levelsJson } };
    expect(emptyDraft(s, null)).toMatchObject({ level: '3', anteMode: 'bb', ante: '200' });
    const t = { ...base, mtt: { start_level: 4, blind_levels: levelsJson } };
    expect(emptyDraft(t, null)).toMatchObject({ level: '4', anteMode: 'each', ante: '50' });
  });
});

describe('without a structure', () => {
  it('has no level number and no ante override', () => {
    const d = emptyDraft(plain, null);
    expect(d).toMatchObject({ level: '', anteMode: '', levelSb: '', levelBb: '50' });
  });
  it('carries SB, BB and ante of the previous hand', () => {
    const online: HandSession = { ...plain, mode: 'online', ante_mode: 'each', ante: 10 };
    const d = nextHandDefaults(online, {
      hero_stack: 1000,
      result: 0,
      level_bb: 600,
      sb: 300,
      ante: 75,
    });
    expect(d).toMatchObject({ levelBb: '600', levelSb: '300', ante: '75', level: '' });
  });
});

describe('next hand with a structure carries what was played', () => {
  it('keeps the level and the values of the previous hand, even when edited by hand', () => {
    const d = nextHandDefaults(base, {
      hero_stack: 100,
      result: 0,
      level: 3,
      level_bb: 250,
      sb: 125,
      ante: 250,
      ante_mode: 'bb',
    });
    expect(d).toMatchObject({
      level: '3',
      levelBb: '250',
      levelSb: '125',
      ante: '250',
      anteMode: 'bb',
    });
  });
  it('a previous hand without ante_mode had no ante', () => {
    const d = nextHandDefaults(base, {
      hero_stack: 100,
      result: 0,
      level: 2,
      level_bb: 100,
      sb: 50,
      ante: null,
      ante_mode: null,
    });
    expect(d).toMatchObject({ level: '2', anteMode: 'none', ante: '' });
  });
  it('a previous hand saved before levels existed leaves the level blank', () => {
    const d = nextHandDefaults(base, { hero_stack: 100, result: 0, level_bb: 100 });
    expect(d).toMatchObject({ level: '', levelBb: '100', anteMode: '' });
  });
});

describe('currentLevel', () => {
  it('uses the level number', () => {
    expect(currentLevel(sessionLevels(base), { level: '3', levelBb: '999' })?.level).toBe(3);
  });
  it('without a number, finds the level with the same BB', () => {
    expect(currentLevel(sessionLevels(base), { level: '', levelBb: '200' })?.level).toBe(3);
  });
  it('is null when nothing matches', () => {
    expect(currentLevel(sessionLevels(base), { level: '', levelBb: '777' })).toBeNull();
    expect(currentLevel([], { level: '1', levelBb: '50' })).toBeNull();
  });
});

describe('stepLevel (Lên level / Lùi level)', () => {
  const start = emptyDraft(base, null); // level 2

  it('up fills the next level', () => {
    const up = stepLevel(base, start, 1);
    expect(up).toMatchObject({
      level: '3',
      levelBb: '200',
      levelSb: '100',
      anteMode: 'bb',
      ante: '200',
    });
  });
  it('down goes back and keeps the actions typed so far', () => {
    const typed = { ...start, thought: 'x' };
    const down = stepLevel(base, typed, -1);
    expect(down).toMatchObject({ level: '1', levelBb: '50', thought: 'x' });
  });
  it('is null at either end, and without a structure', () => {
    const last = applyLevel(start, sessionLevels(base)[3]!);
    expect(stepLevel(base, last, 1)).toBeNull();
    const first = applyLevel(start, sessionLevels(base)[0]!);
    expect(stepLevel(base, first, -1)).toBeNull();
    expect(stepLevel(plain, emptyDraft(plain, null), 1)).toBeNull();
  });
  it('from an unknown level, up goes to the level after the one with this BB', () => {
    const odd = { ...start, level: '', levelBb: '100' };
    expect(stepLevel(base, odd, 1)?.level).toBe('3');
  });
  it('from an unknown level with no match, up goes to the first level', () => {
    const odd = { ...start, level: '', levelBb: '777' };
    expect(stepLevel(base, odd, 1)?.level).toBe('1');
  });
});

describe('withBb: typing a new BB by hand', () => {
  it('drops an SB that was just half of the old BB', () => {
    const d = { ...emptyDraft(plain, null), levelBb: '600', levelSb: '300' };
    expect(withBb(d, '800')).toMatchObject({ levelBb: '800', levelSb: '' });
  });
  it('keeps an SB that was typed on purpose', () => {
    const d = { ...emptyDraft(plain, null), levelBb: '600', levelSb: '400' };
    expect(withBb(d, '800')).toMatchObject({ levelBb: '800', levelSb: '400' });
  });
  it('keeps the level number', () => {
    const d = emptyDraft(base, null);
    expect(withBb(d, '120')).toMatchObject({ level: '2', levelBb: '120' });
  });
});

describe('levelLabel', () => {
  it('Lv n · sb/bb (ante)', () => {
    const d = applyLevel(emptyDraft(base, null), sessionLevels(base)[2]!);
    expect(levelLabel(d)).toBe('Lv 3 · 100/200 (200)');
  });
  it('no ante, no brackets', () => {
    expect(levelLabel(emptyDraft(base, null))).toBe('Lv 2 · 50/100');
  });
  it('no level number, no Lv', () => {
    const d = { ...emptyDraft(plain, null), levelSb: '25' };
    expect(levelLabel(d)).toBe('25/50');
  });
  it('without an SB it shows half the BB', () => {
    expect(levelLabel(emptyDraft(plain, null))).toBe('25/50');
  });
  it('is empty without a BB', () => {
    expect(levelLabel({ ...emptyDraft(plain, null), levelBb: '' })).toBe('');
  });
});

describe('blindsFor with a level ante override', () => {
  it('uses the mode and amount typed for the level', () => {
    expect(blindsFor(base, 200, '50', 'each').ante).toEqual({ mode: 'each', amount: 50 });
    expect(blindsFor(base, 200, '200', 'bb').ante).toEqual({ mode: 'bb', amount: 200 });
  });
  it('a BB ante with no amount is the BB', () => {
    expect(blindsFor(base, 200, '', 'bb').ante).toEqual({ mode: 'bb', amount: 200 });
  });
  it('none, or no amount, means no ante even when the session has one', () => {
    const s = { ...base, ante_mode: 'each', ante: 25 };
    expect(blindsFor(s, 200, '50', 'none').ante).toEqual({ mode: 'none' });
    expect(blindsFor(s, 200, '', 'each').ante).toEqual({ mode: 'none' });
  });
  it('an empty override leaves the session rule as before', () => {
    const s = { ...base, ante_mode: 'each', ante: 25 };
    expect(blindsFor(s, 200, '', '').ante).toEqual({ mode: 'each', amount: 25 });
  });
});

describe('saving and reading back a hand with a level', () => {
  const GOLD = 'H lp V o500 H c';
  function played(over = {}) {
    const d = applyLevel(emptyDraft(base, null), sessionLevels(base)[2]!); // Lv 3, BB ante 200
    d.slots = ['Ah', 'Kd', '', '', '', '', ''];
    d.heroPos = 'MP';
    d.villPos = 'BTN';
    d.heroStack = '20000';
    d.villStack = '20000';
    d.outcome = 'fold';
    d.actions = parseShorthand(GOLD, { heroPos: 'MP', villPos: 'BTN' }).actions;
    return Object.assign(d, over);
  }

  it('stores level, level_bb and the ante of that level', () => {
    const row = toHandRow(base, played(), 1);
    expect(row).toMatchObject({ level: 3, level_bb: 200, ante_mode: 'bb', ante: 200 });
  });
  it('level is null without a number, and for cash', () => {
    expect(toHandRow(plain, played({ level: '' }), 1).level).toBeNull();
    const cash: HandSession = { ...base, kind: 'cash', mtt: null };
    expect(toHandRow(cash, played(), 1).level).toBeNull();
  });
  it('reads the level and the ante override back', () => {
    const row = toHandRow(base, played(), 1);
    const back = fromHandRow(base, {
      ...row,
      actions: row.actions,
      opponents: row.opponents,
      pot_winners: row.pot_winners,
    } as never);
    expect(back).toMatchObject({ level: '3', levelBb: '200', anteMode: 'bb', ante: '200' });
    expect(deriveHand(base, back).input?.blinds.ante).toEqual({ mode: 'bb', amount: 200 });
  });
  it('a hand saved without a level is read with the session rule', () => {
    const row = toHandRow(plain, played({ level: '', anteMode: '' }), 1);
    const back = fromHandRow(base, {
      ...row,
      level: null,
      actions: row.actions,
      opponents: row.opponents,
      pot_winners: row.pot_winners,
    } as never);
    expect(back.anteMode).toBe('');
  });
});

describe('editing the blind structure after hands are saved', () => {
  const played = () => {
    const d = applyLevel(emptyDraft(base, null), sessionLevels(base)[2]!); // Lv 3: 100/200, BB ante 200
    d.slots = ['Ah', 'Kd', '', '', '', '', ''];
    d.heroPos = 'MP';
    d.villPos = 'BTN';
    d.heroStack = '20000';
    d.villStack = '20000';
    d.outcome = 'fold';
    d.actions = parseShorthand('H lp V o500 H c / H x V b500 H c', {
      heroPos: 'MP',
      villPos: 'BTN',
    }).actions;
    return d;
  };
  // Lv 3 changes from 100/200 (ante 200) to 150/400 (ante 400) after the hand was saved.
  const edited: HandSession = {
    ...base,
    mtt: withBlindLevels(
      base.mtt,
      readBlindLevels(levelsJson).map((l) =>
        l.level === 3 ? { ...l, sb: 150, bb: 400, ante: 400 } : l,
      ),
    ),
  };

  it('the saved hand keeps level, level_bb and its bb result', () => {
    const row = toHandRow(base, played(), 1);
    expect(row.level_bb).toBe(200);
    expect(row.result).toBeLessThan(0);
    const asRow = {
      ...row,
      actions: row.actions,
      opponents: row.opponents,
      pot_winners: row.pot_winners,
    } as never;

    const before = fromHandRow(base, asRow);
    const after = fromHandRow(edited, asRow);
    expect(after).toMatchObject({ level: '3', levelBb: '200', anteMode: 'bb', ante: '200' });
    expect(after.levelBb).toBe(before.levelBb);
    expect(deriveHand(edited, after).bb).toBe(200);
    expect(deriveHand(edited, after).result).toBe(row.result);
    expect(deriveHand(edited, after).resultBb).toBe(deriveHand(base, before).resultBb);
  });

  it('opening and saving the hand again writes the same level_bb and result', () => {
    const row = toHandRow(base, played(), 1);
    const asRow = {
      ...row,
      actions: row.actions,
      opponents: row.opponents,
      pot_winners: row.pot_winners,
    } as never;
    const again = toHandRow(edited, fromHandRow(edited, asRow), 1);
    expect(again).toMatchObject({
      level: 3,
      level_bb: 200,
      ante: 200,
      ante_mode: 'bb',
      result: row.result,
    });
  });

  it('session totals in bb do not move', () => {
    const row = toHandRow(base, played(), 1);
    const hand: ListHand = {
      id: 'h1',
      num: 1,
      hero_cards: row.hero_cards,
      board: row.board,
      hero_pos: row.hero_pos,
      villain_pos: row.villain_pos,
      eff_stack: row.eff_stack,
      result: row.result,
      level_bb: row.level_bb,
      flagged: false,
      missing_data: row.missing_data,
      reviewed: false,
    };
    // `summarize` reads the hand's own level_bb; the session BB (now 400 for Lv 3) is not used.
    expect(summarize([hand], 50).totalBb).toBe(summarize([hand], 400).totalBb);
    expect(summarize([hand], 400).totalBb).toBeCloseTo((row.result ?? 0) / 200, 2);
  });
});
