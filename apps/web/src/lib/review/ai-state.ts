import { cardMistake, type CardFacts } from '@/lib/ai/card-check';
import { reviewInLanguage } from '@/lib/ai/languages';

/**
 * Hand back the current AI review without calling the model: a plain request on a hand that has
 * not changed since, in the language the profile uses now. A rebuttal always calls the model.
 */
export function reusableReview(i: {
  rebuttal: boolean;
  current: {
    source: string;
    created_at: string;
    range_text: string | null;
    math_text: string | null;
    line_text: string | null;
    lesson: string | null;
  } | null;
  handUpdatedAt: string;
  locale: string;
}): boolean {
  const { current } = i;
  return (
    !i.rebuttal &&
    current?.source === 'ai' &&
    current.created_at > i.handUpdatedAt &&
    reviewInLanguage(current, i.locale)
  );
}

/** One row of `review_rebuttals`. */
export type RebuttalRow = {
  id: string;
  thread_id: string;
  review_id: string;
  new_review_id: string | null;
  reason: string;
  outcome: 'kept' | 'revised';
  reply: string;
  free: boolean;
  created_at: string;
  /** Screen only: the answer names cards that are not in the hand (task 5.1f). */
  card_flag?: boolean;
};

export const REBUTTAL_COLUMNS =
  'id, thread_id, review_id, new_review_id, reason, outcome, reply, free, created_at';

/**
 * The analysis a review belongs to: a review made by a rebuttal keeps the thread of the one it
 * replaced; any other review starts its own.
 */
export function threadOf(reviewId: string, rows: readonly RebuttalRow[]): string {
  return rows.find((r) => r.new_review_id === reviewId)?.thread_id ?? reviewId;
}

/** The rebuttals of the analysis `reviewId` belongs to, oldest first. */
export function threadRebuttals(reviewId: string, rows: readonly RebuttalRow[]): RebuttalRow[] {
  const thread = threadOf(reviewId, rows);
  return rows
    .filter((r) => r.thread_id === thread)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** Each analysis comes with one rebuttal that uses no turn. */
export function hasFreeRebuttal(reviewId: string, rows: readonly RebuttalRow[]): boolean {
  return !threadRebuttals(reviewId, rows).some((r) => r.free);
}

/** What the AI part of a hand screen needs beyond the reviews themselves. */
export type AiReviewState = {
  /** The rebuttals of the current AI analysis, oldest first. */
  rebuttals: RebuttalRow[];
  /** The next rebuttal of this analysis uses no turn. */
  freeRebuttal: boolean;
  /** The hand changed (or the language did) since the AI review: running it again is useful. */
  aiStale: boolean;
  /** The current AI review names cards that are not in the hand (task 5.1f). */
  aiCardFlag: boolean;
};

export function aiReviewState(
  ai: {
    id: string;
    source: string;
    created_at: string;
    range_text: string | null;
    math_text: string | null;
    line_text: string | null;
    icm_text?: string | null;
    lesson: string | null;
  } | null,
  rebuttals: readonly RebuttalRow[],
  handUpdatedAt: string,
  locale: string,
  /** The real cards; without them nothing is flagged. */
  cards?: CardFacts,
): AiReviewState {
  if (!ai) return { rebuttals: [], freeRebuttal: true, aiStale: false, aiCardFlag: false };
  // Same check as the server ran on the reply: a review saved with wrong cards is flagged here.
  const wrong = (texts: (string | null | undefined)[]) =>
    !!cards &&
    cardMistake(
      texts.map((t) => t ?? ''),
      cards,
    ) != null;
  return {
    rebuttals: threadRebuttals(ai.id, rebuttals).map((r) => ({
      ...r,
      card_flag: wrong([r.reply]),
    })),
    freeRebuttal: hasFreeRebuttal(ai.id, rebuttals),
    aiStale: !reusableReview({ rebuttal: false, current: ai, handUpdatedAt, locale }),
    aiCardFlag: wrong([ai.range_text, ai.math_text, ai.line_text, ai.icm_text, ai.lesson]),
  };
}
