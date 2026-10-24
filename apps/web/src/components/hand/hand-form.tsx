'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  act,
  canonPos,
  edit as editAction,
  forcedBets,
  formatShorthand,
  isPostAct,
  levelAt,
  parseAmount,
  parseShorthand,
  POSITIONS,
  reachedStreet,
  replay,
  streetTabs,
  suggestLevel,
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
import { Card as Panel } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EntryLayout } from '@/components/ui/entry-layout';
import { ShortcutsDialog } from '@/components/ui/shortcuts-dialog';
import { Input } from '@/components/ui/input';
import type { SeatTone } from '@/components/ui/seat';
import {
  boardCards,
  canSave,
  deriveHand,
  emptyDraft,
  opponentCards,
  pickedOpponents,
  stripForced,
  toHandRow,
  type HandDraft,
  type HandSession,
  type PreviousHand,
} from '@/lib/hands/build';
import { opponentLabel } from '@/lib/hands/labels';
import { applyLevel, currentLevel, levelLabel, sessionLevels, startLevel } from '@/lib/hands/level';
import { boardInput, draftToSetup } from '@/lib/hands/setup';
import { applyShorthand } from '@/lib/hands/shorthand';
import { globalShortcut, SHORTCUT_LIST } from '@/lib/hands/shortcuts';
import {
  nameOpponent,
  pickHero,
  playersOf,
  setOpponentCards,
  setOpponentStack,
  setPlayers,
  setPotWinners,
  setStraddleCount,
  toggleOpponent,
  type OpponentOption,
} from '@/lib/hands/table';
import { isOneOf } from '@/lib/sessions/form';
import { formatMoney } from '@/lib/sessions/format';
import { useDesktop } from '@/lib/use-desktop';
import { createClient } from '@/lib/supabase/client';
import { pendingOpponents, saveHand, saveOpponent, undoHand } from '@/lib/offline/sync';
import { ActionCard } from './action-card';
import { AmountPad, type AmountKind } from './amount-pad';
import { CardsCard } from './cards-card';
import { ContextBar } from './context-bar';
import { EditRow } from './edit-row';
import { SaveBar } from './save-bar';
import { ShorthandInput } from './shorthand-input';
import { ShowdownBlock, type ShowdownOpponent } from './showdown-block';
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
  /** Venue of the session: new opponents made here belong to it. */
  venue?: string | null;
  /** Last villain stack seen against each opponent. */
  opponentStacks?: Record<string, number>;
  entryMode: 'buttons' | 'shorthand';
  /** When the session started (MTT): the level length turns it into a "may be Lv n by now" hint. */
  startedAt?: string | null;
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
  opponents: savedOpponents,
  venue = null,
  opponentStacks = {},
  entryMode,
  startedAt = null,
  edit,
  practice,
}: Props) {
  const t = useTranslations('hand');
  const tr = useTranslations('record');
  const router = useRouter();
  const desktop = useDesktop();
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
  // Opponents made on this screen, or offline earlier and not sent yet, join the saved ones.
  const [made, setMade] = useState<OpponentOption[]>([]);
  useEffect(() => {
    let alive = true;
    pendingOpponents()
      .then((list) => {
        if (!alive) return;
        const here = (venue ?? '').trim().toLowerCase();
        setMade(
          list.map((o) => ({
            id: o.id,
            name: o.name,
            sameVenue: here !== '' && (o.venue ?? '').trim().toLowerCase() === here,
          })),
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [venue]);
  const opponents = useMemo(
    () => [...made.filter((m) => !savedOpponents.some((o) => o.id === m.id)), ...savedOpponents],
    [made, savedOpponents],
  );

  async function createOpponent(pos: string, name: string) {
    try {
      const item = await saveOpponent({ name, venue: venue?.trim() || null });
      setMade((list) => [...list, { id: item.id, name, sameVenue: Boolean(venue?.trim()) }]);
      setDraft((d) => nameOpponent(d, pos, item.id));
    } catch {
      // Not signed in on this device: the name just stays unattached.
    }
  }

  const set = <K extends keyof HandDraft>(key: K, value: HandDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  // The clock only hints at the level (spec 5): it never changes it. Read after mount, so the
  // server render and the first client render agree.
  const levels = useMemo(() => sessionLevels(session), [session]);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (edit || levels.length === 0 || !startedAt) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [edit, levels, startedAt]);

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
  const decided = derived.decided;
  const mismatch = buttonsMode && Boolean(derived.showdown?.mismatch);
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

  const closeEdit = useCallback(() => setEditing(null), []);

  function applyEdit(input: ActInput) {
    if (!setup || editing === null) return;
    const r = editAction(setup, full, editing, input, board);
    if (!r.accepted) return setNotes([tr('refused')]);
    setDraft((d) => ({ ...d, actions: stripForced(r.actions) }));
    setNotes([]);
    setEditing(null);
  }

  function undoLastAction() {
    set('actions', stripForced(undoAction(full)));
    setNotes([]);
    setSheet(null);
  }

  const toneOf = (a: Action['actor']): SeatTone => a;
  // Every opponent picked is "Đối thủ"; from two on the seat is added (spec 13). "Người khác" is
  // only for a seat that was not picked.
  const heroSeat = machine?.players.find((p) => p.actor === 'hero')?.pos;
  const opponentSeats = new Set(
    (machine?.players ?? []).filter((p) => p.tracked && p.actor !== 'hero').map((p) => p.pos),
  );
  const nameOfSeat = (seat: string): string =>
    seat === heroSeat
      ? tr('roleHero')
      : opponentSeats.has(seat as Position)
        ? opponentLabel(tr('roleVillain'), seat, opponentSeats.size)
        : seat;
  const whoOf = (a: Action) =>
    a.actor === 'hero'
      ? tr('roleHero')
      : a.pos
        ? nameOfSeat(a.pos)
        : a.actor === 'villain'
          ? tr('roleVillain')
          : '?';
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
  const selectStreet = (street: Street) => {
    setEditing(null);
    setChosen({ street, from: current });
  };

  // ---- keyboard (desktop): see lib/hands/shortcuts.ts ----
  const [help, setHelp] = useState(false);
  const shortcutLabel: Record<string, string> = {
    actions: tr('shortcut_actions'),
    amount: tr('shortcut_amount'),
    cards: tr('shortcut_cards'),
    undo: tr('shortcut_undo'),
    street: tr('shortcut_street'),
    help: tr('shortcut_help'),
  };
  const keyboard = useRef<(ev: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyboard.current = (ev) => {
      // Card slots and the amount pad read their own keys while they are open.
      if (picking || sheet !== null) return;
      const found = globalShortcut(ev, buttonsMode && machine ? machine.buttons : []);
      if (!found) return;
      if (found.kind === 'help') setHelp(true);
      else if (!buttonsMode) return;
      else if (found.kind === 'button') onButton(found.button);
      else if (found.kind === 'undo') {
        if (draft.actions.length > 0) undoLastAction();
      } else if (tabs) {
        const order: Street[] = ['preflop', 'flop', 'turn', 'river'];
        const next = order[order.indexOf(selected) + found.delta];
        if (next && tabs[next] !== 'locked') selectStreet(next);
      }
      ev.preventDefault();
    };
  });
  useEffect(() => {
    if (!desktop) return;
    const onKey = (ev: KeyboardEvent) => keyboard.current(ev);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [desktop]);

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
    if (locked.current || !canSave(draft) || lineErrors.length > 0 || mismatch) return;
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
      level: toNumber(draft.level),
      sb: session.kind === 'mtt' ? (setup?.sb ?? null) : null,
      ante_mode: draft.anteMode || null,
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
  const toActPlayer = machine?.players.find((p) => p.pos === toActPos);
  const toActWho =
    toActPlayer?.actor === 'hero'
      ? tr('roleHero')
      : toActPlayer?.tracked
        ? tr('roleVillain')
        : tr('roleOther');
  const callText = machine ? both(machine.toCall) : '';
  const wonText =
    machine?.phase.kind === 'won'
      ? machine.phase.winner === heroSeat
        ? tr('wonHeroFold')
        : opponentSeats.has(machine.phase.winner)
          ? opponentSeats.size > 1
            ? tr('wonOther', { pos: nameOfSeat(machine.phase.winner) })
            : tr('wonVillFold')
          : tr('wonOther', { pos: machine.phase.winner })
      : undefined;
  const seatCount = setup?.seats ?? 9;
  const showdownOpponents: ShowdownOpponent[] = picked.flatMap((o) => {
    const seat = canonPos(seatCount, o.pos as Position);
    const live = machine?.players.find((p) => p.pos === seat);
    return live && !live.folded
      ? [{ key: o.pos, seat, name: nameOfSeat(seat), cards: opponentCards(o) }]
      : [];
  });
  const deadSeats = (machine?.players ?? []).filter((p) => !p.tracked).map((p) => p.pos);
  const showShowdown =
    mode === 'shorthand' ||
    (machine !== null && (['runout', 'showdown', 'won'].includes(machine.phase.kind) || decided));
  const blindsAnte = derived.input?.blinds.ante;
  const levelText = levelLabel(
    draft,
    blindsAnte && blindsAnte.mode !== 'none' ? blindsAnte.amount : 0,
  );
  // "May be Lv 9 by now": only when the clock is ahead of the level the hand is at.
  const here = currentLevel(levels, draft);
  const clock =
    now !== null && startedAt
      ? suggestLevel({
          levels,
          startLevel: startLevel(session, levels)?.level ?? 1,
          startedAt: new Date(startedAt),
          now: new Date(now),
        })
      : null;
  const suggested = clock !== null && here !== null && clock > here.level ? clock : null;
  const extra =
    session.kind === 'mtt'
      ? [levelText, draft.stage && tr(`stage_${draft.stage as 'early'}`)]
          .filter(Boolean)
          .join(' · ')
      : draft.straddles.length > 0
        ? `${tr('straddle')} ${draft.straddles.join('/')}`
        : '';

  const banners = (
    <>
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

      {edit?.initial.legacy && edit.initial.legacyReason && (
        <p className="text-sm text-muted">
          {tr('oldHand', { reason: tr(`oldHandReason.${edit.initial.legacyReason}`) })}
        </p>
      )}
    </>
  );

  const tablePanel = (
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
      {...(!practice && { onOpponentCreate: createOpponent })}
      onStraddles={(count) =>
        setDraft((d) => setStraddleCount(session, d, players, count, bbForStraddle))
      }
      large={desktop}
      set={set}
      onDraft={setDraft}
      {...(!practice && !edit && { structureHref: `/sessions/${sessionId}/structure` })}
      mode={mode}
      onMode={switchMode}
      modeLocked={Boolean(edit?.initial.legacy)}
      switchBlocked={switchBlocked}
    />
  );

  const levelHint = (
    <>
      {suggested !== null && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-md bg-accent/10 px-3 py-2 text-sm"
        >
          <span>{tr('levelHint', { n: suggested })}</span>
          <Button
            variant="ghost"
            onClick={() => {
              const target = levelAt(levels, suggested);
              if (target) setDraft((d) => applyLevel(d, target));
            }}
          >
            {tr('levelHintApply', { n: suggested })}
          </Button>
        </div>
      )}
    </>
  );

  const cardsEl = (
    <>
      <CardsCard
        slots={draft.slots}
        check={buttonsMode ? (derived.board ?? null) : null}
        blocked={picked.flatMap((o) => opponentCards(o).filter(Boolean))}
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
    </>
  );

  const actionEl = (
    <>
      {buttonsMode && machine && tabs ? (
        <ActionCard
          state={machine}
          tabs={tabs}
          selected={selected}
          onSelect={selectStreet}
          expanded={expanded}
          onToggleExpanded={() => setExpanded((e) => !e)}
          pillsOf={pillsOf}
          onPill={(i) => setEditing((e) => (e === i ? null : i))}
          edit={
            editing !== null && machine?.actions[editing] && editState
              ? {
                  index: editing,
                  node: (
                    <EditRow
                      key={editing}
                      action={machine.actions[editing]}
                      before={editState}
                      bb={bb ?? 1}
                      money={money}
                      onApply={applyEdit}
                      onDeleteFrom={() => {
                        set('actions', stripForced(full.slice(0, editing)));
                        setEditing(null);
                      }}
                      onClose={closeEdit}
                    />
                  ),
                }
              : null
          }
          who={toActWho}
          toCallText={callText}
          canUndo={draft.actions.length > 0}
          onButton={onButton}
          onDead={() => setSheet('dead')}
          onUndo={undoLastAction}
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
            {tr(
              draft.heroPos
                ? 'needOpponent'
                : draft.actions.length > 0
                  ? 'pickHeroAgain'
                  : 'needHero',
            )}
          </p>
        </Panel>
      ) : (
        <ShorthandInput
          value={raw.rawLine}
          onChange={(rawLine) => set('rawLine', rawLine)}
          errors={lineErrors}
        />
      )}
    </>
  );

  const warningsEl = (
    <>
      {warnings.length > 0 && (
        <ul role="status" className="space-y-1 rounded-md bg-warn/10 p-3 text-sm">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </>
  );

  const showdownEl = (
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
        showdown={buttonsMode ? derived.showdown : null}
        heroSeat={heroSeat ?? ''}
        opponents={showdownOpponents}
        nameOf={nameOfSeat}
        onCards={(key, cards) => setDraft((d) => setOpponentCards(d, key, cards))}
        onPick={(i, winners) => setDraft((d) => setPotWinners(d, i, winners))}
      />
    </>
  );

  const thoughtEl = (
    <>
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
  );

  const saveBar = (
    <SaveBar
      sticky={!edit && !desktop}
      pot={potNow == null ? null : both(potNow)}
      stack={stackNow == null ? null : both(stackNow)}
      label={
        mismatch
          ? tr('saveMismatch')
          : practice
            ? practice.label
            : status === 'saving'
              ? t('saving')
              : edit
                ? t('saveChanges')
                : t('save')
      }
      disabled={!canSave(draft) || lineErrors.length > 0 || mismatch || status === 'saving'}
      {...(hint && !desktop && { hint })}
      onSave={save}
    />
  );

  if (desktop) {
    // Three columns (spec: desktop): the table, the cards and actions, and the result with Save.
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t('title', { num })}</h2>
        {banners}
        {levelHint}
        <EntryLayout
          left={<Panel>{tablePanel}</Panel>}
          aside={
            <>
              {warningsEl}
              {hint && (
                <p role="status" className="text-sm text-muted">
                  {hint}
                </p>
              )}
              {showShowdown && showdownEl}
              {thoughtEl}
              {saveBar}
              <Button variant="secondary" onClick={() => setHelp(true)}>
                {tr('shortcutsOpen')}
              </Button>
            </>
          }
        >
          {cardsEl}
          {actionEl}
        </EntryLayout>
        <ShortcutsDialog
          open={help}
          title={tr('shortcutsTitle')}
          closeLabel={tr('close')}
          rows={SHORTCUT_LIST.map((g) => ({ label: shortcutLabel[g.id] ?? g.id, keys: g.keys }))}
          onClose={() => setHelp(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {banners}
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
        {tablePanel}
      </ContextBar>

      {levelHint}
      {cardsEl}
      {actionEl}
      {warningsEl}
      {showShowdown && (
        <>
          {showdownEl}
          {thoughtEl}
        </>
      )}
      {saveBar}
    </div>
  );
}
