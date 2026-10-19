'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import {
  act,
  edit as editAction,
  forcedBets,
  formatShorthand,
  isPostAct,
  parseAmount,
  parseShorthand,
  POSITIONS,
  replay,
  STREETS,
  toBb,
  undo as undoAction,
  type Action,
  type ActInput,
  type ButtonKind,
  type Card,
  type Position,
  type Street,
} from 'poker-core';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import type { SeatTone } from '@/components/ui/seat';
import {
  boardCards,
  canSave,
  deriveHand,
  emptyDraft,
  stripForced,
  toHandRow,
  type HandDraft,
  type HandSession,
  type PreviousHand,
} from '@/lib/hands/build';
import { boardInput, draftToSetup } from '@/lib/hands/setup';
import { applyShorthand } from '@/lib/hands/shorthand';
import { isOneOf } from '@/lib/sessions/form';
import { formatMoney } from '@/lib/sessions/format';
import { createClient } from '@/lib/supabase/client';
import { saveHand, undoHand } from '@/lib/offline/sync';
import { ActionPanel } from './action-panel';
import { AmountSheet, type AmountKind } from './amount-sheet';
import { CardGrid } from './card-grid';
import { EditActionSheet } from './edit-action-sheet';
import { HandSetupCard, type OpponentOption } from './hand-setup-card';
import { MiniTable } from './mini-table';
import { SaveBar } from './save-bar';
import { ShorthandInput } from './shorthand-input';
import { ShowdownBlock } from './showdown-block';
import { StreetBlock, type BoardPicker, type PillData } from './street-block';
import { UndoToast } from './undo-toast';

export type { OpponentOption };

/** Slots of the card grid that hold each street's cards. */
const BOARD_RANGE = { flop: [2, 5], turn: [5, 6], river: [6, 7] } as const;

type Props = {
  sessionId: string;
  session: HandSession & { currency: string };
  locale: string;
  lastNum: number;
  previous: PreviousHand | null;
  opponents: OpponentOption[];
  /** Last villain stack seen against each opponent. */
  opponentStacks?: Record<string, number>;
  entryMode: 'buttons' | 'shorthand';
  /** Set on the hand detail screen: update this hand instead of adding one. */
  edit?: { handId: string; num: number; initial: HandDraft };
  /** Onboarding practice (spec 3.2): nothing is saved; the button hands the draft back. */
  practice?: { label: string; onCheck: (draft: HandDraft) => void };
};

const toNumber = (raw: string): number | null => parseAmount(raw);

