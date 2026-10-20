import { chatJson, OpenRouterError, type ChatMessage, type ChatResult } from './openrouter';

export type Usage = { tokensIn: number; tokensOut: number; costUsd: number };

/** Both replies were invalid. Carries what the two calls cost, for budget tracking. */
export class InvalidOutputError extends Error {
  constructor(
    message: string,
    readonly usage: Usage,
  ) {
    super(message);
  }
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function sum(calls: ChatResult[]): Usage {
  return {
    tokensIn: calls.reduce((n, c) => n + c.tokensIn, 0),
    tokensOut: calls.reduce((n, c) => n + c.tokensOut, 0),
    costUsd: Math.round(calls.reduce((n, c) => n + c.costUsd, 0) * 1e6) / 1e6,
  };
}

/**
 * One call that must return JSON of a known shape, plus a single retry with the validation error
 * when it does not (spec 5.1). Tokens and cost of both calls are added up. `parse` turns the raw
 * reply into the value, or says what is wrong with it (shape or language). Throws
 * {@link InvalidOutputError} when the second reply is wrong too.
 */
export async function runJson<T>(opts: {
  apiKey: string;
  model: string;
  system: string;
  userMessage: string;
  schema: Record<string, unknown>;
  schemaName: string;
  parse: (content: string) => Parsed<T>;
  reasoningEffort?: 'low' | 'medium' | 'high';
  fetchImpl?: typeof fetch;
}): Promise<Usage & { value: T; attempts: 1 | 2 }> {
  const messages: ChatMessage[] = [
    { role: 'system', content: opts.system },
    { role: 'user', content: opts.userMessage },
  ];
  const call = (m: ChatMessage[]) =>
    chatJson({
      apiKey: opts.apiKey,
      model: opts.model,
      messages: m,
      schema: opts.schema,
      schemaName: opts.schemaName,
      reasoningEffort: opts.reasoningEffort,
      fetchImpl: opts.fetchImpl,
    });

  const first = await call(messages);
  const a = opts.parse(first.content);
  if (a.ok) return { value: a.value, attempts: 1, ...sum([first]) };

  let second: ChatResult;
  try {
    second = await call([
      ...messages,
      { role: 'assistant', content: first.content.slice(0, 4000) },
      {
        role: 'user',
        content: `Your reply did not match the schema: ${a.error}\nReturn ONLY corrected JSON.`,
      },
    ]);
  } catch (e) {
    // The first call was paid for even though the retry failed.
    if (e instanceof OpenRouterError) e.paid = sum([first]);
    throw e;
  }
  const b = opts.parse(second.content);
  if (b.ok) return { value: b.value, attempts: 2, ...sum([first, second]) };
  throw new InvalidOutputError(b.error, sum([first, second]));
}

/** JSON.parse + Zod-style `safeParse` in one step, with the issues turned into one line. */
export function parseJson<T>(
  content: string,
  schema: {
    safeParse: (
      v: unknown,
    ) => { success: true; data: T } | { success: false; error: { issues: Issue[] } };
  },
  /** Cleans the parsed JSON before the schema sees it (enum spellings, see normalize.ts). */
  normalize: (json: unknown) => unknown = (json) => json,
): Parsed<T> {
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    return { ok: false, error: 'The reply was not valid JSON.' };
  }
  const r = schema.safeParse(normalize(json));
  if (r.success) return { ok: true, value: r.data };
  return {
    ok: false,
    error: r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; '),
  };
}

type Issue = { path: PropertyKey[]; message: string };
