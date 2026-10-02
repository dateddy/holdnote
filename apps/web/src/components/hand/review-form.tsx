'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  ERROR_TAGS,
  EV_VERDICTS,
  toggleTag,
  toReviewRow,
  type ReviewDraft,
} from '@/lib/review/review';

const AREA = 'w-full rounded-md border border-current/20 bg-transparent p-3 text-base';
const chip = (on: boolean) =>
  `flex h-10 items-center justify-center rounded-md border px-3 text-sm ${
    on ? 'border-foreground bg-foreground text-background' : 'border-current/20'
  }`;

/** A pot-odds line the review can quote: computed by poker-core, shown read-only. */
export type MathHint = {
  street: string;
  act: string;
  toCall: string;
  odds: string;
  mdf: string | null;
};

type Props = {
  handId: string;
  /** Id of the current review, if any. */
  reviewId: string | null;
  initial: ReviewDraft;
  isMtt: boolean;
  mathHints: MathHint[];
};

/** Manual review block (spec 3.7). The AI button arrives with task 3.3. */
export function ReviewForm({ handId, reviewId, initial, isMtt, mathHints }: Props) {
  const t = useTranslations('review');
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [id, setId] = useState(reviewId);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');

  const set = <K extends keyof ReviewDraft>(key: K, value: ReviewDraft[K]) => {
    setStatus('idle');
    setDraft((d) => ({ ...d, [key]: value }));
  };

  async function save() {
    setStatus('saving');
    const supabase = createClient();
    const row = toReviewRow(draft, isMtt);
    if (id) {
      const { error } = await supabase.from('reviews').update(row).eq('id', id);
      setStatus(error ? 'failed' : 'saved');
    } else {
      const { data, error } = await supabase
        .from('reviews')
        .insert({ ...row, hand_id: handId, source: 'manual', is_current: true })
        .select('id')
        .single();
      if (data) setId(data.id);
      setStatus(error ? 'failed' : 'saved');
    }
    router.refresh();
  }

  const field = (key: 'range' | 'math' | 'line' | 'icmText', label: string) => (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <textarea
        rows={3}
        value={draft[key]}
        onChange={(e) => set(key, e.target.value)}
        className={AREA}
      />
    </label>
  );

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{t('title')}</h2>

      {field('range', t('range'))}

      {mathHints.length > 0 && (
        <ul className="space-y-0.5 rounded-md bg-foreground/5 p-3 text-sm">
          {mathHints.map((m, i) => (
            <li key={i}>
              {t('mathHint', {
                street: m.street,
                act: m.act,
                toCall: m.toCall,
                odds: m.odds,
              })}
              {m.mdf ? ` · MDF ${m.mdf}` : ''}
            </li>
          ))}
        </ul>
      )}
      {field('math', t('math'))}
      {field('line', t('line'))}
      {isMtt && field('icmText', t('icm'))}

      <div className="space-y-2">
        <h3 className="text-sm">{t('errors')}</h3>
        <div className="flex flex-wrap gap-1.5">
          {ERROR_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              aria-pressed={draft.errorTags.includes(tag)}
              onClick={() => set('errorTags', toggleTag(draft.errorTags, tag))}
              className={chip(draft.errorTags.includes(tag))}
            >
              {t(`tag_${tag}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm">{t('ev')}</h3>
        <div className="grid grid-cols-3 gap-1.5">
          {EV_VERDICTS.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={draft.evVerdict === v}
              onClick={() => set('evVerdict', draft.evVerdict === v ? '' : v)}
              className={chip(draft.evVerdict === v)}
            >
              {t(`ev_${v}`)}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        {t('lesson')}
        <textarea
          rows={2}
          value={draft.lesson}
          onChange={(e) => set('lesson', e.target.value)}
          className={AREA}
        />
      </label>

      <label className="flex items-center gap-2 text-base">
        <input
          type="checkbox"
          checked={draft.accepted}
          onChange={(e) => set('accepted', e.target.checked)}
          className="size-5"
        />
        {t('done')}
      </label>

      {status === 'saved' && (
        <p role="status" className="text-sm">
          {t('saved')}
        </p>
      )}
      {status === 'failed' && (
        <p role="alert" className="text-sm text-red-700">
          {t('saveFailed')}
        </p>
      )}
      <button
        type="button"
        onClick={save}
        disabled={status === 'saving'}
        className="h-14 rounded-md bg-foreground text-lg font-medium text-background disabled:opacity-40"
      >
        {status === 'saving' ? t('saving') : t('save')}
      </button>
    </section>
  );
}
