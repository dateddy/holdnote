import { blindLevelsToJson, type BlindLevel } from 'poker-core';

/**
 * `sessions.mtt` after the blind structure is replaced: only `blind_levels` changes, every other
 * key stays; an empty list removes the structure. Saved hands keep their own `level_bb`.
 */
export function withBlindLevels(
  current: unknown,
  levels: readonly BlindLevel[],
): Record<string, unknown> {
  const mtt =
    current && typeof current === 'object' && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};
  const rest = Object.fromEntries(Object.entries(mtt).filter(([k]) => k !== 'blind_levels'));
  return levels.length > 0 ? { ...rest, blind_levels: blindLevelsToJson(levels) } : rest;
}
