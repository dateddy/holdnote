import { describe, expect, it } from 'vitest';
import {
  blindLevelsToJson,
  levelAt,
  nextLevel,
  parseBlindStructure,
  prevLevel,
  readBlindLevels,
  sessionResult,
  suggestLevel,
  type BlindLevel,
  type StatsSession,
} from '../src/index';

const lv = (
  level: number,
  sb: number,
  bb: number,
  ante = 0,
  minutes: number | null = null,
  anteMode: BlindLevel['anteMode'] = ante > 0 ? 'bb' : 'none',
): BlindLevel => ({ level, sb, bb, ante, anteMode, minutes });

describe('parseBlindStructure', () => {
  it('reads "level sb/bb ante"', () => {
    const r = parseBlindStructure('8 300/600 600', 'bb');
    expect(r).toMatchObject({ read: 1, skipped: 0 });
    expect(r.levels).toEqual([lv(8, 300, 600, 600)]);
  });

  it('ante is optional and 0 means none', () => {
    const r = parseBlindStructure('1 100/200\n2 150/300 0', 'bb');
    expect(r.levels).toEqual([lv(1, 100, 200), lv(2, 150, 300)]);
  });

  it('a fourth number is the level length in minutes', () => {
    const r = parseBlindStructure('3 200/400 400 20\n4 250/500 20', 'bb');
    expect(r.levels[0]).toMatchObject({ level: 3, ante: 400, minutes: 20 });
    // Three numbers after the level: ante, then minutes. Two: ante only.
    expect(r.levels[1]).toMatchObject({ level: 4, ante: 20, minutes: null });
  });

  it('accepts k and thousands separators', () => {
    const r = parseBlindStructure('10 1k/2k 2k\n11 1,500/3,000', 'bb');
    expect(r.levels[0]).toMatchObject({ sb: 1000, bb: 2000, ante: 2000 });
    expect(r.levels[1]).toMatchObject({ sb: 1500, bb: 3000 });
  });

  it('accepts a leading "Lv" or "Level" and extra spaces', () => {
    const r = parseBlindStructure('Lv 5   50/100   100\nlevel 6 75/150', 'bb');
    expect(r.levels.map((l) => l.level)).toEqual([5, 6]);
  });

  it('skips invalid lines and counts them', () => {
    const text = [
      'Level SB/BB Ante', // header
      '1 100/200',
      '', // blank
      '2 300 600', // no slash
      '3 600/300', // sb above bb
      '0 10/20', // level 0
      'x 10/20', // level not a number
      '4 400/800 800 20 99', // too many numbers
      '5 500/1000 abc', // bad ante
      '6 600/1200',
    ].join('\n');
    const r = parseBlindStructure(text, 'bb');
    expect(r.levels.map((l) => l.level)).toEqual([1, 6]);
    expect(r.read).toBe(2);
    expect(r.skipped).toBe(7); // blank lines are ignored, not counted
  });

  it('a repeated level is replaced by the later line; output is sorted by level', () => {
    const r = parseBlindStructure('3 200/400\n1 100/200\n3 250/500', 'bb');
    expect(r.levels.map((l) => [l.level, l.bb])).toEqual([
      [1, 200],
      [3, 500],
    ]);
    expect(r.read).toBe(3);
  });

  it('ante mode: the session mode when it has one, else bb when ante = bb, else each', () => {
    expect(parseBlindStructure('1 100/200 50', 'each').levels[0]?.anteMode).toBe('each');
    expect(parseBlindStructure('1 100/200 200', 'none').levels[0]?.anteMode).toBe('bb');
    expect(parseBlindStructure('1 100/200 25', 'none').levels[0]?.anteMode).toBe('each');
    expect(parseBlindStructure('1 100/200', 'bb').levels[0]?.anteMode).toBe('none');
  });

  it('empty text reads nothing', () => {
    expect(parseBlindStructure('  \n ', 'bb')).toEqual({ levels: [], read: 0, skipped: 0 });
  });
});

describe('levelAt / nextLevel / prevLevel', () => {
  const levels = [lv(1, 25, 50), lv(2, 50, 100), lv(4, 100, 200)];

  it('levelAt finds an exact level', () => {
    expect(levelAt(levels, 2)?.bb).toBe(100);
    expect(levelAt(levels, 3)).toBeNull();
  });
  it('nextLevel skips gaps and stops at the end', () => {
    expect(nextLevel(levels, 2)?.level).toBe(4);
    expect(nextLevel(levels, 0)?.level).toBe(1);
    expect(nextLevel(levels, 4)).toBeNull();
  });
  it('prevLevel skips gaps and stops at the start', () => {
    expect(prevLevel(levels, 4)?.level).toBe(2);
    expect(prevLevel(levels, 1)).toBeNull();
    expect(prevLevel(levels, 9)?.level).toBe(4);
  });
});

