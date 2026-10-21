import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

/** Free plan: hand reviews and rebuttals per calendar month (DEC-007). */
export const FREE_MONTHLY_LIMIT = 30;
/** Bring-your-own-key plan: spam guard, calls per rolling hour. */
export const BYOK_HOURLY_LIMIT = 30;
export const DEFAULT_FREE_BUDGET_USD = 20;

/** Free plan: AI session summaries per calendar month (spec 5.2). Separate from the review allowance. */
export const SUMMARY_MONTHLY_LIMIT = 4;

/** Kinds that use up the monthly review allowance. Session summaries have their own. */
export const REVIEW_KINDS = ['hand_review', 'rebuttal'] as const;
export const SUMMARY_KINDS = ['session_summary'] as const;

export type AccessDenied = 'quota_exhausted' | 'budget_locked' | 'rate_limited';

export type AccessInput = {
  hasOwnKey: boolean;
  /** Calls of the kind being asked for that this user made this month and was billed to the app. */
  monthCalls: number;
  /** The monthly allowance for that kind. Default: the review allowance. */
  monthLimit?: number;
  /** Everything the app paid for this month, all users. */
  appSpendUsd: number;
  budgetUsd: number;
  /** Calls this user made in the last hour on their own key. */
  lastHourCalls: number;
};

export type Access =
  | { ok: true; billedTo: 'app' | 'user'; remaining: number | null }
  | { ok: false; code: AccessDenied };

/**
 * Who may call the model, and who pays. Own key: no monthly limit, 30 calls an hour. Free plan:
 * 30 a month, and the app-wide budget locks the free plan for the rest of the month once spent.
 * `remaining` is what is left after this call (null for own key).
 */
export function decideAccess(i: AccessInput): Access {
  if (i.hasOwnKey) {
    if (i.lastHourCalls >= BYOK_HOURLY_LIMIT) return { ok: false, code: 'rate_limited' };
    return { ok: true, billedTo: 'user', remaining: null };
  }
  if (i.appSpendUsd >= i.budgetUsd) return { ok: false, code: 'budget_locked' };
  const limit = i.monthLimit ?? FREE_MONTHLY_LIMIT;
  if (i.monthCalls >= limit) return { ok: false, code: 'quota_exhausted' };
  return { ok: true, billedTo: 'app', remaining: limit - i.monthCalls - 1 };
}

/**
 * A rebuttal: the first one of an analysis is free on the free plan (it runs with no turns left
 * and uses none), but the app budget still locks it. Later ones cost a turn like a review.
 */
export function decideRebuttalAccess(i: AccessInput, free: boolean): Access {
  if (i.hasOwnKey || !free) return decideAccess(i);
  if (i.appSpendUsd >= i.budgetUsd) return { ok: false, code: 'budget_locked' };
  const limit = i.monthLimit ?? FREE_MONTHLY_LIMIT;
  return { ok: true, billedTo: 'app', remaining: Math.max(0, limit - i.monthCalls) };
}

/** First instant of the UTC month of `now`. */
export function monthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function budgetFromEnv(raw = process.env.AI_FREE_BUDGET_USD): number {
  const n = Number(raw);
  return raw && Number.isFinite(n) && n > 0 ? n : DEFAULT_FREE_BUDGET_USD;
}

type Admin = SupabaseClient<Database>;

export type UsageSnapshot = {
  hasOwnKey: boolean;
  model: string | null;
  /** Reviews and rebuttals this month, billed to the app. */
  monthCalls: number;
  /** Session summaries this month, billed to the app. */
  summaryCalls: number;
  appSpendUsd: number;
  lastHourCalls: number;
};

/** Reads what {@link decideAccess} needs. Runs with the secret key, so `userId` must be trusted. */
export async function loadUsage(
  admin: Admin,
  userId: string,
  now = new Date(),
): Promise<UsageSnapshot> {
  const since = monthStart(now).toISOString();
  const hourAgo = new Date(now.getTime() - 3_600_000).toISOString();

  const monthCount = (kinds: readonly string[]) =>
    admin
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('billed_to', 'app')
      // A failed call costs the app money but never uses up the user's allowance (DEC-057).
      .eq('failed', false)
      .in('kind', [...kinds])
      .gte('created_at', since);

  const [key, month, summary, hour, spend] = await Promise.all([
    admin.from('user_api_keys').select('model').eq('user_id', userId).maybeSingle(),
    monthCount(REVIEW_KINDS),
    monthCount(SUMMARY_KINDS),
    admin
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('billed_to', 'user')
      .eq('failed', false)
      .gte('created_at', hourAgo),
    admin.rpc('ai_app_spend_since', { p_since: since }),
  ]);
  for (const r of [key, month, summary, hour, spend]) if (r.error) throw r.error;

  return {
    hasOwnKey: key.data != null,
    model: key.data?.model ?? null,
    monthCalls: month.count ?? 0,
    summaryCalls: summary.count ?? 0,
    lastHourCalls: hour.count ?? 0,
    appSpendUsd: Number(spend.data ?? 0),
  };
}
