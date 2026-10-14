'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useActionState, useMemo, useState } from 'react';
import { bbPerHour, sessionResult, stopLossBreached, type StatsSession } from 'poker-core';
import { saveSummary, type SaveSummaryState } from '@/app/(app)/sessions/[id]/summary/actions';
import { aiErrorCode, ERROR_TAGS } from '@/lib/review/review';
import { formatMoney } from '@/lib/sessions/format';
import {
  applyFormToStats,
  BUST_STAGES,
  GRADES,
  SELF_STATES,
  SUMMARY_LIMITS,
  type SessionSummary,
  type SummaryFormValues,
} from '@/lib/sessions/summary';

const AREA = 'w-full rounded-md border border-current/20 bg-transparent p-3 text-base';
const INPUT = 'h-12 w-full rounded-md border border-current/20 bg-transparent px-3 text-base';
const chip = (on: boolean) =>
  `flex h-10 items-center justify-center rounded-md border px-3 text-sm ${
    on ? 'border-foreground bg-foreground text-background' : 'border-current/20'
  }`;

const LEAK_TAGS = ERROR_TAGS.filter((t) => t !== 'none');

export type SummaryAiInfo = {
  plan: 'free' | 'byok';
  /** Summaries left this month on the free plan; null with an own key. */
  remaining: number | null;
  locked: boolean;
};

type Props = {
  sessionId: string;
  /** The saved session; typed-but-unsaved values are applied on top for the live result. */
  base: StatsSession;
  initial: SummaryFormValues;
  handCount: number;
  reviewedCount: number;
  /** Hands per error tag from this session's reviews. */
  leakHints: Record<string, number>;
  ai: SummaryAiInfo;
};

type AiResponse = { draft?: SessionSummary; remaining?: number | null; error?: string };

