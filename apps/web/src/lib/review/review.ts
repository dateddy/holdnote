import { isOneOf } from '@/lib/sessions/form';

/** Fixed error codes (spec 4.3). The AI review of task 3.1 picks from this same list. */
export const ERROR_TAGS = [
  'preflop_too_loose',
  'preflop_too_tight',
  'sizing_too_small',
  'sizing_too_large',
  'missed_value',
  'bad_bluff',
  'bluff_multiway',
  'call_too_loose',
  'fold_too_much',
  'passive_short',
  'misread_range',
  'read_right_act_wrong',
  'math_error',
  'tilt',
  'none',
] as const;
export type ErrorTag = (typeof ERROR_TAGS)[number];

export const EV_VERDICTS = ['correct', 'mistake', 'unsure'] as const;

/** Review fields as typed. */
export type ReviewDraft = {
  range: string;
  math: string;
  line: string;
  icmText: string;
  errorTags: string[];
  evVerdict: string;
  lesson: string;
  accepted: boolean;
};

/** The `reviews` columns the review form reads and writes. */
export type ReviewRow = {
  range_text: string | null;
  math_text: string | null;
  line_text: string | null;
  icm_text: string | null;
  error_tags: string[];
  ev_verdict: string | null;
  lesson: string | null;
  accepted: boolean;
};

export const REVIEW_COLUMNS =
  'id, source, prompt_version, range_text, math_text, line_text, icm_text, error_tags, ev_verdict, lesson, accepted';

export function emptyReview(): ReviewDraft {
  return {
    range: '',
    math: '',
    line: '',
    icmText: '',
    errorTags: [],
    evVerdict: '',
    lesson: '',
    accepted: false,
  };
}

export function fromReviewRow(row: ReviewRow | null): ReviewDraft {
  if (!row) return emptyReview();
  return {
    range: row.range_text ?? '',
    math: row.math_text ?? '',
    line: row.line_text ?? '',
    icmText: row.icm_text ?? '',
    errorTags: row.error_tags,
    evVerdict: row.ev_verdict ?? '',
    lesson: row.lesson ?? '',
    accepted: row.accepted,
  };
}

/** `none` stands alone; any other tag removes it. */
export function toggleTag(tags: string[], tag: string): string[] {
  if (tags.includes(tag)) return tags.filter((t) => t !== tag);
  return tag === 'none' ? ['none'] : [...tags.filter((t) => t !== 'none'), tag];
}

const text = (s: string) => s.trim() || null;

export function toReviewRow(draft: ReviewDraft, isMtt: boolean): ReviewRow {
  return {
    range_text: text(draft.range),
    math_text: text(draft.math),
    line_text: text(draft.line),
    icm_text: isMtt ? text(draft.icmText) : null,
    error_tags: draft.errorTags.filter((t) => isOneOf(ERROR_TAGS, t)),
    ev_verdict: isOneOf(EV_VERDICTS, draft.evVerdict) ? draft.evVerdict : null,
    lesson: text(draft.lesson),
    accepted: draft.accepted,
  };
}

/** Fields a reviewer writes. `accepted` is a decision about them, not one of them. */
export type ReviewField =
  'range' | 'math' | 'line' | 'icmText' | 'errorTags' | 'evVerdict' | 'lesson';

export const REVIEW_FIELDS: readonly ReviewField[] = [
  'range',
  'math',
  'line',
  'icmText',
  'errorTags',
  'evVerdict',
  'lesson',
];

/** True when `key` has the same value in both drafts (tags compare as a set, text ignores edge spaces). */
export function sameField(a: ReviewDraft, b: ReviewDraft, key: ReviewField): boolean {
  const x = a[key];
  const y = b[key];
  if (Array.isArray(x) && Array.isArray(y)) {
    return x.length === y.length && [...x].sort().join() === [...y].sort().join();
  }
  return String(x).trim() === String(y).trim();
}

/** Did the student change anything the AI wrote? Then the saved review becomes a manual one. */
export function contentChanged(a: ReviewDraft, b: ReviewDraft): boolean {
  return REVIEW_FIELDS.some((k) => !sameField(a, b, k));
}

/** Error codes of `/api/review` that the screen has a message for. */
export const AI_ERRORS = [
  'quota_exhausted',
  'budget_locked',
  'rate_limited',
  'invalid_output',
  'timeout',
  'provider_busy',
  'not_configured',
  'key_rejected',
  'unauthorized',
  'not_found',
  'nothing_to_summarize',
  'offline',
  'upstream_error',
  'save_failed',
  'server_error',
] as const;

/** Unknown codes fall back to a generic server error. */
export function aiErrorCode(code: unknown): (typeof AI_ERRORS)[number] {
  return AI_ERRORS.find((c) => c === code) ?? 'server_error';
}

/** Failures worth another try: nothing was saved and no turn was used (spec 5.1). */
const RETRYABLE: readonly string[] = [
  'invalid_output',
  'timeout',
  'provider_busy',
  'upstream_error',
  'save_failed',
  'offline',
  'server_error',
];

export const isRetryable = (code: string): boolean => RETRYABLE.includes(code);

// --- an AI review and the student's own review live side by side (DEC-064) ---------------------

/** The current review of each kind: a hand may have both. */
export function splitReviews<T extends { source: string }>(
  rows: readonly T[],
): { ai: T | null; manual: T | null } {
  return {
    ai: rows.find((r) => r.source === 'ai') ?? null,
    manual: rows.find((r) => r.source === 'manual') ?? null,
  };
}

/** What the lists need to know about a hand's reviews: is there an AI one, is any accepted. */
export type HandReviewInfo = { hasAi: boolean; accepted: boolean };

export function reviewInfoByHand(
  rows: readonly { hand_id: string; source: string; accepted: boolean }[],
): Map<string, HandReviewInfo> {
  const out = new Map<string, HandReviewInfo>();
  for (const r of rows) {
    const before = out.get(r.hand_id);
    out.set(r.hand_id, {
      hasAi: (before?.hasAi ?? false) || r.source === 'ai',
      accepted: (before?.accepted ?? false) || r.accepted,
    });
  }
  return out;
}

/** One review per hand for a summary: the student's own wins over the AI's. */
export function effectiveReviews<T extends { hand_id: string; source: string }>(
  rows: readonly T[],
): T[] {
  const byHand = new Map<string, T>();
  for (const r of rows) {
    const seen = byHand.get(r.hand_id);
    if (!seen || (r.source === 'manual' && seen.source !== 'manual')) byHand.set(r.hand_id, r);
  }
  return [...byHand.values()];
}

/** Both reviews give an EV verdict and they differ: the pair to show as "AI: Sai · Bạn: Đúng". */
export function evDivergence(
  ai: string | null | undefined,
  manual: string | null | undefined,
): { ai: string; manual: string } | null {
  if (!isOneOf(EV_VERDICTS, ai) || !isOneOf(EV_VERDICTS, manual) || ai === manual) return null;
  return { ai, manual };
}

/** The current reviews of many hands: `{ ai, manual }` by hand id. */
export function reviewsByHand<T extends { hand_id: string; source: string }>(
  rows: readonly T[],
): Record<string, { ai: T | null; manual: T | null }> {
  const out: Record<string, { ai: T | null; manual: T | null }> = {};
  for (const r of rows) {
    const entry = (out[r.hand_id] ??= { ai: null, manual: null });
    if (r.source === 'ai') entry.ai = r;
    else if (r.source === 'manual') entry.manual = r;
  }
  return out;
}
