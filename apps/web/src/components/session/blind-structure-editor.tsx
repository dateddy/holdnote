'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { parseBlindStructure, type BlindLevel, type LevelAnteMode } from 'poker-core';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Collapse } from '@/components/ui/collapse';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  levelFromFields,
  levelRowText,
  nextRowFields,
  rowFields,
  type LevelFields,
} from '@/lib/sessions/blinds';

type Editing = {
  /** Level number of the row being edited; null = a new row. */
  original: number | null;
  fields: LevelFields;
};

type Props = {
  value: BlindLevel[];
  onChange: (levels: BlindLevel[]) => void;
  /** The session's ante type: pasted lines with an ante take it. */
  defaultAnteMode: LevelAnteMode;
};

/**
 * Blind structure of a tournament (spec 5): add, edit and delete rows, or paste text with one
 * `level sb/bb ante` per line. Controlled: the screen keeps the list and sends it as JSON.
 */
export function BlindStructureEditor({ value, onChange, defaultAnteMode }: Props) {
  const t = useTranslations('blinds');
  const [editing, setEditing] = useState<Editing | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [text, setText] = useState('');
  const [result, setResult] = useState<{ read: number; skipped: number } | null>(null);

  const minutesText = (n: number) => t('minutes', { n });

  function begin(original: number | null, fields: LevelFields) {
    setEditing({ original, fields });
    setInvalid(false);
  }

  function setField(name: keyof LevelFields, v: string) {
    setEditing((e) => (e ? { ...e, fields: { ...e.fields, [name]: v } } : e));
  }

  function commit() {
    if (!editing) return;
    const next = levelFromFields(editing.fields);
    if (!next) {
      setInvalid(true);
      return;
    }
    const rest = value.filter((l) => l.level !== editing.original && l.level !== next.level);
    onChange([...rest, next].sort((a, b) => a.level - b.level));
    setEditing(null);
  }

  function read() {
    const parsed = parseBlindStructure(text, defaultAnteMode);
    setResult({ read: parsed.read, skipped: parsed.skipped });
    if (parsed.read === 0) return;
    onChange(parsed.levels);
    setEditing(null);
  }

  const f = editing?.fields;
  const editor = f && (
    <div className="space-y-3 rounded-xl border border-line bg-surface p-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          {t('level')}
          <Input
            inputMode="numeric"
            autoComplete="off"
            value={f.level}
            onChange={(e) => setField('level', e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('length')}
          <Input
            inputMode="numeric"
            autoComplete="off"
            value={f.minutes}
            placeholder={t('optional')}
            onChange={(e) => setField('minutes', e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('sb')}
          <Input
            inputMode="decimal"
            autoComplete="off"
            value={f.sb}
            onChange={(e) => setField('sb', e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('bb')}
          <Input
            inputMode="decimal"
            autoComplete="off"
            value={f.bb}
            onChange={(e) => setField('bb', e.target.value)}
          />
        </label>
      </div>
      <div className="flex flex-col gap-1 text-sm">
        {t('anteType')}
        <div className="flex gap-1.5" role="group" aria-label={t('anteType')}>
          {(['none', 'each', 'bb'] as const).map((m) => (
            <Chip
              key={m}
              on={f.anteMode === m}
              onClick={() => setField('anteMode', m)}
              className="flex-1"
            >
              {t(`ante_${m}`)}
            </Chip>
          ))}
        </div>
      </div>
      {f.anteMode !== 'none' && (
        <label className="flex flex-col gap-1 text-sm">
          {t('ante')}
          <Input
            inputMode="decimal"
            autoComplete="off"
            value={f.ante}
            placeholder={f.anteMode === 'bb' ? f.bb : ''}
            onChange={(e) => setField('ante', e.target.value)}
          />
        </label>
      )}
      {invalid && (
        <p role="alert" className="text-sm text-loss">
          {t('invalidRow')}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={() => setEditing(null)}>
          {t('cancel')}
        </Button>
        <Button onClick={commit}>{t('saveRow')}</Button>
      </div>
    </div>
  );

  return (
    <section
      aria-label={t('title')}
      className="space-y-3"
      onKeyDown={(e) => {
        // The editor may sit inside the new-session form: Enter saves the row, not the session.
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
          e.preventDefault();
          commit();
        }
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-medium">{t('title')}</h3>
        <span className="text-sm text-muted">{t('count', { n: value.length })}</span>
      </div>

      {value.length === 0 && !editing && <p className="text-sm text-muted">{t('empty')}</p>}

      <ul className="space-y-2">
        {value.map((l) =>
          editing?.original === l.level ? (
            <li key={l.level}>{editor}</li>
          ) : (
            <li key={l.level} className="flex gap-2">
              <Chip
                on={false}
                className="min-w-0 flex-1"
                aria-label={t('edit', { n: l.level })}
                onClick={() => begin(l.level, rowFields(l))}
              >
                {levelRowText(l, minutesText)}
              </Chip>
              <IconButton
                glyph="×"
                label={t('remove', { n: l.level })}
                onClick={() => {
                  onChange(value.filter((x) => x.level !== l.level));
                  if (editing?.original === l.level) setEditing(null);
                }}
              />
            </li>
          ),
        )}
        {editing?.original === null && <li>{editor}</li>}
      </ul>

      {!editing && (
        <Button variant="secondary" onClick={() => begin(null, nextRowFields(value))}>
          {t('add')}
        </Button>
      )}

      <Button variant="secondary" aria-expanded={pasteOpen} onClick={() => setPasteOpen((o) => !o)}>
        {t('paste')}
      </Button>
      <Collapse open={pasteOpen}>
        <div className="space-y-2 pt-1">
          <p className="text-xs text-muted">{t('pasteHint')}</p>
          <Textarea
            rows={5}
            value={text}
            placeholder={t('pastePlaceholder')}
            onChange={(e) => setText(e.target.value)}
          />
          <Button onClick={read} disabled={!text.trim()}>
            {t('read')}
          </Button>
          {result && (
            <p role="status" className="text-sm">
              {result.read > 0
                ? t('pasteResult', { read: result.read, skipped: result.skipped })
                : t('pasteNone')}
            </p>
          )}
        </div>
      </Collapse>
    </section>
  );
}