/** Session summary (spec 3.8): result, self grade, good points, leaks, rules, state. */
export function SummaryForm({
  sessionId,
  base,
  initial,
  handCount,
  reviewedCount,
  leakHints,
  ai,
}: Props) {
  const t = useTranslations('summary');
  const tReview = useTranslations('review');
  const locale = useLocale();
  const [state, formAction, pending] = useActionState<SaveSummaryState, FormData>(
    saveSummary.bind(null, sessionId),
    { values: initial, errors: {}, failed: false },
  );
  const [v, setV] = useState<SummaryFormValues>(state.values);
  const [draft, setDraft] = useState<SessionSummary | null>(null);
  const [remaining, setRemaining] = useState(ai.remaining);
  const [run, setRun] = useState<'idle' | 'busy'>('idle');
  const [aiError, setAiError] = useState<string | null>(null);

  const set = <K extends keyof SummaryFormValues>(key: K, value: SummaryFormValues[K]) =>
    setV((x) => ({ ...x, [key]: value }));

  const live = useMemo(() => applyFormToStats(base, v), [base, v]);
  const result = sessionResult(live);
  const rate = bbPerHour(live);
  const breached = stopLossBreached(live);
  const isMtt = base.kind === 'mtt';
  const outOfTurns = ai.plan === 'free' && (ai.locked || remaining === 0);
  const err = (field: keyof SummaryFormValues) =>
    state.errors[field] ? (
      <span role="alert" className="text-sm text-red-700">
        {t(`error_${state.errors[field]}`)}
      </span>
    ) : null;

  const aiMark = (same: boolean) =>
    draft && same ? (
      <span className="ml-2 rounded bg-foreground/10 px-1.5 py-0.5 text-xs font-medium">
        {t('aiLabel')}
      </span>
    ) : null;
  const lines = (list: string[]) => list.join('\n');

  async function callAi() {
    setRun('busy');
    setAiError(null);
    try {
      const res = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          cashout: v.cashout,
          selfState: v.selfState,
          prize: v.prize,
          bounty: v.bounty,
          place: v.place,
          entries: v.entries,
          reentries: v.reentries,
          bustStage: v.bustStage,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as AiResponse;
      if (!res.ok || !data.draft) {
        setAiError(aiErrorCode(data.error));
        return;
      }
      const d = data.draft;
      setDraft(d);
      setV((x) => ({
        ...x,
        grade: d.grade ?? '',
        good: lines(d.good),
        leaks: d.leak_tags,
        rules: lines(d.rules),
        notes: d.notes,
      }));
      setRemaining(data.remaining ?? null);
    } catch {
      setAiError('offline');
    } finally {
      setRun('idle');
    }
  }

  const money = (n: number) => formatMoney(n, base.currency, locale);
  const num = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <section className="space-y-1 rounded-md border border-current/20 p-4">
        <h2 className="font-medium">{t('resultTitle')}</h2>
        <p className="text-lg">
          {result
            ? `${result.money > 0 ? '+' : ''}${money(result.money)}${
                result.bb != null ? ` · ${result.bb > 0 ? '+' : ''}${num(result.bb)} bb` : ''
              }`
            : t('resultNone')}
        </p>
        {rate != null && <p className="text-sm">{t('bbPerHour', { n: num(rate) })}</p>}
        <p className="text-sm opacity-70">
          {t('handsLine', { count: handCount, reviewed: reviewedCount })}
        </p>
        {breached && (
          <p role="alert" className="text-sm text-red-700">
            {t('stopLossBroken', { amount: money(base.stopLoss ?? 0) })}
          </p>
        )}
      </section>

      {isMtt ? (
        <fieldset className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            {t('prize')}
            <input
              name="prize"
              inputMode="decimal"
              value={v.prize}
              onChange={(e) => set('prize', e.target.value)}
              className={INPUT}
            />
            {err('prize')}
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {t('bounty')}
            <input
              name="bounty"
              inputMode="decimal"
              value={v.bounty}
              onChange={(e) => set('bounty', e.target.value)}
              className={INPUT}
            />
            {err('bounty')}
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {t('place')}
            <input
              name="place"
              inputMode="numeric"
              value={v.place}
              onChange={(e) => set('place', e.target.value)}
              className={INPUT}
            />
            {err('place')}
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {t('entries')}
            <input
              name="entries"
              inputMode="numeric"
              value={v.entries}
              onChange={(e) => set('entries', e.target.value)}
              className={INPUT}
            />
            {err('entries')}
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {t('reentries')}
            <input
              name="reentries"
              inputMode="numeric"
              value={v.reentries}
              onChange={(e) => set('reentries', e.target.value)}
              className={INPUT}
            />
            {err('reentries')}
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {t('bustStage')}
            <select
              name="bustStage"
              value={v.bustStage}
              onChange={(e) => set('bustStage', e.target.value)}
              className={INPUT}
            >
              <option value="">–</option>
              {BUST_STAGES.map((s) => (
                <option key={s} value={s}>
                  {t(`stage_${s}`)}
                </option>
              ))}
            </select>
            {err('bustStage')}
          </label>
        </fieldset>
      ) : (
        <label className="flex flex-col gap-1 text-sm">
          {t('cashout', { currency: base.currency })}
          <input
            name="cashout"
            inputMode="decimal"
            value={v.cashout}
            onChange={(e) => set('cashout', e.target.value)}
            className={INPUT}
          />
          {err('cashout')}
        </label>
      )}

      <div className="flex flex-col gap-2 rounded-md border border-current/20 p-3">
        <button
          type="button"
          onClick={callAi}
          disabled={run === 'busy' || outOfTurns || handCount === 0}
          className="h-12 rounded-md bg-foreground text-base font-medium text-background disabled:opacity-40"
        >
          {run === 'busy' ? t('aiRunning') : t('aiButton')}
        </button>
        <p className="text-sm">
          {ai.plan === 'byok'
            ? t('aiOwnKey')
            : ai.locked
              ? t('aiLocked')
              : t('aiLeft', { n: remaining ?? 0 })}
        </p>
        {draft && (
          <p role="status" className="text-sm">
            {t('aiFilled')}
          </p>
        )}
        {aiError && (
          <p role="alert" className="text-sm text-red-700">
            {tReview(`ai_${aiErrorCode(aiError)}`)}{' '}
            {(aiError === 'quota_exhausted' || aiError === 'budget_locked') && (
              <Link href="/settings" className="underline underline-offset-4">
                {tReview('aiUseOwnKey')}
              </Link>
            )}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm">
          {t('grade')}
          {aiMark(draft?.grade === v.grade)}
        </h3>
        <div className="grid grid-cols-4 gap-1.5">
          {GRADES.map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={v.grade === g}
              onClick={() => set('grade', v.grade === g ? '' : g)}
              className={chip(v.grade === g)}
            >
              {g}
            </button>
          ))}
        </div>
        <input type="hidden" name="grade" value={v.grade} />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm">{t('state')}</h3>
        <div className="grid grid-cols-3 gap-1.5">
          {SELF_STATES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={v.selfState === s}
              onClick={() => set('selfState', v.selfState === s ? '' : s)}
              className={chip(v.selfState === s)}
            >
              {t(`state_${s}`)}
            </button>
          ))}
        </div>
        <input type="hidden" name="selfState" value={v.selfState} />
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span>
          {t('good', { n: SUMMARY_LIMITS.good })}
          {aiMark(!!draft && v.good === lines(draft.good))}
        </span>
        <textarea
          name="good"
          rows={3}
          value={v.good}
          onChange={(e) => set('good', e.target.value)}
          className={AREA}
        />
      </label>

      <div className="space-y-2">
        <h3 className="text-sm">
          {t('leaks', { n: SUMMARY_LIMITS.leaks })}
          {aiMark(!!draft && v.leaks.join() === draft.leak_tags.join())}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {LEAK_TAGS.map((tag) => {
            const on = v.leaks.includes(tag);
            const hands = leakHints[tag];
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  set('leaks', on ? v.leaks.filter((x) => x !== tag) : [...v.leaks, tag])
                }
                className={chip(on)}
              >
                {tReview(`tag_${tag}`)}
                {hands ? ` · ${hands}` : ''}
              </button>
            );
          })}
        </div>
        {v.leaks.map((tag) => (
          <input key={tag} type="hidden" name="leaks" value={tag} />
        ))}
        <p className="text-xs opacity-70">{t('leakHint')}</p>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span>
          {t('rules', { n: SUMMARY_LIMITS.rules })}
          {aiMark(!!draft && v.rules === lines(draft.rules))}
        </span>
        <textarea
          name="rules"
          rows={4}
          value={v.rules}
          onChange={(e) => set('rules', e.target.value)}
          className={AREA}
        />
        <span className="text-xs opacity-70">{t('rulesHint')}</span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>
          {t('notes')}
          {aiMark(!!draft && v.notes === draft.notes)}
        </span>
        <textarea
          name="notes"
          rows={3}
          value={v.notes}
          onChange={(e) => set('notes', e.target.value)}
          className={AREA}
        />
      </label>

      {state.failed && (
        <p role="alert" className="text-sm text-red-700">
          {t('saveFailed')}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-14 rounded-md bg-foreground text-lg font-medium text-background disabled:opacity-40"
      >
        {pending ? t('saving') : t('save')}
      </button>
    </form>
  );
}
