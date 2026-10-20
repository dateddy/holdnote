/**
 * Name of an opponent on screen: "Đối thủ" alone, "Đối thủ · BTN" once two or more are picked, so
 * the chips and the showdown say which one is meant.
 */
export function opponentLabel(base: string, pos: string, opponents: number): string {
  return opponents >= 2 ? `${base} · ${pos}` : base;
}

/** Fold the accents and the case so "Áo Đỏ" matches "ao do". */
export function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export type NameOption = { id: string; name: string; sameVenue: boolean };

/** Saved opponents that match what was typed, players of this session's venue first. */
export function matchNames<T extends NameOption>(options: readonly T[], query: string): T[] {
  const q = foldText(query);
  return options
    .filter((o) => foldText(o.name).includes(q))
    .sort((a, b) => Number(b.sameVenue) - Number(a.sameVenue));
}

/** True when a saved opponent already has exactly this name (accents and case aside). */
export const hasName = (options: readonly NameOption[], query: string): boolean =>
  options.some((o) => foldText(o.name) === foldText(query));
