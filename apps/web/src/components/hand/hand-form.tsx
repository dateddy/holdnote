'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { formatShorthand, parseAmount, parseShorthand, POSITIONS, type Card } from 'poker-core';
import {
  boardCards,
  canSave,
  deriveHand,
  emptyDraft,
  levelAnte,
  OUTCOMES,
  toHandRow,
  type HandDraft,
  type HandSession,
  type PreviousHand,
} from '@/lib/hands/build';
import { applyShorthand } from '@/lib/hands/shorthand';
import { isOneOf } from '@/lib/sessions/form';
import { formatMoney } from '@/lib/sessions/format';
import { createClient } from '@/lib/supabase/client';
import { saveHand, undoHand } from '@/lib/offline/sync';
import { ActionRows } from './action-rows';
import { CardGrid } from './card-grid';
import { ShorthandInput } from './shorthand-input';
import { UndoToast } from './undo-toast';

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
  entryMode: 'buttons' | 'shorthand';
  /** Set on the hand detail screen: update this hand instead of adding one. */
  edit?: { handId: string; num: number; initial: HandDraft };
};

export function HandForm({
  sessionId,
  session,
  locale,
  lastNum,
  previous,
  opponents,
  entryMode,
  edit,
}: Props) {
  const t = useTranslations('hand');
  const router = useRouter();
  const [raw, setDraft] = useState<HandDraft>(() => edit?.initial ?? emptyDraft(session, previous));
  const [mode, setMode] = useState<'buttons' | 'shorthand'>(
    edit ? (edit.initial.rawLine ? 'shorthand' : 'buttons') : entryMode,
  );
  const [switchBlocked, setSwitchBlocked] = useState(false);
  const [num, setNum] = useState(edit?.num ?? lastNum + 1);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [undo, setUndo] = useState<{ id: string; num: number; snapshot: HandDraft } | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [undoFailed, setUndoFailed] = useState(false);
  const locked = useRef(false);

  const set = <K extends keyof HandDraft>(key: K, value: HandDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  // In shorthand mode the line is the source of truth; actions and board come from parsing it.
  const parsed = useMemo(
    () =>
      mode === 'shorthand'
        ? parseShorthand(raw.rawLine, {
            ...(isOneOf(POSITIONS, raw.heroPos) && { heroPos: raw.heroPos }),
            ...(isOneOf(POSITIONS, raw.villPos) && { villPos: raw.villPos }),
          })
        : null,
    [mode, raw.rawLine, raw.heroPos, raw.villPos],
  );
  const draft = useMemo(
    () => (parsed ? applyShorthand(raw, parsed) : { ...raw, rawLine: '' }),
    [raw, parsed],
  );
  const lineErrors = parsed?.errors ?? [];
  const derived = useMemo(() => deriveHand(session, draft), [session, draft]);

  function switchMode(next: 'buttons' | 'shorthand') {
    if (next === mode) return;
    if (next === 'shorthand') {
      const line = formatShorthand(draft.actions, boardCards(draft) as Card[]);
      setDraft({ ...raw, rawLine: line });
    } else {
      if (lineErrors.length > 0) {
        setSwitchBlocked(true);
        return;
      }
      setDraft({ ...raw, slots: draft.slots, actions: draft.actions, rawLine: '' });
    }
    setSwitchBlocked(false);
    setMode(next);
  }
  const isMtt = session.kind === 'mtt';
  const money = (n: number) => formatMoney(n, session.currency, locale);

  async function save() {
    if (locked.current || !canSave(draft) || lineErrors.length > 0) return;
    locked.current = true;
    setStatus('saving');
    if (edit) {
      const supabase = createClient();
      const row: Partial<ReturnType<typeof toHandRow>> = toHandRow(session, draft, edit.num);
      delete row.num;
      const { error, status: http } = await supabase
        .from('hands')
        .update(row)
        .eq('id', edit.handId);
      locked.current = false;
      setOffline(Boolean(error) && !http);
      setStatus(error ? 'failed' : 'saved');
      if (!error) router.refresh();
      return;
    }

    // Store on this device first; the queue sends it as soon as the network allows.
    const before = raw;
    try {
      const item = await saveHand({ sessionId, row: toHandRow(session, draft, num) });
      setUndo({ id: item.id, num, snapshot: before });
      setUndoBusy(false);
      setUndoFailed(false);
    } catch {
      setStatus('failed');
      locked.current = false;
      return;
    }

    const prev: PreviousHand = {
      hero_stack: toNumber(draft.heroStack),
      result: derived.result,
      level_bb: toNumber(draft.levelBb),
      players_dealt: toNumber(draft.playersDealt),
      ante: toNumber(draft.ante),
    };
    setDraft({ ...emptyDraft(session, prev), heroPos: draft.heroPos });
    setNum(num + 1);
    setStatus('idle');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // The save button stays locked for 2 seconds (spec 3.5).
    setTimeout(() => {
      locked.current = false;
    }, 2000);
  }

  async function undoLast() {
    if (!undo) return;
    setUndoBusy(true);
    try {
      await undoHand(undo.id);
      setDraft(undo.snapshot);
      setNum(undo.num);
      setUndo(null);
    } catch {
      setUndoFailed(true);
      setUndoBusy(false);
    }
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
      {status === 'saved' && edit && (
        <p role="status" className="rounded-md bg-foreground/10 p-3 text-sm">
          {t('savedChanges')}
        </p>
      )}
      {undo && (
        <UndoToast
          num={undo.num}
          busy={undoBusy}
          failed={undoFailed}
          onUndo={undoLast}
          onExpire={() => setUndo(null)}
        />
      )}
      {status === 'failed' && (
        <p role="alert" className="rounded-md bg-red-600/10 p-3 text-sm text-red-700">
          {offline ? t('needNetwork') : t('saveFailed')}
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
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-medium">{t('actions')}</h3>
          <div className="flex gap-1" role="group" aria-label={t('actions')}>
            {(['buttons', 'shorthand'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => switchMode(m)}
                className={`${chip(mode === m)} h-9`}
              >
                {t(m === 'buttons' ? 'modeButtons' : 'modeShorthand')}
              </button>
            ))}
          </div>
        </div>
        {mode === 'shorthand' ? (
          <>
            <ShorthandInput
              value={raw.rawLine}
              onChange={(rawLine) => set('rawLine', rawLine)}
              errors={lineErrors}
            />
            {switchBlocked && (
              <p role="alert" className="text-sm text-red-700">
                {t('fixLineFirst')}
              </p>
            )}
          </>
        ) : (
          <ActionRows
            actions={draft.actions}
            onChange={(actions) => setDraft((d) => ({ ...d, actions }))}
            input={derived.input}
            heroPos={draft.heroPos}
            villPos={draft.villPos}
            boardCount={boardCards(draft).length}
            money={money}
          />
        )}
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
          {levelAnte(session) === 'typed' && (
            <label className="flex flex-col gap-1 text-sm">
              {t('levelAnte')}
              <input
                inputMode="decimal"
                autoComplete="off"
                value={draft.ante}
                onChange={(e) => set('ante', e.target.value)}
                className={INPUT}
              />
            </label>
          )}
          {levelAnte(session) === 'bb' && (
            <p className="col-span-2 text-sm opacity-70">{t('anteIsBb')}</p>
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
        disabled={!canSave(draft) || lineErrors.length > 0 || status === 'saving'}
        className="h-14 rounded-md bg-foreground text-lg font-medium text-background disabled:opacity-40"
      >
        {status === 'saving' ? t('saving') : edit ? t('saveChanges') : t('save')}
      </button>
      {lineErrors.length > 0 && <p className="text-sm opacity-70">{t('fixLineToSave')}</p>}
      {!canSave(draft) && <p className="text-sm opacity-70">{t('needCards')}</p>}
      {canSave(draft) && derived.missing && (
        <p className="text-sm opacity-70">{t('willBeMissing')}</p>
      )}
    </div>
  );
}

const toNumber = (raw: string): number | null => parseAmount(raw);
