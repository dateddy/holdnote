'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useRef, useState } from 'react';
import { parseAmount, POSITIONS } from 'poker-core';
import {
  boardCards,
  canSave,
  deriveHand,
  emptyDraft,
  OUTCOMES,
  toHandRow,
  type HandDraft,
  type HandSession,
  type PreviousHand,
} from '@/lib/hands/build';
import { formatMoney } from '@/lib/sessions/format';
import { createClient } from '@/lib/supabase/client';
import { ActionRows } from './action-rows';
import { CardGrid } from './card-grid';

export type OpponentOption = { id: string; name: string };

const INPUT = 'h-12 w-full rounded-md border border-current/20 bg-transparent px-3 text-base';
const chip = (on: boolean) =>
  `flex h-11 items-center justify-center rounded-md border px-3 text-sm ${
    on ? 'border-foreground bg-foreground text-background' : 'border-current/20'
  }`;

type Props = {
  sessionId: string;
  session: HandSession & { currency: string };
  locale: string;
  lastNum: number;
  previous: PreviousHand | null;
  opponents: OpponentOption[];
};

export function HandForm({ sessionId, session, locale, lastNum, previous, opponents }: Props) {
  const t = useTranslations('hand');
  const [draft, setDraft] = useState<HandDraft>(() => emptyDraft(session, previous));
  const [num, setNum] = useState(lastNum + 1);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [savedNum, setSavedNum] = useState<number | null>(null);
  const locked = useRef(false);

  const set = <K extends keyof HandDraft>(key: K, value: HandDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const derived = useMemo(() => deriveHand(session, draft), [session, draft]);
  const isMtt = session.kind === 'mtt';
  const money = (n: number) => formatMoney(n, session.currency, locale);

  async function save() {
    if (locked.current || !canSave(draft)) return;
    locked.current = true;
    setStatus('saving');
    const supabase = createClient();
    let target = num;
    let error = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      ({ error } = await supabase
        .from('hands')
        .insert({ ...toHandRow(session, draft, target), session_id: sessionId }));
      if (!error || error.code !== '23505') break;
      // Another tab took this number: read the latest and retry once.
      const { data } = await supabase
        .from('hands')
        .select('num')
        .eq('session_id', sessionId)
        .order('num', { ascending: false })
        .limit(1)
        .maybeSingle();
      target = (data?.num ?? target) + 1;
    }

    if (error) {
      setStatus('failed');
      locked.current = false;
      return;
    }

    const prev: PreviousHand = {
      hero_stack: toNumber(draft.heroStack),
      result: derived.result,
      level_bb: toNumber(draft.levelBb),
      players_dealt: toNumber(draft.playersDealt),
    };
    setDraft({ ...emptyDraft(session, prev), heroPos: draft.heroPos });
    setSavedNum(target);
    setNum(target + 1);
    setStatus('saved');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // The save button stays locked for 2 seconds (spec 3.5).
    setTimeout(() => {
      locked.current = false;
    }, 2000);
  }

  const posRow = (field: 'heroPos' | 'villPos') => (
    <div className="flex flex-wrap gap-1.5">
      {POSITIONS.map((p) => (
        <button
          key={p}
          type="button"
          aria-pressed={draft[field] === p}
          onClick={() => set(field, draft[field] === p ? '' : p)}
          className={chip(draft[field] === p)}
        >
          {p}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {status === 'saved' && savedNum !== null && (
        <p role="status" className="rounded-md bg-foreground/10 p-3 text-sm">
          {t('saved', { num: savedNum })}
        </p>
      )}
      {status === 'failed' && (
        <p role="alert" className="rounded-md bg-red-600/10 p-3 text-sm text-red-700">
          {t('saveFailed')}
        </p>
      )}

      <h2 className="text-lg font-semibold">{t('title', { num })}</h2>

      <section className="space-y-2">
        <h3 className="font-medium">{t('cards')}</h3>
        <CardGrid slots={draft.slots} onChange={(slots) => set('slots', slots)} />
      </section>

      <section className="space-y-2">
        <h3 className="font-medium">{t('heroPos')}</h3>
        {posRow('heroPos')}
        <h3 className="pt-2 font-medium">{t('villPos')}</h3>
        {posRow('villPos')}
        {opponents.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {opponents.map((o) => (
              <button
                key={o.id}
                type="button"
                aria-pressed={draft.opponentId === o.id}
                onClick={() => set('opponentId', draft.opponentId === o.id ? '' : o.id)}
                className={chip(draft.opponentId === o.id)}
              >
                {o.name}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="font-medium">{t('actions')}</h3>
        <ActionRows
          actions={draft.actions}
          onChange={(actions) => setDraft((d) => ({ ...d, actions }))}
          input={derived.input}
          heroPos={draft.heroPos}
          villPos={draft.villPos}
          boardCount={boardCards(draft).length}
          money={money}
        />
      </section>

      <section className="space-y-2">
        <h3 className="font-medium">{t('outcome')}</h3>
        <div className="grid grid-cols-4 gap-1.5">
          {OUTCOMES.map((o) => (
            <button
              key={o}
              type="button"
              aria-pressed={draft.outcome === o}
              onClick={() => set('outcome', draft.outcome === o ? '' : o)}
              className={chip(draft.outcome === o)}
            >
              {t(`outcome_${o}`)}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1 text-sm">
          {t('result')}
          <input
            inputMode="decimal"
            autoComplete="off"
            value={draft.resultText}
            placeholder={derived.result == null ? '' : String(derived.result)}
            onChange={(e) => set('resultText', e.target.value)}
            className={INPUT}
          />
        </label>
        {draft.outcome && draft.outcome !== 'fold' && (
          <div className="space-y-1">
            <p className="text-sm">{t('villCards')}</p>
            <CardGrid
              slots={[...draft.villCards, '', '', '', '', '']}
              onChange={(slots) => set('villCards', slots.slice(0, 2))}
            />
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="font-medium">{t('stacks')}</h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            {t('heroStack')}
            <input
              inputMode="decimal"
              autoComplete="off"
              value={draft.heroStack}
              onChange={(e) => set('heroStack', e.target.value)}
              className={INPUT}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {t('villStack')}
            <input
              inputMode="decimal"
              autoComplete="off"
              value={draft.villStack}
              onChange={(e) => set('villStack', e.target.value)}
              className={INPUT}
            />
          </label>
          {isMtt && (
            <label className="flex flex-col gap-1 text-sm">
              {t('levelBb')}
              <input
                inputMode="decimal"
                autoComplete="off"
                value={draft.levelBb}
                onChange={(e) => set('levelBb', e.target.value)}
                className={INPUT}
              />
            </label>
          )}
          {session.ante_mode === 'each' && (
            <label className="flex flex-col gap-1 text-sm">
              {t('playersDealt')}
              <input
                inputMode="numeric"
                autoComplete="off"
                value={draft.playersDealt}
                onChange={(e) => set('playersDealt', e.target.value)}
                className={INPUT}
              />
            </label>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-1 text-sm">
          <dt className="opacity-70">{t('eff')}</dt>
          <dd>{derived.eff ? `${money(derived.eff.amount)} (${derived.eff.bb} bb)` : '–'}</dd>
          {derived.spr.map((s) => (
            <div key={s.street} className="contents">
              <dt className="opacity-70">{t('spr', { street: t(`street_${s.street}`) })}</dt>
              <dd>{s.spr}</dd>
            </div>
          ))}
          <dt className="opacity-70">{t('pot')}</dt>
          <dd>{derived.potFinal == null ? '–' : money(derived.potFinal)}</dd>
          <dt className="opacity-70">{t('result')}</dt>
          <dd>
            {derived.result == null
              ? '–'
              : `${money(derived.result)}${derived.resultBb == null ? '' : ` (${derived.resultBb} bb)`}`}
          </dd>
        </dl>
      </section>

      <section className="space-y-2">
        <label className="flex flex-col gap-1 text-sm">
          {t('thought')}
          <input
            autoComplete="off"
            value={draft.thought}
            onChange={(e) => set('thought', e.target.value)}
            className={INPUT}
          />
        </label>
        <button
          type="button"
          aria-pressed={draft.flagged}
          onClick={() => set('flagged', !draft.flagged)}
          className={chip(draft.flagged)}
        >
          ⚑ {t('flag')}
        </button>
      </section>

      <button
        type="button"
        onClick={save}
        disabled={!canSave(draft) || status === 'saving'}
        className="h-14 rounded-md bg-foreground text-lg font-medium text-background disabled:opacity-40"
      >
        {status === 'saving' ? t('saving') : t('save')}
      </button>
      {!canSave(draft) && <p className="text-sm opacity-70">{t('needCards')}</p>}
      {canSave(draft) && derived.missing && (
        <p className="text-sm opacity-70">{t('willBeMissing')}</p>
      )}
    </div>
  );
}

const toNumber = (raw: string): number | null => parseAmount(raw);
