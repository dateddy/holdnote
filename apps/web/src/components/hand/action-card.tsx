'use client';

import { useTranslations } from 'next-intl';
import { STREETS, type ButtonKind, type HandState, type Street, type TabState } from 'poker-core';
import { ActionPill } from '@/components/ui/action-pill';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { Tab } from '@/components/ui/tab';
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
  /** Who is to act: "Mình", "Đối thủ" or "người mới". */
  who: string;
  /** Amount to call as "450 (9bb)". */
  toCallText: string;
  canUndo: boolean;
  onButton: (kind: ButtonKind) => void;
  onDead: () => void;
  onAddPlayer: () => void;
  onUndo: () => void;
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
  who,
  toCallText,
  canUndo,
  onButton,
  onDead,
  onAddPlayer,
  onUndo,
}: Props) {
  const t = useTranslations('record');
  const th = useTranslations('hand');
  const name = (s: Street) => (s === 'preflop' ? t('preflopHeading') : th(s));
  const open = STREETS.filter((s) => tabs[s] !== 'locked');
  const index = open.indexOf(selected);
  const phase = state.phase;
  const toActStreet = phase.kind === 'act' ? phase.street : null;
  // The input shows only on the street that is to act, and only while the hand goes on.
  const input = phase.kind === 'act' && selected === toActStreet;
  const label = (k: ButtonKind) => (k === 'open' ? t('act_open') : th(`act_${k}`));

  const chips = (street: Street) =>
    pillsOf(street).map((p) => (
      <ActionPill
        key={p.index}
        tone={p.tone}
        who={p.who}
        what={p.what}
        {...(p.amount && { amount: p.amount })}
        invalid={p.invalid}
        onClick={() => onPill(p.index)}
        aria-label={`${p.who} ${p.what} ${p.amount ?? ''}${p.invalid ? ` · ${t('invalidAction')}` : ''}`}
      />
    ));

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

      {expanded ? (
        <div className="space-y-2">
          {open.map((s) => (
            <div key={s} className="flex items-start gap-2">
              <span className="w-14 shrink-0 pt-2 text-xs text-muted">{name(s)}</span>
              <div className="flex flex-wrap gap-1.5">{chips(s)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex min-h-9 flex-wrap gap-1.5">{chips(selected)}</div>
      )}

      {input && (
        <div className="space-y-2">
          <p className="text-sm tabular-nums">
            <span className="font-medium">{t('turnOf', { pos: phase.toAct, who })}</span>
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
                onClick={() => onButton(k)}
              >
                {label(k)}
              </Button>
            ))}
          </div>
        </div>
      )}
      {phase.kind === 'runout' && <p className="text-sm">{t('runout')}</p>}

      <div className="flex items-center justify-between gap-1.5">
        <IconButton
          glyph="‹"
          label={t('prevStreet')}
          disabled={index <= 0}
          onClick={() => onSelect(open[index - 1] ?? selected)}
        />
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-x-3">
          <Button variant="ghost" full={false} disabled={!canUndo} onClick={onUndo}>
            {t('undo')}
          </Button>
          {phase.kind === 'act' && (
            <>
              <Button variant="ghost" full={false} onClick={onDead}>
                {t('deadMoney')}
              </Button>
              {state.addable.length > 0 && (
                <Button variant="ghost" full={false} onClick={onAddPlayer}>
                  {t('addPlayer')}
                </Button>
              )}
            </>
          )}
        </div>
        <IconButton
          glyph="›"
          label={t('nextStreet')}
          disabled={index < 0 || index >= open.length - 1}
          onClick={() => onSelect(open[index + 1] ?? selected)}
        />
      </div>
    </Card>
  );
}
