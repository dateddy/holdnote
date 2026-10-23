'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { BarButton } from '@/components/ui/bar-button';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Collapse } from '@/components/ui/collapse';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Icon } from '@/components/ui/icon';
import { InfoTip } from '@/components/ui/info-tip';
import { Textarea } from '@/components/ui/textarea';
import { Toggle } from '@/components/ui/toggle';
import type { RebuttalRow } from '@/lib/review/ai-state';
import { createClient } from '@/lib/supabase/client';
import {
  aiErrorCode,
  emptyReview,
  ERROR_TAGS,
  EV_VERDICTS,
  evDivergence,
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
  /** The current AI review, if any. */
  aiReview: { id: string; draft: ReviewDraft } | null;
  /** The student's own current review, if any. */
  manualReview: { id: string; draft: ReviewDraft } | null;
  /** Rebuttals of the current AI analysis, oldest first. */
  rebuttals: RebuttalRow[];
  /** The next rebuttal of this analysis uses no turn. */
  freeRebuttal: boolean;
  /** The hand changed since the AI review: offer to run it again. */
  aiStale: boolean;
  /** The AI review names cards that are not in the hand. */
  aiCardFlag: boolean;
  isMtt: boolean;
  mathHints: MathHint[];
  ai: AiInfo;
};

type AiResponse = {
  review?: ReviewRow & { id: string };
  rebuttal?: RebuttalRow | null;
  /** The reply still named wrong cards after the retry. */
  card_flag?: boolean;
  remaining?: number | null;
  cached?: boolean;
  error?: string;
};

/**
 * "AI phân tích" (spec 3.7) and, under it, the "Bạn tự review" card. The two live side by side:
 * running the AI never touches what the student wrote (DEC-064). AI part: no review yet → the AI
 * button and the turns left; with one → read-only fields, "Tôi đã xem lại" (saved at once), the
 * rebuttal conversation, and a re-run only when the hand changed since. Own part: a card with its
 * status; collapsed it shows the EV and error tags, open it is the form.
 */
