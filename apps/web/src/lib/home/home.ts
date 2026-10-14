import type { LeakLine } from 'poker-core';

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