export function HandForm({
  sessionId,
  session,
  locale,
  lastNum,
  previous,
  opponents,
  opponentStacks = {},
  entryMode,
  edit,
  practice,
}: Props) {
  const t = useTranslations('hand');
  const tr = useTranslations('record');
  const router = useRouter();
  const [raw, setDraft] = useState<HandDraft>(() => {
    const initial = edit?.initial ?? emptyDraft(session, previous);
    // A hand saved before DEC-045 is read and edited as a shorthand line.
    return initial.legacy && !initial.rawLine
      ? { ...initial, rawLine: formatShorthand(initial.actions, boardCards(initial) as Card[]) }
      : initial;
  });
  const [mode, setMode] = useState<'buttons' | 'shorthand'>(
    edit ? (edit.initial.legacy || edit.initial.rawLine ? 'shorthand' : 'buttons') : entryMode,
  );
  const [step, setStep] = useState<'setup' | 'play'>(edit ? 'play' : 'setup');
  const [switchBlocked, setSwitchBlocked] = useState(false);
  const [num, setNum] = useState(edit?.num ?? lastNum + 1);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [undo, setUndo] = useState<{ id: string; num: number; snapshot: HandDraft } | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [undoFailed, setUndoFailed] = useState(false);
  const [sheet, setSheet] = useState<AmountKind | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [seatPick, setSeatPick] = useState<Position | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
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
  const bb = derived.bb;
  const money = (n: number) => formatMoney(n, session.currency, locale);
  const both = (n: number) => (bb ? `${money(n)} (${toBb(n, bb)}bb)` : money(n));

  const setup = useMemo(
    () => (bb != null && !draft.legacy ? draftToSetup(session, draft, bb) : null),
    [session, draft, bb],
  );
  const full = useMemo(
    () => (setup ? [...forcedBets(setup), ...draft.actions] : []),
    [setup, draft],
  );
  const board = useMemo(() => boardInput(draft), [draft]);
  const machine = derived.machine;
  const view = useMemo(
    () => (seatPick && setup ? replay(setup, full, board, [seatPick]) : machine),
    [seatPick, setup, full, board, machine],
  );
  const dealt = Number(draft.playersDealt.trim());
  const seatCount =
    setup?.seats ?? (Number.isInteger(dealt) && dealt >= 2 ? dealt : (session.seats ?? 9));
  const buttonsMode = mode === 'buttons' && setup !== null;
  const decided = Boolean(machine) && derived.outcome !== '' && derived.outcome !== draft.outcome;

  function switchMode(next: 'buttons' | 'shorthand') {
    if (next === mode) return;
    if (next === 'shorthand') {
      const line = formatShorthand(draft.actions, boardCards(draft) as Card[]);
      setDraft({ ...raw, rawLine: line });
    } else {
      const candidate = { ...raw, slots: draft.slots, actions: draft.actions, rawLine: '' };
      const check = deriveHand(session, candidate).machine;
      if (lineErrors.length > 0 || (check && check.invalid.length > 0)) {
        setSwitchBlocked(true);
        return;
      }
      setDraft(candidate);
    }
    setSwitchBlocked(false);
    setMode(next);
  }

  function setPositions(heroPos: string, villPos: string) {
    setDraft((d) => ({ ...d, heroPos, villPos, actions: [], boardSkipped: [] }));
    setSeatPick(null);
  }

  // ---- entering actions (the state machine decides everything) ----
  function apply(input: ActInput): boolean {
    if (!setup) return false;
    const r = act(setup, full, seatPick ? { seat: seatPick, ...input } : input, board);
    if (!r.accepted) {
      const stackUnknown = r.notices.some((n) => n.code === 'stack_unknown');
      setNotes([stackUnknown ? tr('stackUnknown') : tr('refused')]);
      return false;
    }
    setDraft((d) => ({ ...d, actions: stripForced(r.actions) }));
    setNotes(
      r.notices.flatMap((n) =>
        n.code === 'below_min_raise'
          ? [tr('warnBelowMin')]
          : n.code === 'auto_all_in'
            ? [tr('warnAutoAllIn')]
            : [],
      ),
    );
    setSeatPick(null);
    return true;
  }

  function onButton(kind: ButtonKind) {
    if (kind === 'open' || kind === 'bet' || kind === 'raise') return setSheet(kind);
    if (kind === 'all-in') {
      const toAct = view?.phase.kind === 'act' ? view.phase.toAct : null;
      const stack = view?.players.find((p) => p.pos === toAct)?.stack;
      return stack === undefined ? setSheet('all-in') : void apply({ act: 'all-in' });
    }
    apply({ act: kind });
  }

  function onAmount(kind: AmountKind, to: number, seat?: Position) {
    const ok =
      kind === 'dead'
        ? apply({ act: 'dead', to, ...(seat && { seat }) })
        : apply({ act: kind, to });
    if (ok) setSheet(null);
  }

  const editState = useMemo(
    () => (setup && editing !== null ? replay(setup, full.slice(0, editing), board) : null),
    [setup, editing, full, board],
  );

  function applyEdit(input: ActInput) {
    if (!setup || editing === null) return;
    const r = editAction(setup, full, editing, input, board);
    if (!r.accepted) return setNotes([tr('refused')]);
    setDraft((d) => ({ ...d, actions: stripForced(r.actions) }));
    setNotes([]);
    setEditing(null);
  }

  function setBoard(street: 'flop' | 'turn' | 'river', next: string[]) {
    const [a, b] = BOARD_RANGE[street];
    set('slots', [...draft.slots.slice(0, a), ...next, ...draft.slots.slice(b)]);
  }

  const toneOf = (a: Action['actor']): SeatTone => a;
  const whoOf = (a: Action) =>
    a.actor === 'hero'
      ? tr('roleHero')
      : a.actor === 'villain'
        ? tr('roleVillain')
        : (a.pos ?? '?');
  const whatOf = (a: Action) =>
    a.act === 'raise' && a.verb === 'open' ? tr('act_open') : t(`act_${a.act}`);

  function pillsOf(street: Street): PillData[] {
    if (!view) return [];
    return full.flatMap((a, index) => {
      if (a.street !== street || isPostAct(a.act)) return [];
      const shown = view.actions[index] ?? a;
      const amountBb =
        shown.amount !== undefined && shown.act !== 'fold' && shown.act !== 'check' && bb
          ? `${toBb(shown.amount, bb)}bb`
          : undefined;
      return [
        {
          index,
          tone: toneOf(a.actor),
          who: whoOf(a),
          what: whatOf(shown),
          ...(amountBb && { amount: amountBb }),
          invalid: view.invalid.includes(index),
        },
      ];
    });
  }

  function boardPicker(street: 'flop' | 'turn' | 'river'): BoardPicker {
    const [a, b] = BOARD_RANGE[street];
    return {
      slots: draft.slots.slice(a, b),
      labels: Array.from({ length: b - a }, () => t(street)),
      blocked: [...draft.slots.slice(0, a), ...draft.slots.slice(b), ...draft.villCards],
      onChange: (next) => setBoard(street, next),
      skipped: draft.boardSkipped.includes(street),
      onToggleSkip: () =>
        set(
          'boardSkipped',
          draft.boardSkipped.includes(street)
            ? draft.boardSkipped.filter((s) => s !== street)
            : [...draft.boardSkipped, street],
        ),
    };
  }

  // Streets shown: up to the last one with actions, or the one the hand has reached.
  const reached = useMemo(() => {
    if (!view) return 0;
    const lastAction = Math.max(0, ...draft.actions.map((a) => STREETS.indexOf(a.street)));
    const p = view.phase;
    const now =
      p.kind === 'act' || p.kind === 'board'
        ? STREETS.indexOf(p.street)
        : p.kind === 'runout' || p.kind === 'showdown'
          ? 3
          : 0;
    return Math.max(lastAction, now);
  }, [view, draft.actions]);

  // ---- saving ----
  const heroBehind = view?.players.find((p) => p.actor === 'hero')?.behind;
  const stackNow = heroBehind ?? toNumber(draft.heroStack);
  const potNow = buttonsMode ? (view?.pot ?? null) : mode === 'shorthand' ? derived.potFinal : null;
  const hint = !canSave(draft)
    ? t('needCards')
    : lineErrors.length > 0
      ? t('fixLineToSave')
      : derived.missing
        ? t('willBeMissing')
        : undefined;

  async function save() {
    if (locked.current || !canSave(draft) || lineErrors.length > 0) return;
    if (practice) {
      practice.onCheck(draft);
      return;
    }
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
      hero_pos: draft.heroPos,
      villain_pos: draft.villPos,
      stage: draft.stage,
      straddles: draft.straddles
        .map((s) => toNumber(s))
        .filter((n): n is number => n != null && n > 0),
    };
    setDraft(emptyDraft(session, prev));
    setStep('setup');
    setNotes([]);
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

  // ---- screens ----
  const warnings: string[] = [
    ...notes,
    ...(view?.warnings.some((w) => w.code === 'below_min_raise') ? [tr('warnBelowMin')] : []),
    ...(view?.warnings.some((w) => w.code === 'side_pot') ? [tr('warnSidePot')] : []),
    ...(draft.boardSkipped.length > 0 ? [tr('warnBoardSkipped')] : []),
  ].filter((w, i, all) => all.indexOf(w) === i);

  const showSetup = step === 'setup' || (mode === 'buttons' && !setup);
  const toActPos = view?.phase.kind === 'act' ? view.phase.toAct : null;
  const toActActor = view?.players.find((p) => p.pos === toActPos)?.actor;
  const toActWho =
    toActActor === 'hero' ? tr('roleHero') : toActActor === 'villain' ? tr('roleVillain') : '';
  const callText = view ? both(view.toCall) : '';
  const deadSeats = (view?.players ?? []).filter((p) => !p.tracked).map((p) => p.pos);
  const showShowdown =
    mode === 'shorthand' ||
    (view !== null && (['runout', 'showdown', 'won'].includes(view.phase.kind) || decided));

  return (
    <div className="flex flex-col gap-4">
      {status === 'saved' && edit && (
        <p role="status" className="rounded-md bg-accent/15 p-3 text-sm">
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
        <p role="alert" className="rounded-md bg-loss/10 p-3 text-sm text-loss">
          {offline ? t('needNetwork') : t('saveFailed')}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t('title', { num })}</h2>
        {!(edit && edit.initial.legacy) && (
          <div className="flex gap-1.5" role="group" aria-label={t('actions')}>
            {(['buttons', 'shorthand'] as const).map((m) => (
              <Chip key={m} on={mode === m} onClick={() => switchMode(m)}>
                {tr(m === 'buttons' ? 'modeActions' : 'modeShorthand')}
              </Chip>
            ))}
          </div>
        )}
      </div>
      {edit?.initial.legacy && <p className="text-sm text-muted">{tr('oldHand')}</p>}
      {switchBlocked && (
        <p role="alert" className="text-sm text-loss">
          {t('fixLineFirst')}
        </p>
      )}

      {showSetup ? (
        <HandSetupCard
          session={session}
          draft={draft}
          seats={seatCount}
          opponents={opponents}
          opponentStacks={opponentStacks}
          set={set}
          onPositions={setPositions}
          canStart={mode === 'shorthand' || setup !== null}
          onStart={() => setStep('play')}
          startLabel={tr('start')}
        />
      ) : (
        <>
          <Button
            variant="secondary"
            className="h-auto min-h-11 justify-between gap-3 py-2 text-left text-sm"
            onClick={() => setStep('setup')}
          >
            <span className="tabular-nums">
              {draft.heroPos && `${draft.heroPos} ${tr('roleHero')}`}
              {draft.villPos && ` · ${draft.villPos} ${tr('roleVillain')}`}
              {draft.heroStack && ` · ${draft.heroStack}`}
              {draft.straddles.length > 0 && ` · ${tr('straddle')} ${draft.straddles.join('/')}`}
            </span>
            <span className="text-muted underline underline-offset-4">{tr('editSetup')}</span>
          </Button>

          {buttonsMode && view ? (
            <>
              <MiniTable
                compact
                seats={seatCount}
                onSeat={(pos) => {
                  if (view.addable.includes(pos)) setSeatPick(seatPick === pos ? null : pos);
                }}
                view={(pos) => {
                  const p = view.players.find((x) => x.pos === pos);
                  const addable = view.addable.includes(pos);
                  return {
                    tone: p ? toneOf(p.actor) : 'other',
                    ...(p?.actor === 'hero' && { caption: tr('roleHero') }),
                    ...(p?.actor === 'villain' && { caption: tr('roleVillain') }),
                    toAct: toActPos === pos,
                    folded: Boolean(p?.folded) || (p ? !p.tracked && !addable : false),
                    addable,
                    disabled: !addable,
                  };
                }}
              />
              {STREETS.slice(0, reached + 1).map((street) => (
                <StreetBlock
                  key={street}
                  street={street}
                  pills={pillsOf(street)}
                  needsBoard={view.phase.kind === 'board' && view.phase.street === street}
                  {...(street !== 'preflop' && { board: boardPicker(street) })}
                  onPill={setEditing}
                />
              ))}
              {warnings.length > 0 && (
                <ul role="status" className="space-y-1 rounded-md bg-warn/10 p-3 text-sm">
                  {warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}
              <ActionPanel
                state={view}
                who={seatPick ? tr('addSeat') : toActWho}
                toCallText={callText}
                canUndo={draft.actions.length > 0}
                onButton={onButton}
                onDead={() => setSheet('dead')}
                onUndo={() => {
                  if (!setup) return;
                  set('actions', stripForced(undoAction(full)));
                  setSeatPick(null);
                  setNotes([]);
                }}
              />
            </>
          ) : (
            <section className="space-y-3">
              <h3 className="text-base font-medium">{t('board')}</h3>
              <CardGrid
                ariaLabel={t('board')}
                labels={[t('flop'), t('flop'), t('flop'), t('turn'), t('river')]}
                slots={draft.slots.slice(2)}
                blocked={[...draft.slots.slice(0, 2), ...draft.villCards]}
                onChange={(next) => set('slots', [...draft.slots.slice(0, 2), ...next])}
              />
              <ShorthandInput
                value={raw.rawLine}
                onChange={(rawLine) => set('rawLine', rawLine)}
                errors={lineErrors}
              />
            </section>
          )}

          {showShowdown && (
            <ShowdownBlock
              draft={draft}
              set={set}
              outcome={derived.outcome}
              decided={decided}
              mode={buttonsMode ? 'actions' : 'shorthand'}
              result={derived.result}
              resultBb={derived.resultBb}
              money={money}
            />
          )}

          <section className="space-y-2">
            <label className="flex flex-col gap-1 text-sm">
              {t('thought')}
              <Input
                autoComplete="off"
                value={draft.thought}
                onChange={(e) => set('thought', e.target.value)}
              />
            </label>
            <Chip on={draft.flagged} onClick={() => set('flagged', !draft.flagged)}>
              ⚑ {t('flag')}
            </Chip>
          </section>
        </>
      )}

      <SaveBar
        sticky={!edit}
        pot={potNow == null ? null : both(potNow)}
        stack={stackNow == null ? null : both(stackNow)}
        label={
          practice
            ? practice.label
            : status === 'saving'
              ? t('saving')
              : edit
                ? t('saveChanges')
                : t('save')
        }
        disabled={!canSave(draft) || lineErrors.length > 0 || status === 'saving'}
        {...(hint && { hint })}
        onSave={save}
      />

      {view && (
        <AmountSheet
          kind={sheet}
          state={view}
          bb={bb ?? 1}
          money={money}
          deadSeats={deadSeats}
          onConfirm={onAmount}
          onClose={() => setSheet(null)}
        />
      )}
      <EditActionSheet
        action={editing !== null ? (view?.actions[editing] ?? null) : null}
        before={editState}
        onApply={applyEdit}
        onDeleteFrom={() => {
          if (editing === null) return;
          set('actions', stripForced(full.slice(0, editing)));
          setEditing(null);
        }}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}
