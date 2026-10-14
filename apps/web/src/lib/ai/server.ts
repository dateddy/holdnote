import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { OpenRouterError } from './openrouter';
import type { UsageSnapshot } from './quota';
import { InvalidOutputError } from './run-json';

export type Failure = { code: string; status: number };

/** Key and model for this call: the user's own (Vault) or the app's. Server routes only. */
export async function resolveCredentials(
  admin: SupabaseClient<Database>,
  userId: string,
  usage: Pick<UsageSnapshot, 'hasOwnKey'>,
): Promise<{ apiKey: string; model: string } | Failure> {
  let apiKey = process.env.OPENROUTER_API_KEY;
  let model = process.env.OPENROUTER_MODEL;
  if (usage.hasOwnKey) {
    const { data } = await admin.rpc('get_user_api_key', { p_user: userId });
    const own = data?.[0];
    if (!own) return { code: 'server_error', status: 500 };
    apiKey = own.api_key;
    model = own.model ?? model;
  }
  if (!apiKey || !model) return { code: 'not_configured', status: 503 };
  return { apiKey, model };
}

/** The error code and HTTP status for a failed model call; rethrows what it does not know. */
export function modelFailure(e: unknown, hasOwnKey: boolean): Failure {
  if (e instanceof InvalidOutputError) return { code: 'invalid_output', status: 502 };
  if (e instanceof OpenRouterError) {
    if (e.kind === 'auth')
      return { code: hasOwnKey ? 'key_rejected' : 'server_error', status: 502 };
    if (e.kind === 'rate') return { code: 'provider_busy', status: 503 };
    if (e.kind === 'timeout') return { code: 'timeout', status: 504 };
    return { code: 'upstream_error', status: 502 };
  }
  throw e;
}

export const isFailure = (x: object): x is Failure => 'code' in x;
