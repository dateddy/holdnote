import { languagePack } from './languages';
import { normalizeSummary } from './normalize';
import { parseJson, runJson, type Parsed, type Usage } from './run-json';
import { SUMMARY_SYSTEM_PROMPT } from './summary-prompt';
import {
  aiSummaryJsonSchema,
  aiSummarySchema,
  summaryTexts,
  type AiSummary,
} from './summary-schema';

export type SummaryRun = Usage & { summary: AiSummary; attempts: 1 | 2 };

/**
 * One summary = one call, plus a single retry when the JSON or the language is wrong (spec 5.1).
 * Throws `InvalidOutputError` when the second reply is wrong too; the caller then charges nothing.
 */
export async function runSummary(opts: {
  apiKey: string;
  model: string;
  userMessage: string;
  locale?: string;
  reasoningEffort?: 'low' | 'medium' | 'high';
  fetchImpl?: typeof fetch;
}): Promise<SummaryRun> {
  const pack = languagePack(opts.locale);
  const parse = (content: string): Parsed<AiSummary> => {
    const r = parseJson(content, aiSummarySchema, normalizeSummary);
    if (!r.ok) return r;
    return pack.check(summaryTexts(r.value)) ? r : { ok: false, error: pack.fixRequest };
  };
  const { value, ...rest } = await runJson({
    apiKey: opts.apiKey,
    model: opts.model,
    system: SUMMARY_SYSTEM_PROMPT,
    userMessage: opts.userMessage,
    schema: aiSummaryJsonSchema as Record<string, unknown>,
    schemaName: 'session_summary',
    parse,
    reasoningEffort: opts.reasoningEffort,
    fetchImpl: opts.fetchImpl,
  });
  return { summary: value, ...rest };
}