describe('suggestLevel', () => {
  const levels = [lv(1, 25, 50, 0, 20), lv(2, 50, 100, 0, 20), lv(3, 75, 150, 0, 15)];
  const t0 = new Date('2026-10-20T10:00:00Z');
  const at = (min: number) => new Date(t0.getTime() + min * 60_000);
  const s = (min: number, startLevel = 1, l = levels) =>
    suggestLevel({ levels: l, startLevel, startedAt: t0, now: at(min) });

  it('stays on the start level before its time is up', () => {
    expect(s(0)).toBe(1);
    expect(s(19)).toBe(1);
  });
  it('moves on after each level length', () => {
    expect(s(20)).toBe(2);
    expect(s(39)).toBe(2);
    expect(s(40)).toBe(3);
  });
  it('past the last level it keeps the last level', () => {
    expect(s(500)).toBe(3);
  });
  it('counts from the start level, not level 1', () => {
    expect(s(25, 2)).toBe(3);
  });
  it('is null when a level on the way has no length', () => {
    const l = [lv(1, 25, 50, 0, 20), lv(2, 50, 100)];
    expect(s(10, 1, l)).toBe(1); // still inside level 1: no need to know level 2
    expect(s(30, 1, l)).toBeNull();
    expect(s(5, 2, l)).toBeNull();
  });
  it('is null without levels, or before the start time', () => {
    expect(s(5, 1, [])).toBeNull();
    expect(s(-5)).toBeNull();
  });
  it('uses the next level at or above a start level that is not in the list', () => {
    expect(s(0, 0)).toBe(1);
  });
});

describe('readBlindLevels / blindLevelsToJson', () => {
  it('round-trips through the jsonb shape', () => {
    const levels = [lv(1, 25, 50, 0, 20), lv(2, 50, 100, 100, null, 'bb')];
    const json = blindLevelsToJson(levels);
    expect(json[1]).toEqual({
      level: 2,
      sb: 50,
      bb: 100,
      ante: 100,
      ante_mode: 'bb',
      minutes: null,
    });
    expect(readBlindLevels(json)).toEqual(levels);
  });
  it('drops bad rows, dedupes and sorts', () => {
    const r = readBlindLevels([
      { level: 2, sb: 50, bb: 100, ante: 0, ante_mode: 'none', minutes: null },
      { level: 1, sb: 25, bb: 50, ante: 0, ante_mode: 'none', minutes: 20 },
      { level: 2, sb: 60, bb: 120, ante: 0, ante_mode: 'none', minutes: null },
      { level: -1, sb: 1, bb: 2 },
      { level: 3, sb: 200, bb: 100 },
      { level: 4, sb: 1, bb: 2, ante: 1, ante_mode: 'weird' },
      'junk',
      null,
    ]);
    expect(r.map((l) => [l.level, l.bb])).toEqual([
      [1, 50],
      [2, 120],
    ]);
  });
  it('anything that is not an array reads as empty', () => {
    expect(readBlindLevels(null)).toEqual([]);
    expect(readBlindLevels({})).toEqual([]);
    expect(readBlindLevels(undefined)).toEqual([]);
  });
});

describe('sessionResult (MTT)', () => {
  const mtt = (over: Partial<NonNullable<StatsSession['mtt']>>): StatsSession => ({
    id: 'm1',
    kind: 'mtt',
    mode: 'live',
    venue: null,
    stakeLabel: null,
    currency: 'VND',
    bb: 0,
    date: '2026-10-20',
    startAt: null,
    endAt: null,
    buyin: 1_000_000,
    cashout: null,
    stopLoss: null,
    selfState: null,
    mtt: {
      reentries: 0,
      prize: null,
      bounty: null,
      place: null,
      entries: null,
      bustStage: null,
      ...over,
    },
  });

  it('prize minus buy-in times (1 + re-entries)', () => {
    expect(sessionResult(mtt({ prize: 5_000_000, reentries: 2 }))?.money).toBe(2_000_000);
  });
  it('out of the money with re-entries loses every entry', () => {
    expect(sessionResult(mtt({ prize: 0, reentries: 2 }))?.money).toBe(-3_000_000);
  });
  it('no prize recorded yet: no result', () => {
    expect(sessionResult(mtt({ prize: null }))).toBeNull();
  });
});
