'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { saveOpponent, type OpponentState } from '@/app/(app)/opponents/actions';
import { PLAYER_TYPES, type OpponentValues } from '@/lib/opponents/form';

import { INPUT_CLASS as INPUT } from '@/components/ui/input';

/** Create or edit an opponent (spec 3.9). */
export function OpponentForm({ id, initial }: { id: string | null; initial: OpponentValues }) {
  const t = useTranslations('opponents');
  const [state, formAction, pending] = useActionState<OpponentState, FormData>(
    saveOpponent.bind(null, id),
    { values: initial, errors: {}, failed: false },
  );
  const v = state.values;
  const err = (field: keyof OpponentValues) =>
    state.errors[field] ? (
      <span role="alert" className="text-sm text-loss">
        {t(`error_${state.errors[field]}`)}
      </span>
    ) : null;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        {t('name')}
        <input name="name" defaultValue={v.name} className={INPUT} maxLength={60} required />
        <span className="text-xs text-muted">{t('nameHint')}</span>
        {err('name')}
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t('playerType')}
        <select name="playerType" defaultValue={v.playerType} className={INPUT}>
          <option value="">–</option>
          {PLAYER_TYPES.map((p) => (
            <option key={p} value={p}>
              {t(`type_${p}`)}
            </option>
          ))}
        </select>
        {err('playerType')}
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t('venue')}
        <input name="venue" defaultValue={v.venue} className={INPUT} maxLength={100} />
        <span className="text-xs text-muted">{t('venueHint')}</span>
        {err('venue')}
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t('notes')}
        <textarea
          name="notes"
          rows={4}
          defaultValue={v.notes}
          maxLength={1000}
          className="w-full rounded-xl border border-line bg-surface p-3 text-base"
        />
        {err('notes')}
      </label>
      {state.failed && (
        <p role="alert" className="text-sm text-loss">
          {t('saveFailed')}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-14 rounded-xl bg-accent text-lg font-medium text-accent-foreground disabled:opacity-40"
      >
        {pending ? t('saving') : t('save')}
      </button>
    </form>
  );
}
