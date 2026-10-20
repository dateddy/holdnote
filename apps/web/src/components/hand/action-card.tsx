'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { STREETS, type ButtonKind, type HandState, type Street, type TabState } from 'poker-core';
import { ActionPill } from '@/components/ui/action-pill';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Collapse } from '@/components/ui/collapse';
import { IconButton } from '@/components/ui/icon-button';
import { Tab } from '@/components/ui/tab';
import { revealAboveBar } from '@/lib/hands/reveal';
import type { PillData } from './pill-data';

type Props = {
  state: HandState;
  tabs: Record<Street, TabState>;
  /** The street tab that is showing. */
  selected: Street;
  onSelect: (street: Street) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  pillsOf: (street: Street) => PillData[];
  onPill: (index: number) => void;
  /** The chip being edited and its edit row, drawn right under that street chips. */
  edit: { index: number; node: ReactNode } | null;
  /** Who is to act: "Mình" or "Đối thủ". */
  who: string;
  /** Amount to call as "450 (9bb)". */
  toCallText: string;
  canUndo: boolean;
  onButton: (kind: ButtonKind) => void;
  onDead: () => void;
  onUndo: () => void;
  /** The card picker is open: only the tab row stays. */
  collapsed: boolean;
  /** Amount keypad, shown in place of the buttons while it is open. */
  pad: ReactNode | null;
  /** A seat that is no longer picked stopped the replay: say so and offer to cut from there. */
  halted: { text: string; deleteLabel: string; onDelete: () => void } | null;
};

/** One card for the whole betting: street tabs, the chips, the input and the street arrows. */
export function ActionCard({
  state,
  tabs,
  selected,
  onSelect,
  expanded,
  onToggleExpanded,
  pillsOf,
  onPill,
  edit,
  who,
  toCallText,
  canUndo,
  onButton,
  onDead,
  onUndo,
  collapsed,
  pad,
  halted,
}: Props) {
  const t = useTranslations('record');
  const th = useTranslations('hand');
  const [more, setMore] = useState(false);
  const padArea = useRef<HTMLDivElement>(null);
  const name = (s: Street) => (s === 'preflop' ? t('preflopHeading') : th(s));
  const open = STREETS.filter((s) => tabs[s] !== 'locked');
  const index = open.indexOf(selected);
  const phase = state.phase;
  const toActStreet = phase.kind === 'act' ? phase.street : null;
  // The input shows only on the street that is to act, and only while the hand goes on.
  const input = phase.kind === 'act' && selected === toActStreet && !halted;
  const label = (k: ButtonKind) => (k === 'open' ? t('act_open') : th(`act_${k}`));

  // Bring the keypad above the save bar when it opens (a moment after layout, so the height is final).
  const padOpen = pad !== null;
  useEffect(() => {
    if (!padOpen) return;
    const timer = setTimeout(() => revealAboveBar(padArea.current), 200);
    return () => clearTimeout(timer);
  }, [padOpen]);

  const chips = (street: Street) =>
    pillsOf(street).map((p) => (
      <ActionPill
        key={p.index}
        tone={p.tone}
        who={p.who}
        what={p.what}
        {...(p.amount && { amount: p.amount })}
        invalid={p.invalid}
        active={edit?.index === p.index}
        onClick={() => onPill(p.index)}
        aria-label={`${p.who} ${p.what} ${p.amount ?? ''}${p.invalid ? ` · ${t('invalidAction')}` : ''}`}
      />
    ));
  const selectedChips = chips(selected);
  const editStreet = edit
    ? STREETS.find((s) => pillsOf(s).some((p) => p.index === edit.index))
    : undefined;
  const editNode = (s: Street) => (edit && editStreet === s ? edit.node : null);

  return (
    <Card tight>
      <div className="flex gap-1.5" role="tablist" aria-label={t('actionTabs')}>
        {STREETS.map((s) => (
          <Tab
            key={s}
            tone={tabs[s] === 'locked' ? 'locked' : tabs[s] === 'invalid' ? 'invalid' : 'ok'}
            selected={s === selected}
            onClick={() => onSelect(s)}
          >
            {name(s)}
          </Tab>
        ))}
        <IconButton
          glyph="<>"
          label={expanded ? t('collapseAll') : t('expandAll')}
          aria-expanded={expanded}
          onClick={onToggleExpanded}
        />
      </div>

      <Collapse open={!collapsed}>
        <div className="space-y-2">
          {expanded ? (
            <div className="space-y-2">
              {open.map((s) => (
                <div key={s} className="flex items-start gap-2">
                  <span className="w-14 shrink-0 pt-2 text-xs text-muted">{name(s)}</span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap gap-1.5">{chips(s)}</div>
                    {editNode(s)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            selectedChips.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">{selectedChips}</div>
                {editNode(selected)}
              </div>
            )
          )}

          {halted && (
            <div role="status" className="space-y-2 rounded-md bg-loss/10 p-2 text-sm">
              <p>{halted.text}</p>
              <Button variant="secondary" onClick={halted.onDelete}>
                {halted.deleteLabel}
              </Button>
            </div>
          )}

          <div ref={padArea}>
            {pad
              ? pad
              : input && (
                  <div className="space-y-2">
                    <p className="text-sm tabular-nums">
                      <span className="font-medium">
                        {t('turnOf', { pos: phase.kind === 'act' ? phase.toAct : '', who })}
                      </span>
                      <span className="text-muted">
                        {' · '}
                        {state.toCall > 0 ? t('toCall', { amount: toCallText }) : t('noCall')}
                      </span>
                    </p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {state.buttons.map((k) => (
                        <Button
                          key={k}
                          variant="secondary"
                          className="px-1 text-sm"
                          onClick={() => {
                            setMore(false);
                            onButton(k);
                          }}
                        >
                          {label(k)}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
          </div>
          {phase.kind === 'runout' && <p className="text-sm">{t('runout')}</p>}

          <div className="flex items-center justify-between gap-1.5">
            <IconButton
              glyph="‹"
              label={t('prevStreet')}
              disabled={index <= 0}
              onClick={() => onSelect(open[index - 1] ?? selected)}
            />
            <IconButton glyph="↶" label={t('undo')} disabled={!canUndo} onClick={onUndo} />
            {phase.kind === 'act' && !halted && (
              <IconButton
                glyph="⋯"
                label={t('more')}
                aria-expanded={more}
                onClick={() => setMore((v) => !v)}
              />
            )}
            <IconButton
              glyph="›"
              label={t('nextStreet')}
              disabled={index < 0 || index >= open.length - 1}
              onClick={() => onSelect(open[index + 1] ?? selected)}
            />
          </div>
          {more && (
            <Chip
              on={false}
              onClick={() => {
                setMore(false);
                onDead();
              }}
            >
              {t('deadMoney')}
            </Chip>
          )}
        </div>
      </Collapse>
    </Card>
  );
}
