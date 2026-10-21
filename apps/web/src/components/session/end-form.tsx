'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useActionState, useMemo, useState } from 'react';
import { bbPerHour, sessionResult, stopLossBreached, type StatsSession } from 'poker-core';
import { endSession, type EndSessionState } from '@/app/(app)/sessions/[id]/end/actions';
import { buttonClass } from '@/components/ui/button';
import { chipClass as chip } from '@/components/ui/chip';
import { INPUT_CLASS as INPUT } from '@/components/ui/input';
import { formatMoney } from '@/lib/sessions/format';
import {
  applyFormToStats,
  BUST_STAGES,
  SELF_STATES,
  type SummaryFormValues,
} from '@/lib/sessions/summary';

type Props = {
  sessionId: string;
  /** The saved session; typed-but-unsaved values are applied on top for the live result. */
  base: StatsSession;
  initial: SummaryFormValues;
  handCount: number;
  /** End time to save (a session left open); null = now, or already ended. */
  endAt?: string | null;
};

/** Leaving the table (DEC-044): cash-out or MTT result, and how you felt. Ten seconds, no essay. */
export function EndForm({ sessionId, base, initial, handCount, endAt = null }: Props) {
  const t = useTranslations('summary');
  const tSessions = useTranslations('sessions');
  const locale = useLocale();
  const [state, formAction, pending] = useActionState<EndSessionState, FormData>(
    endSession.bind(null, sessionId),
    { values: initial, errors: {}, failed: false },
  );
  const [v, setV] = useState<SummaryFormValues>(state.values);
  const set = <K extends keyof SummaryFormValues>(key: K, value: SummaryFormValues[K]) =>
    setV((x) => ({ ...x, [key]: value }));

  const live = useMemo(() => applyFormToStats(base, v), [base, v]);
  const result = sessionResult(live);
  const rate = bbPerHour(live);
  const breached = stopLossBreached(live);
  const isMtt = base.kind === 'mtt';
  const err = (field: keyof SummaryFormValues) =>
    state.errors[field] ? (
      <span role="alert" className="text-sm text-loss">
        {t(`error_${state.errors[field]}`)}
      </span>
    ) : null;

  const money = (n: number) => formatMoney(n, base.currency, locale);
  const num = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n);

  const field = (name: 'prize' | 'bounty' | 'place' | 'entries' | 'reentries', numeric = false) => (
    <label className="flex flex-col gap-1 text-sm">
      {t(name)}
      <input
        name={name}
        inputMode={numeric ? 'numeric' : 'decimal'}
        autoComplete="off"
        value={v[name]}
        onChange={(e) => set(name, e.target.value)}
        className={INPUT}
      />
      {err(name)}
    </label>
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {endAt && <input type="hidden" name="end_at" value={endAt} />}
      <section className="space-y-1 rounded-md border border-line bg-surface p-4">
        <h2 className="font-medium">{t('resultTitle')}</h2>
        <p className="text-lg">
          {result
            ? `${result.money > 0 ? '+' : ''}${money(result.money)}${
                result.bb != null ? ` · ${result.bb > 0 ? '+' : ''}${num(result.bb)} bb` : ''
              }`
            : t('resultNone')}
        </p>
        {isMtt && live.buyin != null && (
          <p className="text-sm text-muted">
            {t('mttCost', {
              entries: 1 + (live.mtt?.reentries ?? 0),
              cost: money(live.buyin * (1 + (live.mtt?.reentries ?? 0))),
            })}
          </p>
        )}
        {rate != null && <p className="text-sm">{t('bbPerHour', { n: num(rate) })}</p>}
        <p className="text-sm text-muted">{tSessions('handsOnly', { count: handCount })}</p>
        {breached && (
          <p role="alert" className="text-sm text-loss">
            {t('stopLossBroken', { amount: money(base.stopLoss ?? 0) })}
          </p>
        )}
      </section>

      {isMtt ? (
        <fieldset className="grid grid-cols-2 gap-3">
          {field('prize')}
          {field('bounty')}
          {field('place', true)}
          {field('entries', true)}
          {field('reentries', true)}
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
            autoComplete="off"
            value={v.cashout}
            onChange={(e) => set('cashout', e.target.value)}
            className={INPUT}
          />
          {err('cashout')}
        </label>
      )}

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

      {state.failed && (
        <p role="alert" className="text-sm text-loss">
          {t('saveFailed')}
        </p>
      )}
      <button type="submit" disabled={pending} className={buttonClass({ size: 'lg' })}>
        {pending ? tSessions('ending') : tSessions('endSave')}
      </button>
    </form>
  );
}
