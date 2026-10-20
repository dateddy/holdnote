export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type ChatResult = {
  content: string;
  tokensIn: number;
  tokensOut: number;
  /** Cost in USD as reported by OpenRouter; 0 when the provider does not report it. */
  costUsd: number;
};

export class OpenRouterError extends Error {
  constructor(
    readonly kind: 'auth' | 'rate' | 'upstream' | 'timeout' | 'empty',
    message: string,
    /** What an `empty` reply still cost, and why it stopped (`length` = ran out of tokens). */
    readonly detail?: {
      finishReason: string | null;
      tokensIn: number;
      tokensOut: number;
      costUsd: number;
    },
  ) {
    super(message);
  }
}

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

/** One chat completion asking for JSON that matches `schema`. Called from server routes only. */
export async function chatJson(opts: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  schema: Record<string, unknown>;
  /** Name of the JSON schema in the request. Default `hand_review`. */
  schemaName?: string;
  reasoningEffort?: 'low' | 'medium' | 'high';
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<ChatResult> {
  const doFetch = opts.fetchImpl ?? fetch;
  let res: Response;
  // Structured output first; a model or provider that rejects `response_format` (400/404) is asked
  // once more with the prompt alone (it already says to return only JSON) and Zod does the checking.
  const send = (structured: boolean) =>
    doFetch(ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${opts.apiKey}`,
        'content-type': 'application/json',
        'x-title': 'HoldNote',
      },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        temperature: 0.3,
        // Reasoning models spend tokens thinking before the JSON: leave room, and keep it short.
        max_tokens: 4000,
        reasoning: { effort: opts.reasoningEffort ?? 'low' },
        usage: { include: true },
        ...(structured && {
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: opts.schemaName ?? 'hand_review',
              strict: true,
              schema: opts.schema,
            },
          },
        }),
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000),
    });
  try {
    res = await send(true);
    if (res.status === 400 || res.status === 404) res = await send(false);
  } catch (e) {
    const timeout = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
    throw new OpenRouterError(
      timeout ? 'timeout' : 'upstream',
      `request failed: ${e instanceof Error ? `${e.name} ${e.message} ${String((e as { cause?: unknown }).cause ?? '')}` : 'unknown'}`,
    );
  }

  if (res.status === 401 || res.status === 403) throw new OpenRouterError('auth', 'key rejected');
  if (res.status === 429) throw new OpenRouterError('rate', 'provider rate limit');
  if (!res.ok) throw new OpenRouterError('upstream', `status ${res.status}`);

  // The timeout also covers reading the body: a slow model can answer headers, then stall.
  const body = (await res.json().catch(() => null)) as {
    choices?: { finish_reason?: string | null; message?: { content?: string | null } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
  } | null;
  const content = body?.choices?.[0]?.message?.content;
  if (!body) throw new OpenRouterError('timeout', 'reply cut off');
  if (!content) {
    throw new OpenRouterError('empty', 'no content', {
      finishReason: body?.choices?.[0]?.finish_reason ?? null,
      tokensIn: body?.usage?.prompt_tokens ?? 0,
      tokensOut: body?.usage?.completion_tokens ?? 0,
      costUsd: body?.usage?.cost ?? 0,
    });
  }
  return {
    content,
    tokensIn: body?.usage?.prompt_tokens ?? 0,
    tokensOut: body?.usage?.completion_tokens ?? 0,
    costUsd: body?.usage?.cost ?? 0,
  };
}
