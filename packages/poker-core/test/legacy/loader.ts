import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  normalizePosition,
  parseAmount,
  parseShorthand,
  type Ante,
  type HandInput,
  type Outcome,
  type Position,
} from '../../src/index';

/** Real data from the old app. Gitignored (opponent names), so tests skip when it is absent. */
export const LEGACY_DIR = fileURLToPath(new URL('../../../../legacy/data/', import.meta.url));
export const hasLegacyData = existsSync(`${LEGACY_DIR}hands`);

/** Fields of the old JSON we use. All values were stored as strings. */
export interface LegacyHand {
  id: string;
  sessionId: string;
  line?: string;
  heroPos?: string;
  villPos?: string;
  heroStack?: string;
  villStack?: string;
  outcome?: string;
  result?: string;
  resultChips?: string;
  flop?: string;
  turn?: string;
  river?: string;
  mtt?: boolean;
  sb?: string;
  bb?: string;
  ante?: string;
  tableSize?: string;
  players?: string;
}

export interface LegacySession {
  id: string;
  kind?: string;
  stake?: string;
  bb?: string;
  tableNote?: string;
}

function readDir<T>(name: string): T[] {
  const dir = `${LEGACY_DIR}${name}/`;
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(dir + f, 'utf8')) as T);
}

export function loadLegacy(): { hands: LegacyHand[]; sessions: Map<string, LegacySession> } {
  const sessions = new Map(readDir<LegacySession>('sessions').map((s) => [s.id, s]));
  return { hands: readDir<LegacyHand>('hands'), sessions };
}

/** Lines written with H/V actors (the only ones that can give a hero result). */
export function hasHeroVillainLine(line: string | undefined): boolean {
  return !!line && line.split(/[\s/]+/).some((t) => /^[HV](?:[:-].*)?$/i.test(t));
}

export function pos(value: string | undefined): Position | undefined {
  return value ? (normalizePosition(value) ?? undefined) : undefined;
}

/** Cash sessions on NLHA tables (ante 0.01 per player) where each hand saved the players dealt. */
const NLHA_WITH_PLAYERS = new Set(['ses1001w18', 'ses1001w22', 'ses1001w44']);
/**
 * NLHA sessions where `players` meant "players in the pot", not players dealt. munwrr77wnikg was
 * also NLHA: every fold/lose hand there is exactly 0.01 (hero ante) more than the bets.
 */
const NLHA_WITHOUT_PLAYERS = new Set(['ses0929tilt', 'munwrr77wnikg']);

const OUTCOMES = new Set(['win', 'lose', 'fold', 'split']);

const num = (v: string | undefined): number | undefined => parseAmount(v ?? '') ?? undefined;

export interface LegacyCase {
  input: HandInput;
  bb: number;
  /** Result saved by the old app, in money. */
  recorded: number | undefined;
}

/** Map an old hand to a HandInput, with the ante rules confirmed against the data. */
export function toCase(h: LegacyHand, session: LegacySession | undefined): LegacyCase {
  let sb: number | undefined;
  let bb: number | undefined;
  let ante: Ante = { mode: 'none' };
  let playersDealt: number | undefined;

  if (h.mtt || session?.kind === 'mtt') {
    // Old MTT `ante` is the whole table ante = per-player ante x tableSize.
    bb = num(h.bb);
    sb = num(h.sb);
    const total = num(h.ante);
    const table = num(h.tableSize);
    if (total && table) {
      ante = { mode: 'each', amount: total / table };
      playersDealt = table;
    }
  } else {
    const stake = /([\d.,]+)\s*\/\s*([\d.,]+)/.exec(session?.stake ?? '');
    sb = num(stake?.[1]);
    bb = num(session?.bb) ?? num(stake?.[2]);
    if (NLHA_WITH_PLAYERS.has(h.sessionId)) {
      ante = { mode: 'each', amount: 0.01 };
      playersDealt = num(h.players);
    } else if (NLHA_WITHOUT_PLAYERS.has(h.sessionId)) {
      ante = { mode: 'each', amount: 0.01 };
    }
  }
  if (!bb) throw new Error(`${h.id}: no big blind`);

  const heroPos = pos(h.heroPos);
  const villPos = pos(h.villPos);
  const { actions } = parseShorthand(h.line ?? '', { heroPos, villPos });
  const input: HandInput = {
    blinds: { sb: sb ?? bb / 2, bb, ante },
    actions,
  };
  if (playersDealt) input.playersDealt = playersDealt;
  if (heroPos) input.heroPos = heroPos;
  if (villPos) input.villPos = villPos;
  const heroStack = num(h.heroStack);
  const villStack = num(h.villStack);
  if (heroStack !== undefined) input.heroStack = heroStack;
  if (villStack !== undefined) input.villStack = villStack;
  if (h.outcome && OUTCOMES.has(h.outcome)) input.outcome = h.outcome as Outcome;

  const chips = num(h.resultChips);
  const inBb = num(h.result);
  const recorded = chips ?? (inBb !== undefined ? inBb * bb : undefined);
  return { input, bb, recorded };
}
