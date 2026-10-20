import { ERROR_TAGS } from '@/lib/review/review';

/**
 * Cleans a model reply before Zod sees it (DEC-055): enums written in the wrong case or with a
 * near-synonym are mapped to the fixed codes, so a reply that is right in substance is not
 * thrown away. A value that cannot be mapped is left as it is and Zod rejects it (then the
 * single retry runs). Tags that cannot be mapped are dropped instead, because one odd tag
 * should not cost the whole review.
 */

/** `" Missed Value "` -> `missed_value`. */
export function enumKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '_');
}

const VERDICTS: Record<string, string> = {
  correct: 'correct',
  right: 'correct',
  good: 'correct',
  ok: 'correct',
  fine: 'correct',
  đúng: 'correct',
  mistake: 'mistake',
  wrong: 'mistake',
  error: 'mistake',
  incorrect: 'mistake',
  bad: 'mistake',
  sai: 'mistake',
  unsure: 'unsure',
  unclear: 'unsure',
  uncertain: 'unsure',
  close: 'unsure',
  marginal: 'unsure',
  không_chắc: 'unsure',
};

const STREETS: Record<string, string> = {
  preflop: 'preflop',
  pre_flop: 'preflop',
  pf: 'preflop',
  flop: 'flop',
  turn: 'turn',
  river: 'river',
  none: 'none',
  null: 'none',
  'n/a': 'none',
  na: 'none',
  no_mistake: 'none',
  '': 'none',
};

const TAG_SYNONYMS: Record<string, string> = {
  overbet: 'sizing_too_large',
  bet_too_big: 'sizing_too_large',
  bet_too_large: 'sizing_too_large',
  sizing_too_big: 'sizing_too_large',
  bet_too_small: 'sizing_too_small',
  underbet: 'sizing_too_small',
  too_loose_preflop: 'preflop_too_loose',
  loose_preflop: 'preflop_too_loose',
  too_tight_preflop: 'preflop_too_tight',
  tight_preflop: 'preflop_too_tight',
  missed_thin_value: 'missed_value',
  no_value_bet: 'missed_value',
  loose_call: 'call_too_loose',
  bad_call: 'call_too_loose',
  over_fold: 'fold_too_much',
  overfold: 'fold_too_much',
  too_passive: 'passive_short',
  wrong_range_read: 'misread_range',
  mathematical_error: 'math_error',
};

const KNOWN_TAGS = new Set<string>(ERROR_TAGS);

const isObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

/** The code for a raw string, or the string itself when it is unknown. */
function mapOr(table: Record<string, string>, v: unknown): unknown {
  if (v === null) return table.null ?? v;
  if (typeof v !== 'string') return v;
  return table[enumKey(v)] ?? table[v.trim().toLowerCase()] ?? v;
}

/** The fixed tag for a raw one, or null when there is none. */
function mapTag(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const key = enumKey(v);
  if (KNOWN_TAGS.has(key)) return key;
  return TAG_SYNONYMS[key] ?? null;
}

/** Tags mapped, unmappable ones dropped, duplicates removed. Anything but an array is left alone. */
function mapTags(v: unknown): unknown {
  if (!Array.isArray(v)) return v;
  const out = v.map(mapTag).filter((t): t is string => t !== null);
  return [...new Set(out)];
}

function mapBool(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  const k = v.trim().toLowerCase();
  return k === 'true' ? true : k === 'false' ? false : v;
}

/** Review reply (`aiReviewSchema`). */
export function normalizeReview(json: unknown): unknown {
  if (!isObject(json)) return json;
  const out = { ...json };
  if ('ev_verdict' in out) out.ev_verdict = mapOr(VERDICTS, out.ev_verdict);
  if ('key_mistake_street' in out) out.key_mistake_street = mapOr(STREETS, out.key_mistake_street);
  if ('error_tags' in out) out.error_tags = mapTags(out.error_tags);
  if ('repeats_known_leak' in out) out.repeats_known_leak = mapBool(out.repeats_known_leak);
  return out;
}

/** `a`, `B+`, `b-` -> `A`/`B`; anything else stays. */
function mapGrade(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  const m = /^\s*([a-d])\s*[+-]?\s*$/i.exec(v);
  return m ? m[1].toUpperCase() : v;
}

/** Session summary reply (`aiSummarySchema`). */
export function normalizeSummary(json: unknown): unknown {
  if (!isObject(json)) return json;
  const out = { ...json };
  if ('grade' in out) out.grade = mapGrade(out.grade);
  if (Array.isArray(out.leaks)) {
    out.leaks = out.leaks.flatMap((l: unknown) => {
      if (!isObject(l)) return [l];
      const tag = mapTag(l.tag);
      return tag && tag !== 'none' ? [{ ...l, tag }] : [];
    });
  }
  return out;
}
