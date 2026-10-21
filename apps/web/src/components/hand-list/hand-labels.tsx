'use client';

import { Badge } from '@/components/ui/badge';
import type { HandRow } from '@/lib/hands/session-hands';
import { useHandText } from './use-hand-text';

/** Labels of a hand: to review, AI reviewed, missing data. */
export function HandLabels({ row }: { row: HandRow }) {
  const { t } = useHandText();
  if (!row.needsReview && !row.aiReviewed && !row.missing) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {row.needsReview && <Badge tone="warn">{t('needsReview')}</Badge>}
      {row.aiReviewed && <Badge tone="accent">{t('aiReviewed')}</Badge>}
      {row.missing && <Badge tone="muted">{t('missing')}</Badge>}
    </span>
  );
}