export function ReviewForm({
  handId,
  aiReview,
  manualReview,
  rebuttals: initialRebuttals,
  freeRebuttal: initialFree,
  aiStale: initialStale,
  aiCardFlag: initialCardFlag,
  isMtt,
  mathHints,
  ai,
}: Props) {
  const t = useTranslations('review');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const [aiDraft, setAiDraft] = useState(aiReview?.draft ?? emptyReview());
  const [aiId, setAiId] = useState(aiReview?.id ?? null);
  const [remaining, setRemaining] = useState(ai.remaining);
  const [run, setRun] = useState<'idle' | 'busy'>('idle');
  const [aiError, setAiError] = useState<string | null>(null);
  /** The last request, so "Try again" repeats it (a rebuttal keeps its text). */
  const lastBody = useRef<{ rebuttal?: string }>({});
  const [lastWasRebuttal, setLastWasRebuttal] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [rebutOpen, setRebutOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [rebuttals, setRebuttals] = useState(initialRebuttals);
  const [freeRebuttal, setFreeRebuttal] = useState(initialFree);
  const [aiStale, setAiStale] = useState(initialStale);
  const [aiCardFlag, setAiCardFlag] = useState(initialCardFlag);
  const [doneFailed, setDoneFailed] = useState(false);
  const [confirmAgain, setConfirmAgain] = useState(false);

  const [draft, setDraft] = useState(manualReview?.draft ?? emptyReview());
  const [manualId, setManualId] = useState(manualReview?.id ?? null);
  const [manualOpen, setManualOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');

  const outOfTurns = ai.plan === 'free' && (ai.locked || remaining === 0);
  // The first rebuttal of an analysis runs even with no turns left; the budget lock still applies.
  const canRebut = ai.plan === 'byok' || (!ai.locked && (freeRebuttal || (remaining ?? 0) > 0));
  // What a new run costs, said before the button is pressed and again in the confirmation.
  const turnsLine =
    ai.plan === 'byok' ? t('aiAgainOwnKey') : t('aiAgainCost', { n: remaining ?? 0 });
  const rebutCostLine =
    ai.plan === 'byok'
      ? t('rebutCostOwnKey')
      : freeRebuttal
        ? t('rebutCostFree')
        : t('rebutCost', { n: remaining ?? 0 });

  async function callAi(body: { rebuttal?: string }) {
    lastBody.current = body;
    setLastWasRebuttal(!!body.rebuttal);
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
      setRemaining(data.remaining ?? null);
      if (body.rebuttal) {
        const answer = data.rebuttal && { ...data.rebuttal, card_flag: data.card_flag === true };
        if (answer) {
          setRebuttals((rows) => [...rows, answer]);
          if (answer.free) setFreeRebuttal(false);
        }
        if (answer?.outcome === 'revised') {
          setAiDraft(fromReviewRow(data.review));
          setAiId(data.review.id);
          setAiStale(false);
          setAiCardFlag(data.card_flag === true);
        }
      } else {
        const fresh = data.review.id !== aiId;
        setAiDraft(fromReviewRow(data.review));
        setAiId(data.review.id);
        if (fresh) {
          setAiCardFlag(data.card_flag === true);
          // A new run is a new analysis: its own conversation and its own free rebuttal.
          setRebuttals([]);
          setFreeRebuttal(true);
          setAiStale(false);
        }
        if (data.cached) setNotice(t('aiCached'));
      }
      setRebutOpen(false);
      setReason('');
      router.refresh();
    } catch {
      setAiError('offline');
    } finally {
      setRun('idle');
    }
  }

  /** The AI review's "Tôi đã xem lại" switch: saved on the spot, put back if it fails. */
  async function setAccepted(accepted: boolean) {
    if (!aiId) return;
    setDoneFailed(false);
    setAiDraft((d) => ({ ...d, accepted }));
    const { error } = await createClient().from('reviews').update({ accepted }).eq('id', aiId);
    if (error) {
      setAiDraft((d) => ({ ...d, accepted: !accepted }));
      setDoneFailed(true);
      return;
    }
    router.refresh();
  }

  const set = <K extends keyof ReviewDraft>(key: K, value: ReviewDraft[K]) => {
    setSaveStatus('idle');
    setDraft((d) => ({ ...d, [key]: value }));
  };

  /** "Bạn tự review": one per hand, inserted the first time and updated after. */
  async function saveManual() {
    setSaveStatus('saving');
    const supabase = createClient();
    const row = toReviewRow(draft, isMtt);
    let ok: boolean;
    if (manualId) {
      const { error } = await supabase.from('reviews').update(row).eq('id', manualId);
      ok = !error;
    } else {
      const { data, error } = await supabase
        .from('reviews')
        .insert({ ...row, hand_id: handId, source: 'manual', is_current: true })
        .select('id')
        .single();
      ok = !error;
      if (data) setManualId(data.id);
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

  const hints = mathHints.length > 0 && (
    <ul className="space-y-0.5 rounded-md bg-accent/5 p-3 text-sm">
      {mathHints.map((m, i) => (
        <li key={i}>
          {t('mathHint', { street: m.street, act: m.act, toCall: m.toCall, odds: m.odds })}
          {m.mdf ? ` · MDF ${m.mdf}` : ''}
        </li>
      ))}
    </ul>
  );

  /** EV and error tags as badges: the AI's read-only block and the collapsed own review. */
  const verdictBadges = (d: ReviewDraft) => (
    <>
      {d.evVerdict && (
        <Badge tone={d.evVerdict === 'correct' ? 'accent' : 'muted'}>
          {t('ev')}: {t(`ev_${d.evVerdict}` as 'ev_correct')}
        </Badge>
      )}
      {d.errorTags.map((tag) => (
        <Badge key={tag} tone={tag === 'none' ? 'accent' : 'warn'}>
          {t(`tag_${tag}` as 'tag_tilt')}
        </Badge>
      ))}
    </>
  );

  const doneSwitch = (checked: boolean, onClick: () => void) => (
    <div className="flex items-center justify-between gap-3 text-base">
      <span>{t('done')}</span>
      <Toggle checked={checked} aria-label={t('done')} onClick={onClick} />
    </div>
  );

  const manualForm = (
    <div className="flex flex-col gap-3 pt-1">
      {area('range', t('range'))}
      {area('math', t('math'), hints)}
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
      {doneSwitch(draft.accepted, () => set('accepted', !draft.accepted))}
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

  const errorLines = (withRetry: boolean) => (
    <>
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
      {withRetry && aiError && isRetryable(aiErrorCode(aiError)) && (
        <Button
          variant="secondary"
          onClick={() => callAi(lastBody.current)}
          disabled={run === 'busy' || (lastWasRebuttal ? !canRebut : outOfTurns)}
        >
          {t('aiRetry')}
        </Button>
      )}
    </>
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
      {errorLines(true)}
    </div>
  );

  /** The student's argument, then the AI's answer right under it. */
  const conversation = rebuttals.length > 0 && (
    <ol className="flex flex-col gap-3" aria-label={t('rebutThread')}>
      {rebuttals.map((r) => (
        <li key={r.id} className="flex flex-col gap-2">
          <div className="space-y-1 rounded-md border border-line p-3">
            <p className="text-xs text-muted">{t('rebutYou')}</p>
            <p className="text-base whitespace-pre-line">{r.reason}</p>
          </div>
          <div className="space-y-1 rounded-md bg-accent/5 p-3">
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
              {t('rebutAi')}
              <Badge tone={r.outcome === 'revised' ? 'warn' : 'accent'}>
                {r.outcome === 'revised' ? t('rebutRevised') : t('rebutKept')}
              </Badge>
            </p>
            <p className="text-base whitespace-pre-line">{r.reply}</p>
            {r.outcome === 'revised' && (
              <p className="text-xs text-muted">{t('rebutRevisedNote')}</p>
            )}
            {r.card_flag && <p className="text-xs text-warn">{t('cardFlag')}</p>}
          </div>
        </li>
      ))}
    </ol>
  );

  const rebutBox = (
    <div className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3">
      {!rebutOpen ? (
        <>
          <Button variant="secondary" onClick={() => setRebutOpen(true)} disabled={!canRebut}>
            {rebuttals.length ? t('rebutAgain') : t('rebutButton')}
          </Button>
          <p className="text-xs text-muted">{rebutCostLine}</p>
        </>
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
          <p className="text-sm">{rebutCostLine}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setRebutOpen(false)}>
              {t('rebutCancel')}
            </Button>
            <Button
              onClick={() => callAi({ rebuttal: reason.trim() })}
              disabled={run === 'busy' || reason.trim().length < 3 || !canRebut}
            >
              {run === 'busy' ? t('aiRunning') : t('rebutSend')}
            </Button>
          </div>
        </>
      )}
      {errorLines(true)}
    </div>
  );

  const divergence = aiId && manualId ? evDivergence(aiDraft.evVerdict, draft.evVerdict) : null;
  const hasOwnSummary = draft.evVerdict !== '' || draft.errorTags.length > 0;
  const ownTitle = (
    <span className="flex flex-wrap items-center gap-2 text-base font-medium">
      {t('selfReview')}
      <Badge tone={manualId ? 'accent' : 'muted'}>
        {manualId ? t('selfReviewSaved') : t('selfReviewEmpty')}
      </Badge>
    </span>
  );

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        {aiId && (
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
        </h2>

        {!aiId && aiBlock}

        {aiId && (
          <>
            {aiCardFlag && (
              <p role="note" className="rounded-md bg-warn/10 p-3 text-sm text-warn">
                {t('cardFlag')}
              </p>
            )}
            {read(t('range'), aiDraft.range)}
            {read(t('math'), aiDraft.math, hints)}
            {read(t('line'), aiDraft.line)}
            {isMtt && read(t('icm'), aiDraft.icmText)}
            {aiDraft.errorTags.length > 0 &&
              read(
                t('errors'),
                '',
                <div className="flex flex-wrap gap-1.5">
                  {aiDraft.errorTags.map((tag) => (
                    <Badge key={tag} tone={tag === 'none' ? 'accent' : 'warn'}>
                      {t(`tag_${tag}` as 'tag_tilt')}
                    </Badge>
                  ))}
                </div>,
              )}
            {aiDraft.evVerdict &&
              read(
                t('ev'),
                '',
                <div>
                  <Badge tone={aiDraft.evVerdict === 'correct' ? 'accent' : 'muted'}>
                    {t(`ev_${aiDraft.evVerdict}` as 'ev_correct')}
                  </Badge>
                </div>,
              )}
            {read(t('lesson'), aiDraft.lesson)}

            {doneSwitch(aiDraft.accepted, () => setAccepted(!aiDraft.accepted))}
            {doneFailed && (
              <p role="alert" className="text-sm text-loss">
                {t('saveFailed')}
              </p>
            )}

            {conversation}
            {rebutBox}

            {aiStale && (
              <div className="flex flex-col gap-1">
                <p className="text-sm">{t('aiStale')}</p>
                <Button
                  variant="secondary"
                  onClick={() => setConfirmAgain(true)}
                  disabled={run === 'busy' || outOfTurns}
                >
                  {t('aiAgain')}
                </Button>
                <p className="text-xs text-muted">{turnsLine}</p>
              </div>
            )}
          </>
        )}
      </div>

      <Card aria-label={t('selfReview')}>
        {manualId ? (
          // Saved: the whole header opens the form to edit it.
          <BarButton
            aria-expanded={manualOpen}
            onClick={() => setManualOpen((o) => !o)}
            className="justify-between"
          >
            {ownTitle}
            <span className="flex items-center gap-1 text-sm text-muted">
              {manualOpen ? t('selfReviewCollapse') : t('selfReviewEdit')}
              <Icon icon={manualOpen ? ChevronUp : ChevronDown} size={20} />
            </span>
          </BarButton>
        ) : (
          ownTitle
        )}
        {manualId && !manualOpen && hasOwnSummary && (
          <div className="flex flex-wrap gap-1.5">{verdictBadges(draft)}</div>
        )}
        {divergence && (
          <p className="text-xs text-muted">
            {t('evDivergence', {
              ai: t(`ev_${divergence.ai}` as 'ev_correct'),
              you: t(`ev_${divergence.manual}` as 'ev_correct'),
            })}
          </p>
        )}
        {!manualId && !manualOpen && (
          <Button variant="secondary" onClick={() => setManualOpen(true)}>
            {t('selfReviewStart')}
          </Button>
        )}
        <Collapse open={manualOpen}>{manualForm}</Collapse>
      </Card>
    </section>
  );
}
