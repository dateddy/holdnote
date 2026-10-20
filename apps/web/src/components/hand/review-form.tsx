'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import {
  aiErrorCode,
  contentChanged,
  ERROR_TAGS,
  EV_VERDICTS,
  fromReviewRow,
  isRetryable,
  sameField,
  toggleTag,
  toReviewRow,
  type ReviewDraft,
  type ReviewField,
  type ReviewRow,
} from '@/lib/review/review';

const AREA = 'w-full rounded-md border border-line bg-surface p-3 text-base';
import { chipClass as chip } from '@/components/ui/chip';

/** A pot-odds line the review can quote: computed by poker-core, shown read-only. */
export type MathHint = {
  street: string;
  act: string;
  toCall: string;
  odds: string;
  mdf: string | null;
};

/** What the AI button needs to know about the user's plan (from the server). */
export type AiInfo = {
  plan: 'free' | 'byok';
  /** Reviews left this month on the free plan; null with an own key. */
  remaining: number | null;
  /** The app-wide free budget is spent. */
  locked: boolean;
};

type Props = {
  handId: string;
  /** Id of the current review, if any. */
  reviewId: string | null;
  /** `ai` or `manual`, of the current review. */
  source: string | null;
  /** Prompt that made the AI review (`v1`/`v2`); null for manual reviews. */
  promptVersion?: string | null;
  initial: ReviewDraft;
  isMtt: boolean;
  mathHints: MathHint[];
  ai: AiInfo;
};

type AiResponse = {
  review?: ReviewRow & { id: string; prompt_version?: string | null };
  remaining?: number | null;
  cached?: boolean;
  error?: string;
};

