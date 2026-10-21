/**
 * Comparing an AI review with a review written in the old app (task 3.4).
 * The old app used coarse error groups, not the 14 codes, so AI codes are mapped onto them.
 */

export const OLD_GROUPS = [
  'Preflop',
  'Sizing',
  'Đọc sai range',
  'Cảm xúc',
  'Toán',
  'Không lỗi',
] as const;

/** Group for codes the old app has no word for (missed value, bad bluff, ...). Never a match. */
export const OTHER_GROUP = 'Khác';

export function groupOfTag(tag: string): string {
  if (tag.startsWith('preflop_')) return 'Preflop';
  if (tag.startsWith('sizing_')) return 'Sizing';
  if (tag === 'misread_range') return 'Đọc sai range';
  if (tag === 'tilt') return 'Cảm xúc';
  if (tag === 'math_error') return 'Toán';
  if (tag === 'none') return 'Không lỗi';
  return OTHER_GROUP;
}

export function groupsOfTags(tags: readonly string[]): string[] {
  return [...new Set(tags.map(groupOfTag))];
}

const OLD_EV: Record<string, string> = { Đúng: 'correct', Sai: 'mistake', 'Chưa chắc': 'unsure' };

/** Old EV label to the app's verdict code; null when the old review has none. */
export function evOfOld(label: string | undefined): string | null {
  return (label && OLD_EV[label]) || null;
}

/** A saved review row, as far as a benchmark label needs it. */
export type LabelRow = {
  source: string;
  is_current: boolean;
  error_tags: readonly string[];
  ev_verdict: string | null;
};

/**
 * The label a benchmark compares an AI review with, read from the database (after the old hands
 * are migrated, task 5.2): the student's own current review, never the AI's and never history.
 * Same shape as the old-app label (`groups`, `ev`), so `compareReviews` takes it as it is.
 */
export function manualLabel(
  rows: readonly LabelRow[],
): { groups: string[]; ev: string | null } | null {
  const own = rows.find((r) => r.source === 'manual' && r.is_current);
  return own ? { groups: groupsOfTags(own.error_tags), ev: own.ev_verdict || null } : null;
}

const hasError = (groups: readonly string[]) => groups.some((g) => g !== 'Không lỗi');

export type Comparison = {
  /** Same set of groups. */
  groupsExact: boolean;
  /** At least one group in common (or both say no error). */
  groupsOverlap: boolean;
  /** Both say there is an error, or both say there is none. */
  errorFlag: boolean;
  /** Same EV verdict; null when the old review has no EV. */
  evMatch: boolean | null;
};

export function compareReviews(
  old: { groups: readonly string[]; ev: string | null },
  ai: { tags: readonly string[]; ev: string },
): Comparison {
  const a = groupsOfTags(ai.tags);
  const o = [...new Set(old.groups)];
  const common = a.filter((g) => o.includes(g));
  return {
    groupsExact: a.length === o.length && common.length === a.length,
    groupsOverlap: common.length > 0,
    errorFlag: hasError(a) === hasError(o),
    evMatch: old.ev == null ? null : old.ev === ai.ev,
  };
}

export type Row = {
  ok: boolean;
  /** 1 = valid at once, 2 = valid after retry. */
  attempts: number | null;
  costUsd: number;
  ms: number;
  cmp: Comparison | null;
};

const pct = (n: number, d: number) => (d === 0 ? 'n/a' : `${Math.round((n / d) * 100)}%`);

/** One line of the model table in the report. */
export function summarize(rows: readonly Row[]) {
  const ok = rows.filter((r) => r.ok);
  const cmp = ok.flatMap((r) => (r.cmp ? [r.cmp] : []));
  const ev = cmp.filter((c) => c.evMatch !== null);
  const cost = rows.reduce((n, r) => n + r.costUsd, 0);
  return {
    runs: rows.length,
    valid: pct(ok.length, rows.length),
    validFirstTry: pct(ok.filter((r) => r.attempts === 1).length, rows.length),
    groupsExact: pct(cmp.filter((c) => c.groupsExact).length, cmp.length),
    groupsOverlap: pct(cmp.filter((c) => c.groupsOverlap).length, cmp.length),
    errorFlag: pct(cmp.filter((c) => c.errorFlag).length, cmp.length),
    ev: pct(ev.filter((c) => c.evMatch).length, ev.length),
    costPerHand: rows.length ? cost / rows.length : 0,
    totalCost: cost,
    seconds: rows.length ? rows.reduce((n, r) => n + r.ms, 0) / rows.length / 1000 : 0,
  };
}

