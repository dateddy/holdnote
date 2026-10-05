import { z } from 'zod';
import { ERROR_TAGS, EV_VERDICTS } from '@/lib/review/review';

/** The JSON the model must return (spec 5.4). Each text field is capped at roughly 80 words. */
const text = z.string().max(800);

export const aiReviewSchema = z.object({
  range: text,
  math: text,
  line: text,
  icm: text,
  error_tags: z.array(z.enum(ERROR_TAGS)).max(4),
  ev_verdict: z.enum(EV_VERDICTS),
  key_mistake_street: z.enum(['preflop', 'flop', 'turn', 'river', 'none']),
  repeats_known_leak: z.boolean(),
  lesson: text,
  missing_info: z.array(z.string().max(120)).max(6),
});

export type AiReview = z.infer<typeof aiReviewSchema>;

/** JSON schema sent as `response_format`, so the model is steered to the same shape Zod checks. */
export const aiReviewJsonSchema = z.toJSONSchema(aiReviewSchema);

/** `none` stands alone: drop other tags when it is present together with them. */
export function normalizeTags(tags: readonly string[]): string[] {
  const unique = [...new Set(tags)];
  if (unique.length > 1 && unique.includes('none')) return unique.filter((t) => t !== 'none');
  return unique;
}

/** The `reviews` columns for an AI result (fed to `replace_current_review`). */
export function toAiReviewRow(r: AiReview, model: string, isMtt: boolean) {
  const missing = r.missing_info.filter((m) => m.trim());
  return {
    source: 'ai' as const,
    model,
    range_text: r.range.trim() || null,
    math_text:
      [r.math.trim(), missing.length ? `Missing: ${missing.join(', ')}` : '']
        .filter(Boolean)
        .join('\n') || null,
    line_text: r.line.trim() || null,
    icm_text: isMtt ? r.icm.trim() || null : null,
    error_tags: normalizeTags(r.error_tags),
    ev_verdict: r.ev_verdict,
    lesson: r.lesson.trim() || null,
    accepted: false,
  };
}