/** Review block (spec 3.7): manual fields, AI review with an "AI" label, rebuttal. */
export function ReviewForm({
  handId,
  reviewId,
  source,
  promptVersion: initialPrompt = null,
  initial,
  isMtt,
  mathHints,
  ai,
}: Props) {
  const t = useTranslations('review');
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [id, setId] = useState(reviewId);
  const [prompt, setPrompt] = useState(initialPrompt);
  // What the AI wrote, while the review is still the AI's. Fields equal to it carry the "AI" label.
  const [aiText, setAiText] = useState<ReviewDraft | null>(
    source === 'ai' && !initial.accepted ? initial : null,
  );
  // The saved AI review, kept to tell whether the student changed anything.
  const [saved, setSaved] = useState<{ source: string | null; draft: ReviewDraft }>({
    source,
    draft: initial,
  });
  const [remaining, setRemaining] = useState(ai.remaining);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [run, setRun] = useState<'idle' | 'busy'>('idle');
  const [aiError, setAiError] = useState<string | null>(null);
  /** The last request, so "Try again" repeats it (a rebuttal keeps its text). */
  const lastBody = useRef<{ rebuttal?: string }>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [rebutOpen, setRebutOpen] = useState(false);
  const [reason, setReason] = useState('');

  const set = <K extends keyof ReviewDraft>(key: K, value: ReviewDraft[K]) => {
    setStatus('idle');
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const fromAi = (key: ReviewField) => aiText !== null && sameField(draft, aiText, key);
  const aiTag = (key: ReviewField) =>
    fromAi(key) && (
      <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 text-xs font-medium">
        {t('aiLabel')}
      </span>
    );

  const outOfTurns = ai.plan === 'free' && (ai.locked || remaining === 0);

  async function callAi(body: { rebuttal?: string }) {
    lastBody.current = body;
    setRun('busy');
    setAiError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ hand_id: handId, ...body }),
      });
      const data = (await res.json().catch(() => ({}))) as AiResponse;
      if (!res.ok || !data.review) {
        setAiError(aiErrorCode(data.error));
        return;
      }
      const next = fromReviewRow(data.review);
      setDraft(next);
      setAiText(next.accepted ? null : next);
      setSaved({ source: 'ai', draft: next });
      setId(data.review.id);
      setPrompt(data.review.prompt_version ?? null);
      setRemaining(data.remaining ?? null);
      setStatus('idle');
      setRebutOpen(false);
      setReason('');
      if (data.cached) setNotice(t('aiCached'));
      router.refresh();
    } catch {
      setAiError('offline');
    } finally {
      setRun('idle');
    }
  }

  async function save() {
    setStatus('saving');
    const supabase = createClient();
    const row = toReviewRow(draft, isMtt);
    let ok: boolean;

    if (id && saved.source === 'ai' && contentChanged(draft, saved.draft)) {
      // The student rewrote an AI review: keep the AI one as history, save theirs as manual.
      const { data, error } = await supabase.rpc('replace_current_review', {
        p_hand_id: handId,
        p_review: { ...row, source: 'manual' },
      });
      ok = !error && !!data;
      if (ok && data) {
        setId(data);
        setSaved({ source: 'manual', draft });
        setAiText(null);
      }
    } else if (id) {
      const { error } = await supabase.from('reviews').update(row).eq('id', id);
      ok = !error;
      if (ok) {
        setSaved((s) => ({ ...s, draft }));
        if (draft.accepted) setAiText(null);
      }
    } else {
      const { data, error } = await supabase
        .from('reviews')
        .insert({ ...row, hand_id: handId, source: 'manual', is_current: true })
        .select('id')
        .single();
      ok = !error;
      if (data) {
        setId(data.id);
        setSaved({ source: 'manual', draft });
      }
    }
    setStatus(ok ? 'saved' : 'failed');
    router.refresh();
  }

  const field = (key: 'range' | 'math' | 'line' | 'icmText', label: string) => (
    <label className="flex flex-col gap-1 text-sm">
      <span>
        {label}
        {aiTag(key)}
      </span>
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
      <h2 className="text-lg font-semibold">
        {t('title')}
        {saved.source === 'ai' && prompt === 'v2' && (
          <span className="ml-2 rounded border border-line px-1.5 py-0.5 text-xs font-normal text-muted">
            {t('oldPromptLabel')}
          </span>
        )}
      </h2>

      <div className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3">
        <button
          type="button"
          onClick={() => callAi({})}
          disabled={run === 'busy' || outOfTurns}
          className="h-12 rounded-md bg-accent text-base font-medium text-accent-foreground disabled:opacity-40"
        >
          {run === 'busy' ? t('aiRunning') : t('aiButton')}
        </button>
        <p className="text-sm">
          {ai.plan === 'byok'
            ? t('aiOwnKey')
            : ai.locked
              ? t('aiLocked')
              : t('aiLeft', { n: remaining ?? 0 })}
        </p>
        {notice && (
          <p role="status" className="text-sm">
            {notice}
          </p>
        )}
        {aiError && (
          <p role="alert" className="text-sm text-loss">
            {t(`ai_${aiErrorCode(aiError)}`)}{' '}
            {(aiError === 'quota_exhausted' || aiError === 'budget_locked') && (
              <Link href="/settings" className="underline underline-offset-4">
                {t('aiUseOwnKey')}
              </Link>
            )}
          </p>
        )}
        {aiError && isRetryable(aiErrorCode(aiError)) && (
          <Button
            variant="secondary"
            onClick={() => callAi(lastBody.current)}
            disabled={run === 'busy' || outOfTurns}
          >
            {t('aiRetry')}
          </Button>
        )}
      </div>

      {field('range', t('range'))}

      {mathHints.length > 0 && (
        <ul className="space-y-0.5 rounded-md bg-accent/5 p-3 text-sm">
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
        <h3 className="text-sm">
          {t('errors')}
          {aiTag('errorTags')}
        </h3>
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
        <h3 className="text-sm">
          {t('ev')}
          {aiTag('evVerdict')}
        </h3>
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
        <span>
          {t('lesson')}
          {aiTag('lesson')}
        </span>
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
        <p role="alert" className="text-sm text-loss">
          {t('saveFailed')}
        </p>
      )}
      <button
        type="button"
        onClick={save}
        disabled={status === 'saving'}
        className="h-14 rounded-md bg-accent text-lg font-medium text-accent-foreground disabled:opacity-40"
      >
        {status === 'saving' ? t('saving') : t('save')}
      </button>

      {id && (
        <div className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3">
          {!rebutOpen ? (
            <button
              type="button"
              onClick={() => setRebutOpen(true)}
              disabled={outOfTurns}
              className="h-12 rounded-md border border-line bg-surface text-base disabled:opacity-40"
            >
              {t('rebutButton')}
            </button>
          ) : (
            <>
              <label className="flex flex-col gap-1 text-sm">
                {t('rebutReason')}
                <textarea
                  rows={3}
                  maxLength={600}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className={AREA}
                />
              </label>
              <p className="text-sm">{t('rebutCost')}</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRebutOpen(false)}
                  className="h-12 rounded-md border border-line bg-surface text-base"
                >
                  {t('rebutCancel')}
                </button>
                <button
                  type="button"
                  onClick={() => callAi({ rebuttal: reason.trim() })}
                  disabled={run === 'busy' || reason.trim().length < 3}
                  className="h-12 rounded-md bg-accent text-base font-medium text-accent-foreground disabled:opacity-40"
                >
                  {run === 'busy' ? t('aiRunning') : t('rebutSend')}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
