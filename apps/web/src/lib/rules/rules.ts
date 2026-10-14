/** Same cap as a rule written in a session summary. */
export const RULE_MAX = 300;

/** A rule as typed: trimmed, null when empty or too long. */
export function parseRuleText(raw: FormDataEntryValue | string | null): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  return text && text.length <= RULE_MAX ? text : null;
}

/** The order after moving `id` one step up (-1) or down (+1). Unchanged at the ends. */
export function moveId(ids: string[], id: string, dir: -1 | 1): string[] {
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  const next = [...ids];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}
