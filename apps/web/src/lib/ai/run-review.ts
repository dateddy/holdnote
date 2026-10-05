import { chatJson, type ChatMessage, type ChatResult } from './openrouter';
import { SYSTEM_PROMPT } from './prompt';
import { aiReviewJsonSchema, aiReviewSchema, type AiReview } from './schema';

export type ReviewRun = {
  review: AiReview;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
};

export class InvalidOutputError extends Error {}

function parse(content: string): { ok: true; value: AiReview } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    return { ok: false, error: 'The reply was not valid JSON.' };
  }
  const r = aiReviewSchema.safeParse(json);
  if (r.success) return { ok: true, value: r.data };
  return {
    ok: false,
    error: r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; '),
  };
}

function usage(calls: ChatResult[]) {
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
  fetchImpl?: typeof fetch;
}): Promise<ReviewRun> {
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
      fetchImpl: opts.fetchImpl,
    });

  const first = await call(messages);
  const a = parse(first.content);
  if (a.ok) return { review: a.value, ...usage([first]) };

  const second = await call([
    ...messages,
    { role: 'assistant', content: first.content.slice(0, 4000) },
    {
      role: 'user',
      content: `Your reply did not match the schema: ${a.error}\nReturn ONLY corrected JSON.`,
    },
  ]);
  const b = parse(second.content);
  if (b.ok) return { review: b.value, ...usage([first, second]) };
  throw new InvalidOutputError(b.error);
}
