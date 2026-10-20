'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  act,
  edit as editAction,
  forcedBets,
  formatShorthand,
  isPostAct,
  parseAmount,
  parseShorthand,
  POSITIONS,
  reachedStreet,
  replay,
  streetTabs,
  toBb,
  undo as undoAction,
  type Action,
  type ActInput,
  type ButtonKind,
  type Card,
  type Position,
  type Street,
} from 'poker-core';
import { Card as Panel } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import type { SeatTone } from '@/components/ui/seat';
import {
  boardCards,
  canSave,
  deriveHand,
  emptyDraft,
  pickedOpponents,
  stripForced,
  toHandRow,
  type HandDraft,
  type HandSession,
  type PreviousHand,
} from '@/lib/hands/build';
import { boardInput, draftToSetup } from '@/lib/hands/setup';
import { applyShorthand } from '@/lib/hands/shorthand';
import {
  nameOpponent,
  pickHero,
  playersOf,
  setOpponentStack,
  setPlayers,
  setStraddleCount,
  toggleOpponent,
  type OpponentOption,
} from '@/lib/hands/table';
import { isOneOf } from '@/lib/sessions/form';
import { formatMoney } from '@/lib/sessions/format';
import { createClient } from '@/lib/supabase/client';
import { saveHand, undoHand } from '@/lib/offline/sync';
import { ActionCard } from './action-card';
import { AmountPad, type AmountKind } from './amount-pad';
import { CardsCard } from './cards-card';
import { ContextBar } from './context-bar';
import { EditActionSheet } from './edit-action-sheet';
import { SaveBar } from './save-bar';
import { ShorthandInput } from './shorthand-input';
import { ShowdownBlock } from './showdown-block';
import { TablePanel, type PanelRole } from './table-panel';
import type { PillData } from './pill-data';
import { UndoToast } from './undo-toast';

export type { OpponentOption };

