import { languagePack } from './languages';
import { SYSTEM_PROMPT } from './prompt';
import { parseJson, runJson, type Parsed, type Usage } from './run-json';
import { aiReviewJsonSchema, aiReviewSchema, type AiReview } from './schema';

export { InvalidOutputError, type Usage } from './run-json';

export type ReviewRun = Usage & {
  review: AiReview;
  /** 1 = valid at once, 2 = valid after the retry. */
  attempts: 1 | 2;
};

/**
 * One review = one call, plus a single retry with the validation error when the JSON is wrong
 * (spec 5.1). Tokens and cost of both calls are added up. Throws `InvalidOutputError` when
 * the second reply is wrong too; the caller then logs nothing and charges nothing.
 */
export async function runReview(opts: {
  apiKey: string;
  model: string;
  userMessage: string;
  /** Profile locale: the reply must be written in this language. */
  locale?: string;
  /** Reasoning effort for models that think. Default `low`. */
  reasoningEffort?: 'low' | 'medium' | 'high';
  fetchImpl?: typeof fetch;
}): Promise<ReviewRun> {
  const pack = languagePack(opts.locale);
  const parse = (content: string): Parsed<AiReview> => {
    const r = parseJson(content, aiReviewSchema);
    if (!r.ok) return r;
    const v = r.value;
    // Right shape, wrong language: ask again rather than show it (spec 5.1 retry).
    if (!pack.check([v.range, v.math, v.line, v.icm, v.lesson])) {
      return { ok: false, error: pack.fixRequest };
    }
    return r;
  };
  const { value, ...rest } = await runJson({
    apiKey: opts.apiKey,
    model: opts.model,
    system: SYSTEM_PROMPT,
    userMessage: opts.userMessage,
    schema: aiReviewJsonSchema as Record<string, unknown>,
    schemaName: 'hand_review',
    parse,
    reasoningEffort: opts.reasoningEffort,
    fetchImpl: opts.fetchImpl,
  });
  return { review: value, ...rest };
}
