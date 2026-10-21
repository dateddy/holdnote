'use client';

import { useLocale, useTranslations } from 'next-intl';
import { potOddsAtDecisions, toBb } from 'poker-core';
import { ReviewForm, type AiInfo, type MathHint } from '@/components/hand/review-form';
import type { ReplayHand } from '@/lib/hands/replay';
import type { AiReviewState } from '@/lib/review/ai-state';
import { fromReviewRow, type ReviewRow } from '@/lib/review/review';

export type HandReview = ReviewRow & { id: string; source: string; prompt_version: string | null };

/**
 * The current reviews of a hand: the AI's and the student's own, either may be missing (DEC-064),
 * with the rebuttals of the AI analysis (task 5.1e).
 */
export type HandReviews = { ai: HandReview | null; manual: HandReview | null } & AiReviewState;

export const NO_REVIEWS: HandReviews = {
  ai: null,
  manual: null,
  rebuttals: [],
  freeRebuttal: true,
  aiStale: false,
};

type Props = {
  handId: string;
  reviews: HandReviews;
  /** Null when the hand cannot be replayed; the pot odds hints are then left out. */
  hand: ReplayHand | null;
  isMtt: boolean;
  ai: AiInfo;
};

/**
 * "AI phân tích" under the replayer, with "Bạn tự review" below it. Pot odds come from poker-core.
 */
export function ReviewPanel({ handId, reviews, hand, isMtt, ai }: Props) {
  const t = useTranslations('hand');
  const locale = useLocale();
  const fmt = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n);
  const mathHints: MathHint[] = hand
    ? potOddsAtDecisions(hand.input).map((d) => ({
        street: t(`street_${d.street}`),
        act: t(`act_${d.act}`),
        toCall: `${fmt(toBb(d.toCall, hand.bb))} bb`,
        odds: `${Math.round(d.potOdds * 100)}%`,
        mdf: d.mdf == null ? null : `${Math.round(d.mdf * 100)}%`,
      }))
    : [];

  return (
    <ReviewForm
      key={handId}
      handId={handId}
      aiReview={
        reviews.ai
          ? {
              id: reviews.ai.id,
              draft: fromReviewRow(reviews.ai),
            }
          : null
      }
      manualReview={
        reviews.manual ? { id: reviews.manual.id, draft: fromReviewRow(reviews.manual) } : null
      }
      rebuttals={reviews.rebuttals}
      freeRebuttal={reviews.freeRebuttal}
      aiStale={reviews.aiStale}
      ai={ai}
      isMtt={isMtt}
      mathHints={mathHints}
    />
  );
}
