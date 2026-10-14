import {
  budgetFromEnv,
  FREE_MONTHLY_LIMIT,
  SUMMARY_MONTHLY_LIMIT,
  type UsageSnapshot,
} from './quota';

export type AiStatus = {
  plan: 'free' | 'byok';
  /** Model the user picked for their own key; null = default. */
  model: string | null;
  /** Reviews left this month on the free plan; null with an own key (no monthly limit). */
  remaining: number | null;
  limit: number | null;
  /** Session summaries left this month on the free plan; null with an own key. */
  summaryRemaining: number | null;
  summaryLimit: number | null;
  /** The app-wide free budget is spent: free-plan AI is off until next month. */
  budgetLocked: boolean;
};

/** What the Settings screen and `GET /api/settings/ai` show. Never contains the key. */
export function aiStatus(u: UsageSnapshot): AiStatus {
  if (u.hasOwnKey) {
    return {
      plan: 'byok',
      model: u.model,
      remaining: null,
      limit: null,
      summaryRemaining: null,
      summaryLimit: null,
      budgetLocked: false,
    };
  }
  return {
    plan: 'free',
    model: null,
    remaining: Math.max(0, FREE_MONTHLY_LIMIT - u.monthCalls),
    limit: FREE_MONTHLY_LIMIT,
    summaryRemaining: Math.max(0, SUMMARY_MONTHLY_LIMIT - u.summaryCalls),
    summaryLimit: SUMMARY_MONTHLY_LIMIT,
    budgetLocked: u.appSpendUsd >= budgetFromEnv(),
  };
}
