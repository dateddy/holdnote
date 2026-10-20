import { roundMoney } from 'poker-core';

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
