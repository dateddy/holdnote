'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { InfoTip } from '@/components/ui/info-tip';
import { Textarea } from '@/components/ui/textarea';
import { Toggle } from '@/components/ui/toggle';
import { createClient } from '@/lib/supabase/client';
import {
  aiErrorCode,
  ERROR_TAGS,
  EV_VERDICTS,
  fromReviewRow,
  isRetryable,
  toggleTag,
  toReviewRow,
  type ReviewDraft,
  type ReviewRow,
} from '@/lib/review/review';

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

/**
 * "AI phân tích" (spec 3.7). No AI review: the AI button with the turns left, and under it the
 * "Bạn tự review" form for the player's own words. With an AI review: its fields read-only, the
 * "Đã review" switch (saved at once) and the rebuttal.
 */
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
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [id, setId] = useState(reviewId);
  const [isAi, setIsAi] = useState(source === 'ai');
  const [prompt, setPrompt] = useState(initialPrompt);
  const [remaining, setRemaining] = useState(ai.remaining);
  const [run, setRun] = useState<'idle' | 'busy'>('idle');
  const [aiError, setAiError] = useState<string | null>(null);
  /** The last request, so "Try again" repeats it (a rebuttal keeps its text). */
  const lastBody = useRef<{ rebuttal?: string }>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [rebutOpen, setRebutOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [doneFailed, setDoneFailed] = useState(false);
  const [confirmAgain, setConfirmAgain] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');

  const outOfTurns = ai.plan === 'free' && (ai.locked || remaining === 0);
  // What a new run costs, said before the button is pressed and again in the confirmation.
  const turnsLine =
    ai.plan === 'byok' ? t('aiAgainOwnKey') : t('aiAgainCost', { n: remaining ?? 0 });

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
      setDraft(fromReviewRow(data.review));
      setId(data.review.id);
      setIsAi(true);
      setPrompt(data.review.prompt_version ?? null);
      setRemaining(data.remaining ?? null);
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

  /** The "Đã review" switch: saved on the spot, put back if it fails. */
  async function setAccepted(accepted: boolean) {
    if (!id) return;
    setDoneFailed(false);
    setDraft((d) => ({ ...d, accepted }));
    const { error } = await createClient().from('reviews').update({ accepted }).eq('id', id);
    if (error) {
      setDraft((d) => ({ ...d, accepted: !accepted }));
      setDoneFailed(true);
      return;
    }
    router.refresh();
  }

  const set = <K extends keyof ReviewDraft>(key: K, value: ReviewDraft[K]) => {
    setSaveStatus('idle');
    setDraft((d) => ({ ...d, [key]: value }));
  };

  /** "Bạn tự review": one manual review per hand, inserted the first time and updated after. */
  async function saveManual() {
    setSaveStatus('saving');
    const supabase = createClient();
    const row = toReviewRow(draft, isMtt);
    let ok: boolean;
    if (id) {
      const { error } = await supabase.from('reviews').update(row).eq('id', id);
      ok = !error;
    } else {
      const { data, error } = await supabase
        .from('reviews')
        .insert({ ...row, hand_id: handId, source: 'manual', is_current: true })
        .select('id')
        .single();
      ok = !error;
      if (data) setId(data.id);
    }
    setSaveStatus(ok ? 'saved' : 'failed');
    router.refresh();
  }

  const area = (key: 'range' | 'math' | 'line' | 'icmText', label: string, extra?: ReactNode) => (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      {extra}
      <Textarea rows={3} value={draft[key]} onChange={(e) => set(key, e.target.value)} />
    </label>
  );

  const manualForm = (
    <div className="flex flex-col gap-3">
      <h3 className="text-base font-medium">{t('selfReview')}</h3>
      {area('range', t('range'))}
      {area(
        'math',
        t('math'),
        mathHints.length > 0 && (
          <ul className="space-y-0.5 rounded-md bg-accent/5 p-3 text-sm">
            {mathHints.map((m, i) => (
              <li key={i}>
                {t('mathHint', { street: m.street, act: m.act, toCall: m.toCall, odds: m.odds })}
                {m.mdf ? ` · MDF ${m.mdf}` : ''}
              </li>
            ))}
          </ul>
        ),
      )}
      {area('line', t('line'))}
      {isMtt && area('icmText', t('icm'))}
      <div className="space-y-1">
        <p className="text-sm">{t('errors')}</p>
        <div className="flex flex-wrap gap-1.5">
          {ERROR_TAGS.map((tag) => (
            <Chip
              key={tag}
              on={draft.errorTags.includes(tag)}
              onClick={() => set('errorTags', toggleTag(draft.errorTags, tag))}
            >
              {t(`tag_${tag}` as 'tag_tilt')}
            </Chip>
          ))}
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-sm">{t('ev')}</p>
        <div className="grid grid-cols-3 gap-1.5">
          {EV_VERDICTS.map((v) => (
            <Chip
              key={v}
              on={draft.evVerdict === v}
              onClick={() => set('evVerdict', draft.evVerdict === v ? '' : v)}
            >
              {t(`ev_${v}` as 'ev_correct')}
            </Chip>
          ))}
        </div>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        {t('lesson')}
        <Textarea rows={2} value={draft.lesson} onChange={(e) => set('lesson', e.target.value)} />
      </label>
      <div className="flex items-center justify-between gap-3 text-base">
        <span>{t('done')}</span>
        <Toggle
          checked={draft.accepted}
          aria-label={t('done')}
          onClick={() => set('accepted', !draft.accepted)}
        />
      </div>
      {saveStatus === 'saved' && (
        <p role="status" className="text-sm">
          {t('saved')}
        </p>
      )}
      {saveStatus === 'failed' && (
        <p role="alert" className="text-sm text-loss">
          {t('saveFailed')}
        </p>
      )}
      <Button size="lg" onClick={saveManual} disabled={saveStatus === 'saving'}>
        {saveStatus === 'saving' ? t('saving') : t('save')}
      </Button>
    </div>
  );

  const read = (label: string, value: string, extra?: ReactNode) =>
    value.trim() === '' && !extra ? null : (
      <div className="space-y-1">
        <h3 className="text-sm text-muted">{label}</h3>
        {extra}
        {value.trim() !== '' && <p className="text-base whitespace-pre-line">{value}</p>}
      </div>
    );

  const aiBlock = (
    <div className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3">
      <Button onClick={() => callAi({})} disabled={run === 'busy' || outOfTurns}>
        {run === 'busy' ? t('aiRunning') : t('aiButton')}
      </Button>
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
  );

  return (
    <section className="flex flex-col gap-4">
      {isAi && (
        <ConfirmDialog
          open={confirmAgain}
          tone="primary"
          title={t('aiAgainTitle')}
          confirmLabel={t('aiAgainConfirm')}
          cancelLabel={t('rebutCancel')}
          onCancel={() => setConfirmAgain(false)}
          onConfirm={() => {
            setConfirmAgain(false);
            callAi({});
          }}
        >
          <p>{turnsLine}</p>
          <p>{t('aiAgainNote')}</p>
        </ConfirmDialog>
      )}
      <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
        {t('title')}
        <InfoTip icon="!" text={t('referenceOnly')} label={tCommon('explain')} />
        {id && isAi && prompt && (
          <Badge tone="muted">
            {prompt === 'v2' ? t('oldPromptLabel') : t('promptLabel', { version: prompt })}
          </Badge>
        )}
      </h2>

      {!isAi && aiBlock}
      {!isAi && manualForm}

      {id && isAi && (
        <>
          {read(t('range'), draft.range)}
          {read(
            t('math'),
            draft.math,
            mathHints.length > 0 && (
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
            ),
          )}
          {read(t('line'), draft.line)}
          {isMtt && read(t('icm'), draft.icmText)}
          {draft.errorTags.length > 0 &&
            read(
              t('errors'),
              '',
              <div className="flex flex-wrap gap-1.5">
                {draft.errorTags.map((tag) => (
                  <Badge key={tag} tone={tag === 'none' ? 'accent' : 'warn'}>
                    {t(`tag_${tag}` as 'tag_tilt')}
                  </Badge>
                ))}
              </div>,
            )}
          {draft.evVerdict &&
            read(
              t('ev'),
              '',
              <div>
                <Badge tone={draft.evVerdict === 'correct' ? 'accent' : 'muted'}>
                  {t(`ev_${draft.evVerdict}` as 'ev_correct')}
                </Badge>
              </div>,
            )}
          {read(t('lesson'), draft.lesson)}

          <div className="flex items-center justify-between gap-3 text-base">
            <span>{t('done')}</span>
            <Toggle
              checked={draft.accepted}
              aria-label={t('done')}
              onClick={() => setAccepted(!draft.accepted)}
            />
          </div>
          {doneFailed && (
            <p role="alert" className="text-sm text-loss">
              {t('saveFailed')}
            </p>
          )}

          <div className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3">
            {!rebutOpen ? (
              <Button variant="secondary" onClick={() => setRebutOpen(true)} disabled={outOfTurns}>
                {t('rebutButton')}
              </Button>
            ) : (
              <>
                <label className="flex flex-col gap-1 text-sm">
                  {t('rebutReason')}
                  <Textarea
                    rows={3}
                    maxLength={600}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <p className="text-sm">{t('rebutCost')}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={() => setRebutOpen(false)}>
                    {t('rebutCancel')}
                  </Button>
                  <Button
                    onClick={() => callAi({ rebuttal: reason.trim() })}
                    disabled={run === 'busy' || reason.trim().length < 3}
                  >
                    {run === 'busy' ? t('aiRunning') : t('rebutSend')}
                  </Button>
                </div>
              </>
            )}
          </div>

          {(aiError || notice) && (
            <div className="flex flex-col gap-2">
              {notice && (
                <p role="status" className="text-sm">
                  {notice}
                </p>
              )}
              {aiError && (
                <p role="alert" className="text-sm text-loss">
                  {t(`ai_${aiErrorCode(aiError)}`)}
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
          )}

          <div className="flex flex-col gap-1">
            <Button
              variant="ghost"
              full={false}
              onClick={() => setConfirmAgain(true)}
              disabled={run === 'busy' || outOfTurns}
            >
              {t('aiAgain')}
            </Button>
            <p className="text-xs text-muted">{turnsLine}</p>
          </div>
        </>
      )}
    </section>
  );
}
