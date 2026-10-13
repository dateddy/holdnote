import { chatJson, type ChatMessage, type ChatResult } from './openrouter';
import { languagePack, type LanguagePack } from './languages';
import { SYSTEM_PROMPT } from './prompt';
import { aiReviewJsonSchema, aiReviewSchema, type AiReview } from './schema';

export type Usage = { tokensIn: number; tokensOut: number; costUsd: number };

export type ReviewRun = Usage & {
  review: AiReview;
  /** 1 = valid at once, 2 = valid after the retry. */
  attempts: 1 | 2;
};

/** Both replies were invalid. Carries what the two calls cost, for budget tracking. */
export class InvalidOutputError extends Error {
  constructor(
    message: string,
    readonly usage: Usage,
  ) {
    super(message);
  }
}

function parse(
  content: string,
  pack: LanguagePack,
): { ok: true; value: AiReview } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    return { ok: false, error: 'The reply was not valid JSON.' };
  }
  const r = aiReviewSchema.safeParse(json);
  if (r.success) {
    const v = r.data;
    // Right shape, wrong language: ask again rather than show it (spec 5.1 retry).
    if (!pack.check([v.range, v.math, v.line, v.icm, v.lesson])) {
      return { ok: false, error: pack.fixRequest };
    }
    return { ok: true, value: v };
  }
  return {
    ok: false,
    error: r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; '),
  };
}

function usage(calls: ChatResult[]): Usage {
  return {
    tokensIn: calls.reduce((n, c) => n + c.tokensIn, 0),
    tokensOut: calls.reduce((n, c) => n + c.tokensOut, 0),
    costUsd: Math.round(calls.reduce((n, c) => n + c.costUsd, 0) * 1e6) / 1e6,
  };
}

/**
 * One review = one call, plus a single retry with the validation error when the JSON is wrong
 * (spec 5.1). Tokens and cost of both calls are added up. Throws {@link InvalidOutputError} when
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
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: opts.userMessage },
  ];
  const call = (m: ChatMessage[]) =>
    chatJson({
      apiKey: opts.apiKey,
      model: opts.model,
      messages: m,
      schema: aiReviewJsonSchema as Record<string, unknown>,
      reasoningEffort: opts.reasoningEffort,
      fetchImpl: opts.fetchImpl,
    });

  const first = await call(messages);
  const a = parse(first.content, pack);
  if (a.ok) return { review: a.value, attempts: 1, ...usage([first]) };

  const second = await call([
    ...messages,
    { role: 'assistant', content: first.content.slice(0, 4000) },
    {
      role: 'user',
      content: `Your reply did not match the schema: ${a.error}\nReturn ONLY corrected JSON.`,
    },
  ]);
  const b = parse(second.content, pack);
  if (b.ok) return { review: b.value, attempts: 2, ...usage([first, second]) };
  throw new InvalidOutputError(b.error, usage([first, second]));
}
