import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizePosition, type Position } from '../../src/index';

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