type Props = {
  sessionId: string;
  session: HandSession & { currency: string };
  locale: string;
  lastNum: number;
  previous: PreviousHand | null;
  /** Every saved opponent, same venue first. */
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
  // The table panel starts open on a new hand: on the opponents once hero has a seat.
  const [panel, setPanel] = useState<PanelRole | null>(() =>
    edit ? null : raw.heroPos ? 'villain' : 'hero',
  );
  const [dropped, setDropped] = useState<Position[]>([]);
  const [picking, setPicking] = useState(false);
  const [switchBlocked, setSwitchBlocked] = useState(false);
  const [num, setNum] = useState(edit?.num ?? lastNum + 1);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [undo, setUndo] = useState<{ id: string; num: number; snapshot: HandDraft } | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [undoFailed, setUndoFailed] = useState(false);
  const [sheet, setSheet] = useState<AmountKind | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  // The tab the player chose, valid only while the hand stays on the street it was chosen on.
  const [chosen, setChosen] = useState<{ street: Street; from: Street } | null>(null);
  const locked = useRef(false);
  const closePanel = useCallback(() => setPanel(null), []);

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
  const players = playersOf(session, draft);
  const picked = pickedOpponents(draft);
  const buttonsMode = mode === 'buttons' && setup !== null;
  const decided = Boolean(machine) && derived.outcome !== '' && derived.outcome !== draft.outcome;
  const bbForStraddle = bb ?? toNumber(draft.levelBb) ?? 0;

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

  // ---- the table panel: seats, head count, stacks, names (actions are kept, never cleared) ----
  function onHeroSeat(pos: Position) {
    setDraft((d) => pickHero(d, pos));
    setDropped([]);
    setPanel('villain');
  }

  function onPlayers(n: number) {
    const r = setPlayers(session, raw, n);
    setDraft(r.draft);
    setDropped(r.dropped);
    if (r.dropped.length > 0) setPanel(r.draft.heroPos ? 'villain' : 'hero');
  }

  function togglePanel() {
    setPanel((p) => (p ? null : raw.heroPos ? 'villain' : 'hero'));
  }

  // ---- entering actions (the state machine decides everything) ----
  function apply(input: ActInput): boolean {
    if (!setup) return false;
    const r = act(setup, full, input, board);
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
    return true;
  }

  function onButton(kind: ButtonKind) {
    if (kind === 'open' || kind === 'bet' || kind === 'raise') return setSheet(kind);
    if (kind === 'all-in') {
      const toAct = machine?.phase.kind === 'act' ? machine.phase.toAct : null;
      const stack = machine?.players.find((p) => p.pos === toAct)?.stack;
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
    if (!machine) return [];
    return full.flatMap((a, index) => {
      if (a.street !== street || isPostAct(a.act)) return [];
      const shown = machine.actions[index] ?? a;
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
          invalid: machine.invalid.includes(index),
        },
      ];
    });
  }

  // Street tabs follow the betting; the tab the player picked holds until the hand moves on.
  const tabs = machine ? streetTabs(machine) : null;
  const current: Street = machine ? reachedStreet(machine) : 'preflop';
  const selected: Street =
    chosen && chosen.from === current && tabs && tabs[chosen.street] !== 'locked'
      ? chosen.street
      : current;
  const selectStreet = (street: Street) => setChosen({ street, from: current });

  // A seat that is no longer picked stops the replay at its first action.
  const stopAt = machine?.warnings.find((w) => w.code === 'not_in_hand')?.index;
  const halted =
    stopAt !== undefined
      ? {
          text: tr('removedSeat'),
          deleteLabel: tr('deleteFrom'),
          onDelete: () => {
            set('actions', stripForced(full.slice(0, stopAt)));
            setNotes([]);
          },
        }
      : null;

  // ---- saving ----
  const heroBehind = machine?.players.find((p) => p.actor === 'hero')?.behind;
  const stackNow = heroBehind ?? toNumber(draft.heroStack);
  const potNow = buttonsMode
    ? (machine?.pot ?? null)
    : mode === 'shorthand'
      ? derived.potFinal
      : null;
  const hint =
    lineErrors.length > 0
      ? t('fixLineToSave')
      : derived.board && derived.board.missing > 0
        ? tr('boardMissing', { n: derived.board.missing })
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
    const fresh = emptyDraft(session, prev);
    setDraft(fresh);
    setPanel(fresh.heroPos ? 'villain' : 'hero');
    setDropped([]);
    setSheet(null);
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
    ...(machine?.warnings.some((w) => w.code === 'below_min_raise') ? [tr('warnBelowMin')] : []),
    ...(derived.board && derived.board.extra > 0 ? [tr('warnBoardExtra')] : []),
  ].filter((w, i, all) => all.indexOf(w) === i);

  const toActPos = machine?.phase.kind === 'act' ? machine.phase.toAct : null;
  const toActActor = machine?.players.find((p) => p.pos === toActPos)?.actor;
  const toActWho =
    toActActor === 'hero'
      ? tr('roleHero')
      : toActActor === 'villain'
        ? tr('roleVillain')
        : tr('roleOther');
  const callText = machine ? both(machine.toCall) : '';
  const heroSeat = machine?.players.find((p) => p.actor === 'hero')?.pos;
  const wonText =
    machine?.phase.kind === 'won'
      ? machine.phase.winner === heroSeat
        ? tr('wonHeroFold')
        : machine.players.find((p) => p.pos === (machine.phase as { winner: string }).winner)
              ?.actor === 'villain'
          ? tr('wonVillFold')
          : tr('wonOther', { pos: machine.phase.winner })
      : undefined;
  const deadSeats = (machine?.players ?? []).filter((p) => !p.tracked).map((p) => p.pos);
  const showShowdown =
    mode === 'shorthand' ||
    (machine !== null && (['runout', 'showdown', 'won'].includes(machine.phase.kind) || decided));
  const extra =
    session.kind === 'mtt'
      ? [
          draft.levelBb && tr('levelChip', { bb: draft.levelBb }),
          draft.stage && tr(`stage_${draft.stage as 'early'}`),
        ]
          .filter(Boolean)
          .join(' · ')
      : draft.straddles.length > 0
        ? `${tr('straddle')} ${draft.straddles.join('/')}`
        : '';

  return (
    <div className="flex flex-col gap-3">
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

      {edit?.initial.legacy && <p className="text-sm text-muted">{tr('oldHand')}</p>}

      <ContextBar
        num={num}
        heroPos={draft.heroPos}
        opponents={picked.map((o) => o.pos)}
        players={players}
        stack={draft.heroStack}
        extra={extra}
        open={panel !== null}
        onToggle={togglePanel}
        onClose={closePanel}
      >
        <TablePanel
          session={session}
          draft={draft}
          players={players}
          role={panel ?? 'villain'}
          onRole={setPanel}
          dropped={dropped}
          options={opponents}
          onHeroSeat={onHeroSeat}
          onOpponentSeat={(pos) => setDraft((d) => toggleOpponent(d, pos))}
          onPlayers={onPlayers}
          onOpponentStack={(pos, stack) => setDraft((d) => setOpponentStack(d, pos, stack))}
          onOpponentName={(pos, id) =>
            setDraft((d) => nameOpponent(d, pos, id, id ? opponentStacks[id] : undefined))
          }
          onStraddles={(count) =>
            setDraft((d) => setStraddleCount(session, d, players, count, bbForStraddle))
          }
          set={set}
          mode={mode}
          onMode={switchMode}
          modeLocked={Boolean(edit?.initial.legacy)}
          switchBlocked={switchBlocked}
        />
      </ContextBar>

      <CardsCard
        slots={draft.slots}
        check={buttonsMode ? (derived.board ?? null) : null}
        blocked={draft.villCards}
        highlight={buttonsMode ? selected : null}
        onChange={(slots) => set('slots', slots)}
        onPicking={(open) => {
          setPicking(open);
          if (open) {
            setSheet(null);
            setPanel(null);
          }
        }}
      />

      {buttonsMode && machine && tabs ? (
        <ActionCard
          state={machine}
          tabs={tabs}
          selected={selected}
          onSelect={selectStreet}
          expanded={expanded}
          onToggleExpanded={() => setExpanded((e) => !e)}
          pillsOf={pillsOf}
          onPill={setEditing}
          who={toActWho}
          toCallText={callText}
          canUndo={draft.actions.length > 0}
          onButton={onButton}
          onDead={() => setSheet('dead')}
          onUndo={() => {
            set('actions', stripForced(undoAction(full)));
            setNotes([]);
            setSheet(null);
          }}
          collapsed={picking}
          halted={halted}
          pad={
            sheet ? (
              <AmountPad
                kind={sheet}
                state={machine}
                bb={bb ?? 1}
                money={money}
                deadSeats={deadSeats}
                onConfirm={onAmount}
                onClose={() => setSheet(null)}
              />
            ) : null
          }
        />
      ) : mode === 'buttons' ? (
        <Panel tight>
          <p role="status" className="text-sm text-muted">
            {tr(draft.heroPos ? 'needOpponent' : 'needHero')}
          </p>
        </Panel>
      ) : (
        <ShorthandInput
          value={raw.rawLine}
          onChange={(rawLine) => set('rawLine', rawLine)}
          errors={lineErrors}
        />
      )}

      {warnings.length > 0 && (
        <ul role="status" className="space-y-1 rounded-md bg-warn/10 p-3 text-sm">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      {showShowdown && (
        <>
          <ShowdownBlock
            draft={draft}
            set={set}
            outcome={derived.outcome}
            decided={decided}
            mode={buttonsMode ? 'actions' : 'shorthand'}
            result={derived.result}
            resultBb={derived.resultBb}
            money={money}
            {...(wonText && { wonText })}
          />
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

      <EditActionSheet
        action={editing !== null ? (machine?.actions[editing] ?? null) : null}
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
