import { z } from 'zod';
import { languagePack } from './languages';
import { normalizeReview } from './normalize';
import {
  configuredPromptVersion,
  systemPrompt,
  type PromptFields,
  type PromptVersion,
} from './prompt';
import { parseJson, runJson, type Parsed, type Usage } from './run-json';
import { aiReviewSchema, type AiReview } from './schema';

export const REBUTTAL_DECISIONS = ['keep', 'revise'] as const;
export type RebuttalDecision = (typeof REBUTTAL_DECISIONS)[number];

/** The JSON a rebuttal must return: keep or revise, an answer to the argument, the full review. */
export const aiRebuttalSchema = z.object({
  decision: z
    .enum(REBUTTAL_DECISIONS)
    .describe('keep: the previous conclusion stands. revise: the review below replaces it.'),
  reply: z
    .string()
    .min(1)
    .max(1200)
    .describe(
      "Answer to the student's argument, speaking to it directly. Max 100 words. In the output language.",
    ),
  review: aiReviewSchema.describe('The full review after re-checking. Unchanged when keeping.'),
});

export type AiRebuttal = z.infer<typeof aiRebuttalSchema>;

export const aiRebuttalJsonSchema = z.toJSONSchema(aiRebuttalSchema);

const DECISION_WORDS: Record<string, RebuttalDecision> = {
  keep: 'keep',
  kept: 'keep',
  keeps: 'keep',
  maintain: 'keep',
  stand: 'keep',
  stands: 'keep',
  revise: 'revise',
  revised: 'revise',
  revises: 'revise',
  change: 'revise',
  changed: 'revise',
};

/** `Kept`, ` REVISED ` -> the fixed codes; review enums as for a plain review. */
export function normalizeRebuttal(json: unknown): unknown {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return json;
  const out: Record<string, unknown> = { ...json };
  if (typeof out.decision === 'string') {
    out.decision = DECISION_WORDS[out.decision.trim().toLowerCase()] ?? out.decision;
  }
  if ('review' in out) out.review = normalizeReview(out.review);
  return out;
}

export type RebuttalRun = Usage & {
  decision: RebuttalDecision;
  reply: string;
  review: AiReview;
  attempts: 1 | 2;
  promptVersion: PromptVersion;
};

/**
 * One rebuttal = one call (plus the usual single retry). The model re-checks its review against
 * the student's argument and says whether the conclusion stands.
 */
export async function runRebuttal(opts: {
  apiKey: string;
  model: string;
  userMessage: string;
  locale?: string;
  promptFields?: PromptFields | null;
  fetchImpl?: typeof fetch;
}): Promise<RebuttalRun> {
  const promptVersion = configuredPromptVersion();
  const pack = languagePack(opts.locale);
  const parse = (content: string): Parsed<AiRebuttal> => {
    const r = parseJson(content, aiRebuttalSchema, normalizeRebuttal);
    if (!r.ok) return r;
    const { reply, review: v } = r.value;
    if (!pack.check([reply, v.range, v.math, v.line, v.icm, v.lesson])) {
      return { ok: false, error: pack.fixRequest };
    }
    return r;
  };
  const { value, ...rest } = await runJson({
    apiKey: opts.apiKey,
    model: opts.model,
    system: systemPrompt(promptVersion, opts.promptFields),
    userMessage: opts.userMessage,
    schema: aiRebuttalJsonSchema as Record<string, unknown>,
    schemaName: 'hand_rebuttal',
    parse,
    fetchImpl: opts.fetchImpl,
  });
  return { ...value, reply: value.reply.trim(), promptVersion, ...rest };
}

export {
  hasFreeRebuttal,
  REBUTTAL_COLUMNS,
  reusableReview,
  threadOf,
  threadRebuttals,
  type RebuttalRow,
} from '@/lib/review/ai-state';
