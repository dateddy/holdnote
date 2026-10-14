'use client';

import { useTranslations } from 'next-intl';
import type { ParseError } from 'poker-core';
import { backspaceToken, insertToken } from '@/lib/hands/shorthand';

const KEYS = ['H', 'V', 'x', 'c', 'b', 'r', 'f', 'ai', '/'] as const;

type Props = {
  value: string;
  onChange: (value: string) => void;
  errors: ParseError[];
};

/** Shorthand entry mode: one text line and a quick key row (spec 3.5). */
export function ShorthandInput({ value, onChange, errors }: Props) {
  const t = useTranslations('hand');
  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="H o600 V c / H x V b800 H c"
        aria-invalid={errors.length > 0 ? true : undefined}
        className="w-full rounded-md border border-line bg-surface p-3 font-mono text-base"
      />
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('keys')}>
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onChange(insertToken(value, k))}
            className="flex h-11 min-w-11 flex-1 items-center justify-center rounded-md border border-line bg-surface font-mono"
          >
            {k}
          </button>
        ))}
        <button
          type="button"
          aria-label={t('undoAction')}
          onClick={() => onChange(backspaceToken(value))}
          className="flex h-11 min-w-11 flex-1 items-center justify-center rounded-md border border-line bg-surface"
        >
          ⌫
        </button>
      </div>
      {errors.length > 0 && (
        <ul role="alert" className="space-y-0.5 text-sm text-loss">
          {errors.map((e, i) => (
            <li key={i}>{t(`parseError_${e.code}`, { token: e.token })}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
