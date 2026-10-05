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
  'id, source, range_text, math_text, line_text, icm_text, error_tags, ev_verdict, lesson, accepted';

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
  'offline',
  'server_error',
] as const;

/** Unknown codes fall back to a generic server error. */
export function aiErrorCode(code: unknown): (typeof AI_ERRORS)[number] {
  return AI_ERRORS.find((c) => c === code) ?? 'server_error';
}
