'use client';

import { useLocale, useTranslations } from 'next-intl';
import { potOddsAtDecisions, toBb } from 'poker-core';
import { ReviewForm, type AiInfo, type MathHint } from '@/components/hand/review-form';
import type { ReplayHand } from '@/lib/hands/replay';
import { fromReviewRow, type ReviewRow } from '@/lib/review/review';

export type HandReview = ReviewRow & { id: string; source: string; prompt_version: string | null };

type Props = {
  handId: string;
  /** The current review of the hand, as saved; null when there is none yet. */
  review: HandReview | null;
  /** Null when the hand cannot be replayed; the pot odds hints are then left out. */
  hand: ReplayHand | null;
  isMtt: boolean;
  ai: AiInfo;
};

/**
 * "Ý kiến thứ hai": the review block under the replayer. A saved review shows its text, the prompt
 * version and the rebuttal; without one the AI button (by quota) is there. Pot odds come from poker-core.
 */
export function ReviewPanel({ handId, review, hand, isMtt, ai }: Props) {
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
      reviewId={review?.id ?? null}
      source={review?.source ?? null}
      promptVersion={review?.prompt_version ?? null}
      initial={fromReviewRow(review)}
      ai={ai}
      isMtt={isMtt}
      mathHints={mathHints}
    />
  );
}
