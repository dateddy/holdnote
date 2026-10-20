import { parseAmount } from '../amount';

/** `none`: no ante; `each`: every player posts it; `bb`: the big blind posts it for the table. */
export type LevelAnteMode = 'none' | 'each' | 'bb';

/** One row of a tournament blind structure (spec 5, `sessions.mtt.blind_levels`). */
export interface BlindLevel {
  level: number;
  sb: number;
  bb: number;
  ante: number;
  anteMode: LevelAnteMode;
  /** Length of the level; null when the structure does not say. */
  minutes: number | null;
}

const ANTE_MODES: readonly string[] = ['none', 'each', 'bb'];

const byLevel = (a: BlindLevel, b: BlindLevel) => a.level - b.level;

/** Sorted by level, one row per level (the later row wins). */
function tidy(rows: BlindLevel[]): BlindLevel[] {
  const map = new Map<number, BlindLevel>();
  for (const r of rows) map.set(r.level, r);
  return [...map.values()].sort(byLevel);
}

export interface ParsedStructure {
  levels: BlindLevel[];
  /** Lines that gave a level (a repeated level counts each time). */
  read: number;
  /** Non-blank lines that could not be read. */
  skipped: number;
}

const isCount = (n: number | null): n is number => n != null && Number.isInteger(n) && n > 0;

/**
 * Pasted text, one level per line: `level sb/bb [ante] [minutes]`, e.g. `8 300/600 600`.
 * With four numbers the last two are ante and minutes; with three, the last is the ante.
 * `Lv`/`Level` before the number is fine. Lines that do not fit are skipped and counted.
 * `defaultAnteMode` is the session's ante mode; without one, an ante equal to the BB is a
 * BB ante and any other ante is per player.
 */
export function parseBlindStructure(text: string, defaultAnteMode: LevelAnteMode): ParsedStructure {
  const rows: BlindLevel[] = [];
  let skipped = 0;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/^(?:level|lv)\.?\s*/i, '');
    if (!line) continue;
    const row = parseLine(line, defaultAnteMode);
    if (row) rows.push(row);
    else skipped += 1;
  }
  return { levels: tidy(rows), read: rows.length, skipped };
}

function parseLine(line: string, defaultAnteMode: LevelAnteMode): BlindLevel | null {
  const parts = line.split(/\s+/);
  if (parts.length < 2 || parts.length > 4) return null;

  const level = /^\d+$/.test(parts[0] ?? '') ? Number(parts[0]) : null;
  if (!isCount(level)) return null;

  const blinds = (parts[1] ?? '').split('/');
  if (blinds.length !== 2) return null;
  const sb = parseAmount(blinds[0]);
  const bb = parseAmount(blinds[1]);
  if (sb == null || bb == null || sb < 0 || bb <= 0 || sb > bb) return null;

  let ante = 0;
  if (parts[2] !== undefined) {
    const a = parseAmount(parts[2]);
    if (a == null || a < 0) return null;
    ante = a;
  }
  let minutes: number | null = null;
  if (parts[3] !== undefined) {
    const m = parseAmount(parts[3]);
    if (!isCount(m)) return null;
    minutes = m;
  }

  const anteMode: LevelAnteMode =
    ante <= 0 ? 'none' : defaultAnteMode !== 'none' ? defaultAnteMode : ante === bb ? 'bb' : 'each';
  return { level, sb, bb, ante, anteMode, minutes };
}

export const levelAt = (levels: readonly BlindLevel[], n: number): BlindLevel | null =>
  levels.find((l) => l.level === n) ?? null;

/** The level right after `n`, skipping gaps; null at the end. */
export function nextLevel(levels: readonly BlindLevel[], n: number): BlindLevel | null {
  return [...levels].sort(byLevel).find((l) => l.level > n) ?? null;
}

/** The level right before `n`, skipping gaps; null at the start. */
export function prevLevel(levels: readonly BlindLevel[], n: number): BlindLevel | null {
  return (
    [...levels]
      .sort(byLevel)
      .reverse()
      .find((l) => l.level < n) ?? null
  );
}

/**
 * The row a session starts at: `startLevel` when the list has it, else the next level up, else
 * (past the end) the last level; without a start level, the first one.
 */
export function startRow(
  levels: readonly BlindLevel[],
  startLevel: number | null,
): BlindLevel | null {
  const n = startLevel != null && Number.isInteger(startLevel) && startLevel > 0 ? startLevel : 0;
  return levelAt(levels, n) ?? nextLevel(levels, n - 1) ?? [...levels].sort(byLevel).at(-1) ?? null;
}

/**
 * The level the clock says the tournament has reached, to hint "may be Lv 9 by now"; it never
 * changes anything by itself. Counts from `startLevel` at `startedAt`. Null when it cannot know:
 * no levels, `now` before the start, or a level on the way without a length.
 */
export function suggestLevel(opts: {
  levels: readonly BlindLevel[];
  startLevel: number;
  startedAt: Date;
  now: Date;
}): number | null {
  const elapsed = (opts.now.getTime() - opts.startedAt.getTime()) / 60_000;
  if (elapsed < 0) return null;

  let cur: BlindLevel | null =
    levelAt(opts.levels, opts.startLevel) ?? nextLevel(opts.levels, opts.startLevel - 1);
  let remaining = elapsed;
  while (cur) {
    if (cur.minutes == null) return null;
    if (remaining < cur.minutes) return cur.level;
    const next = nextLevel(opts.levels, cur.level);
    if (!next) return cur.level;
    remaining -= cur.minutes;
    cur = next;
  }
  return null;
}

/** The jsonb shape of `sessions.mtt.blind_levels`. */
export type BlindLevelJson = {
  level: number;
  sb: number;
  bb: number;
  ante: number;
  ante_mode: LevelAnteMode;
  minutes: number | null;
};

export const blindLevelsToJson = (levels: readonly BlindLevel[]): BlindLevelJson[] =>
  tidy([...levels]).map((l) => ({
    level: l.level,
    sb: l.sb,
    bb: l.bb,
    ante: l.ante,
    ante_mode: l.anteMode,
    minutes: l.minutes,
  }));

/** Defensive read of `blind_levels`: bad rows are dropped, the rest sorted and de-duplicated. */
export function readBlindLevels(json: unknown): BlindLevel[] {
  if (!Array.isArray(json)) return [];
  const rows: BlindLevel[] = [];
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);

  for (const item of json) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const level = num(o.level);
    const sb = num(o.sb);
    const bb = num(o.bb);
    const ante = o.ante === undefined ? 0 : num(o.ante);
    const minutes = o.minutes == null ? null : num(o.minutes);
    const mode = o.ante_mode === undefined ? (ante ? 'each' : 'none') : o.ante_mode;
    if (!isCount(level) || sb == null || bb == null || ante == null) continue;
    if (sb < 0 || bb <= 0 || sb > bb || ante < 0) continue;
    if (typeof mode !== 'string' || !ANTE_MODES.includes(mode)) continue;
    if (minutes != null && !isCount(minutes)) continue;
    rows.push({ level, sb, bb, ante, anteMode: mode as LevelAnteMode, minutes });
  }
  return tidy(rows);
}
