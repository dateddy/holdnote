import { roundMoney, type LeakLine } from 'poker-core';

/**
 * Leaks shown on the home screen (spec 3.3): the ones that came back in the most recent sessions,
 * then by hands. Leaks that did not show up lately are left out.
 */
export function topLeaks(lines: LeakLine[], n = 3): LeakLine[] {
  const recent = (l: LeakLine) => l.trend.filter(Boolean).length;
  return lines
    .filter((l) => recent(l) > 0)
    .sort((a, b) => recent(b) - recent(a) || b.hands - a.hands)
    .slice(0, n);
}

/** Money and bb of a session so far: each hand in bb of its own level (MTT) or the session BB. */
export function handTotals(
  hands: ReadonlyArray<{ result: number | null; level_bb: number | null }>,
  sessionBb: number | null,
): { money: number; bb: number } {
  let money = 0;
  let bb = 0;
  for (const h of hands) {
    if (h.result == null) continue;
    money += h.result;
    const handBb = h.level_bb ?? sessionBb;
    if (handBb) bb += h.result / handBb;
  }
  return { money: roundMoney(money), bb: roundMoney(bb) };
}