export type VerdictPair = { oldEv: string | null; aiEv: string };

/**
 * Where the AI verdict goes wrong against the old review: a hand Đạt marked correct that the AI
 * calls a mistake (false alarm), and a hand Đạt marked a mistake that the AI calls correct
 * (missed). `n` of `d`.
 */
export function verdictErrors(rows: readonly VerdictPair[]) {
  const right = rows.filter((r) => r.oldEv === 'correct');
  const wrong = rows.filter((r) => r.oldEv === 'mistake');
  return {
    falseMistake: { n: right.filter((r) => r.aiEv === 'mistake').length, d: right.length },
    missedMistake: { n: wrong.filter((r) => r.aiEv === 'correct').length, d: wrong.length },
  };
}

export type Spread = { mean: number; min: number; max: number };

/** Mean and range of the values that exist; null when there are none. */
export function spread(xs: readonly (number | null)[]): Spread | null {
  const v = xs.filter((x): x is number => x !== null);
  if (v.length === 0) return null;
  return {
    mean: v.reduce((a, b) => a + b, 0) / v.length,
    min: Math.min(...v),
    max: Math.max(...v),
  };
}

export const formatSpread = (s: Spread | null) =>
  s
    ? `${Math.round(s.mean * 100)}% (${Math.round(s.min * 100)}–${Math.round(s.max * 100)})`
    : 'n/a';

export type RunRow = {
  /** The reply was valid JSON of the right shape (after the one retry). */
  ok: boolean;
  evMatch: boolean | null;
  oldEv: string | null;
  aiEv: string | null;
};

/**
 * One run of one configuration. Broken JSON is its own rate and stays out of the other three:
 * EV match, false alarms and misses are measured on the replies that were valid.
 */
export function runStats(rows: readonly RunRow[]) {
  const ok = rows.filter((r) => r.ok);
  const ev = ok.filter((r) => r.evMatch !== null);
  const e = verdictErrors(ok.map((r) => ({ oldEv: r.oldEv, aiEv: r.aiEv ?? '' })));
  const rate = (n: number, d: number) => (d === 0 ? null : n / d);
  return {
    invalidJson: rate(rows.length - ok.length, rows.length),
    evMatch: rate(ev.filter((r) => r.evMatch).length, ev.length),
    falseMistake: rate(e.falseMistake.n, e.falseMistake.d),
    missedMistake: rate(e.missedMistake.n, e.missedMistake.d),
  };
}

/** Deterministic halves for tuning the prompt on one and measuring on the other. */
export function inSplit<T>(items: readonly T[], split: 'tune' | 'test' | 'all'): T[] {
  if (split === 'all') return [...items];
  return items.filter((_, i) => (i % 2 === 0) === (split === 'tune'));
}

/** Per old error group: in how many hands the old review has it, and how often the AI found it. */
export function groupRecall(
  rows: readonly { oldGroups: readonly string[]; aiTags: readonly string[] }[],
): Record<string, { n: number; hit: number }> {
  const out: Record<string, { n: number; hit: number }> = {};
  for (const r of rows) {
    const ai = groupsOfTags(r.aiTags);
    for (const g of new Set(r.oldGroups)) {
      out[g] ??= { n: 0, hit: 0 };
      out[g].n++;
      if (ai.includes(g)) out[g].hit++;
    }
  }
  return out;
}

const wordCount = (s: string | null | undefined) =>
  (s ?? '').trim().split(/\s+/).filter(Boolean).length;

/** Style of the AI texts: "Hero/Villain" instead of "mình/đối thủ", and how long the lessons are. */
export function styleStats(
  reviews: readonly { texts: readonly (string | null)[]; lesson: string | null; ev: string }[],
) {
  const n = reviews.length;
  const heroVillain = reviews.reduce(
    (c, r) => c + (r.texts.join(' ').match(/\b(Hero|Villain)\b/g)?.length ?? 0),
    0,
  );
  return {
    heroVillainPerReview: n ? (heroVillain || 0) / n : 0,
    lessonWords: n ? reviews.reduce((c, r) => c + wordCount(r.lesson), 0) / n : 0,
    unsure: pct(reviews.filter((r) => r.ev === 'unsure').length, n),
    numberedLessons: pct(reviews.filter((r) => /(^|\s)1\.\s/.test(r.lesson ?? '')).length, n),
  };
}
