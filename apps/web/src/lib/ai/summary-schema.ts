import { z } from 'zod';
import { ERROR_TAGS } from '@/lib/review/review';
import { GRADES, SUMMARY_LIMITS, type SessionSummary } from '@/lib/sessions/summary';

/** Tags a leak can be named with: every fixed code except `none`. */
const LEAK_TAGS = ERROR_TAGS.filter((t) => t !== 'none') as [string, ...string[]];

const line = (what: string) =>
  z
    .string()
    .max(500)
    .describe(`${what}. Max 40 words. In the output language named at the top of the message.`);

/** The JSON the model must return for a session summary (spec 5.6). */
export const aiSummarySchema = z.object({
  grade: z.enum(GRADES),
  good: z.array(line('One thing the player did well this session')).max(SUMMARY_LIMITS.good),
  leaks: z
    .array(
      z.object({
        tag: z.enum(LEAK_TAGS),
        note: line('What went wrong, with the hand numbers or the cost in bb'),
      }),
    )
    .max(SUMMARY_LIMITS.leaks),
  rules: z.array(line('A short rule for the next session')).max(SUMMARY_LIMITS.rules),
});

export type AiSummary = z.infer<typeof aiSummarySchema>;

export const aiSummaryJsonSchema = z.toJSONSchema(aiSummarySchema);

/** Every long text in a summary, for the language check. */
export const summaryTexts = (s: AiSummary): string[] => [
  ...s.good,
  ...s.leaks.map((l) => l.note),
  ...s.rules,
];

/**
 * The draft that fills the summary form. Leak notes go into the free-text notes, one line each;
 * the player edits it all before saving (spec 5.6). Duplicate tags collapse to the first.
 */
export function toSummaryDraft(s: AiSummary): SessionSummary {
  const seen = new Set<string>();
  const leaks = s.leaks.filter((l) => !seen.has(l.tag) && seen.add(l.tag));
  return {
    grade: s.grade,
    good: s.good.map((x) => x.trim()).filter(Boolean),
    leak_tags: leaks.map((l) => l.tag),
    rules: s.rules.map((x) => x.trim()).filter(Boolean),
    notes: leaks
      .map((l) => l.note.trim())
      .filter(Boolean)
      .map((n) => `• ${n}`)
      .join('\n'),
  };
}
