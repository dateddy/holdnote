import {
  levelAt,
  nextLevel,
  parseAmount,
  prevLevel,
  readBlindLevels,
  startRow,
  type BlindLevel,
} from 'poker-core';
import type { HandDraft, HandSession } from './build';

/** The blind structure of an MTT session (`sessions.mtt.blind_levels`); empty when none was entered. */
export function sessionLevels(session: Pick<HandSession, 'kind' | 'mtt'>): BlindLevel[] {
  if (session.kind !== 'mtt') return [];
  const mtt = session.mtt;
  if (!mtt || typeof mtt !== 'object' || Array.isArray(mtt)) return [];
  return readBlindLevels((mtt as { blind_levels?: unknown }).blind_levels);
}

/** The level a session's first hand is played at: the start level, else the first level. */
export function startLevel(session: HandSession, levels: readonly BlindLevel[]): BlindLevel | null {
  const raw = (session.mtt as { start_level?: unknown } | null)?.start_level;
  return startRow(levels, typeof raw === 'number' ? raw : null);
}

/** Fills level number, SB, BB and ante from a structure row. Nothing else in the draft changes. */
export function applyLevel(draft: HandDraft, l: BlindLevel): HandDraft {
  return {
    ...draft,
    level: String(l.level),
    levelBb: String(l.bb),
    levelSb: String(l.sb),
    anteMode: l.anteMode,
    ante: l.ante > 0 ? String(l.ante) : '',
  };
}

/** The row the hand is at: by its level number, else the row with the same BB. Null if neither fits. */
export function currentLevel(
  levels: readonly BlindLevel[],
  draft: Pick<HandDraft, 'level' | 'levelBb'>,
): BlindLevel | null {
  const n = Number(draft.level);
  if (draft.level.trim() && Number.isInteger(n)) {
    const exact = levelAt(levels, n);
    if (exact) return exact;
  }
  const bb = parseAmount(draft.levelBb);
  return bb == null ? null : (levels.find((l) => l.bb === bb) ?? null);
}

/** "Lên level" (+1) and "Lùi level" (-1). Null when there is no such level, or no structure. */
export function stepLevel(session: HandSession, draft: HandDraft, dir: 1 | -1): HandDraft | null {
  const levels = sessionLevels(session);
  if (levels.length === 0) return null;
  const cur = currentLevel(levels, draft);
  const target =
    dir > 0 ? nextLevel(levels, cur?.level ?? 0) : cur ? prevLevel(levels, cur.level) : null;
  return target ? applyLevel(draft, target) : null;
}

/**
 * A BB typed by hand. An SB that was only half of the old BB is dropped, so it follows the new BB
 * instead of staying behind; an SB typed on purpose stays. The level number is not touched.
 */
export function withBb(draft: HandDraft, text: string): HandDraft {
  const oldBb = parseAmount(draft.levelBb);
  const sb = parseAmount(draft.levelSb);
  const followed = draft.levelSb.trim() === '' || (oldBb != null && sb === oldBb / 2);
  return { ...draft, levelBb: text, levelSb: followed ? '' : draft.levelSb };
}

/**
 * "Lv 8 · 300/600 (600)": level, blinds and ante of the hand. `ante` is what the hand really posts
 * when the caller knows it; without it the draft's own ante is used.
 */
export function levelLabel(draft: HandDraft, ante?: number | null): string {
  const bb = parseAmount(draft.levelBb);
  if (bb == null || bb <= 0) return '';
  const sb = parseAmount(draft.levelSb) ?? bb / 2;
  const typed = parseAmount(draft.ante);
  const amount =
    ante !== undefined
      ? ante
      : draft.anteMode === 'none'
        ? 0
        : draft.anteMode === 'bb'
          ? (typed ?? bb)
          : typed;
  const blinds = `${sb}/${bb}${amount != null && amount > 0 ? ` (${amount})` : ''}`;
  return draft.level.trim() ? `Lv ${draft.level} · ${blinds}` : blinds;
}
