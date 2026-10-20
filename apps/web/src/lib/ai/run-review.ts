import { languagePack } from './languages';
import {
  configuredPromptVersion,
  systemPrompt,
  type PromptFields,
  type PromptVersion,
} from './prompt';
import { parseJson, runJson, type Parsed, type Usage } from './run-json';
import { aiReviewJsonSchema, aiReviewSchema, type AiReview } from './schema';

export { InvalidOutputError, type Usage } from './run-json';

export type ReviewRun = Usage & {
  review: AiReview;
  /** 1 = valid at once, 2 = valid after the retry. */
  attempts: 1 | 2;
  /** The prompt the review was made with; stored in `reviews.prompt_version`. */
  promptVersion: PromptVersion;
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
  /** Default: `AI_PROMPT_VERSION`, else v1. */
  promptVersion?: PromptVersion;
  /** Fields the hand has beyond the old context; v1 describes only those. */
  promptFields?: PromptFields | null;
  /** Benchmark only: replaces the prompt text of `promptVersion`. */
  system?: string;
  fetchImpl?: typeof fetch;
}): Promise<ReviewRun> {
  const promptVersion = opts.promptVersion ?? configuredPromptVersion();
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
    system: opts.system ?? systemPrompt(promptVersion, opts.promptFields),
    userMessage: opts.userMessage,
    schema: aiReviewJsonSchema as Record<string, unknown>,
    schemaName: 'hand_review',
    parse,
    reasoningEffort: opts.reasoningEffort,
    fetchImpl: opts.fetchImpl,
  });
  return { review: value, promptVersion, ...rest };
}
