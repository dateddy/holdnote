import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { computePot, potOddsAtDecisions } from 'poker-core';
import { HandForm } from '@/components/hand/hand-form';
import { HandSummary } from '@/components/hand/hand-summary';
import { ReviewForm, type MathHint } from '@/components/hand/review-form';
import {
  boardCards,
  deriveHand,
  fromHandRow,
  HAND_EDIT_COLUMNS,
  HAND_SESSION_COLUMNS,
  heroCards,
} from '@/lib/hands/build';
import { HAND_FILTERS } from '@/lib/hands/list';
import { isOneOf } from '@/lib/sessions/form';
import { loadUsage } from '@/lib/ai/quota';
import { aiStatus } from '@/lib/ai/status';
import { fromReviewRow, REVIEW_COLUMNS } from '@/lib/review/review';
import { formatMoney } from '@/lib/sessions/format';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export default async function HandDetailPage({ params, searchParams }: PageProps<'/hands/[id]'>) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  // The list filter the player came from, so Back returns to the same list.
  const rawFilter = Array.isArray(query.f) ? query.f[0] : query.f;
  const filter = isOneOf(HAND_FILTERS, rawFilter) && rawFilter !== 'all' ? rawFilter : null;
  const supabase = await createClient();

  const { data: hand } = await supabase
    .from('hands')
    .select(HAND_EDIT_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (!hand) notFound();

  const { data: session } = await supabase
    .from('sessions')
    .select(`${HAND_SESSION_COLUMNS}, currency, venue`)
    .eq('id', hand.session_id)
    .maybeSingle();
  if (!session) notFound();

  const venue = session.venue?.trim() ?? '';
  const [{ data: review }, { data: opponents }, { data: profile }, t, locale] = await Promise.all([
    supabase
      .from('reviews')
      .select(REVIEW_COLUMNS)
      .eq('hand_id', id)
      .eq('is_current', true)
      .maybeSingle(),
    venue
      ? supabase
          .from('opponents')
          .select('id, name')
          .ilike('venue', venue.replace(/[\\%_]/g, '\\$&'))
          .order('name')
      : Promise.resolve({ data: [] }),
    supabase.from('profiles').select('entry_mode').single(),
    getTranslations('hand'),
    getLocale(),
  ]);

  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  const status = userId ? aiStatus(await loadUsage(createAdminClient(), userId)) : null;

  // Pot odds come from poker-core, never from the reviewer's head (CLAUDE.md rule 5).
  const draft = fromHandRow(session, hand);
  const derived = deriveHand(session, draft);
  const money = (n: number) => formatMoney(n, session.currency, locale);
  const steps = derived.input ? computePot(derived.input).steps : [];
  const mathHints: MathHint[] = derived.input
    ? potOddsAtDecisions(derived.input).map((d) => ({
        street: t(`street_${d.street}`),
        act: t(`act_${d.act}`),
        toCall: money(d.toCall),
        odds: `${Math.round(d.potOdds * 100)}%`,
        mdf: d.mdf == null ? null : `${Math.round(d.mdf * 100)}%`,
      }))
    : [];

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t('detailTitle', { num: hand.num })}</h1>
        <Link
          href={`/sessions/${hand.session_id}/hands${filter ? `?f=${filter}` : ''}`}
          className="text-sm underline underline-offset-4"
        >
          {t('handsList')}
        </Link>
      </header>

      <HandSummary
        heroCards={heroCards(draft)}
        board={boardCards(draft)}
        heroPos={draft.heroPos}
        villPos={draft.villPos}
        steps={steps}
        result={
          derived.result == null
            ? null
            : {
                value: derived.result,
                text:
                  derived.resultBb == null
                    ? money(derived.result)
                    : `${derived.resultBb > 0 ? '+' : ''}${derived.resultBb} bb`,
              }
        }
        eff={derived.eff ? `${money(derived.eff.amount)} (${derived.eff.bb} bb)` : null}
        thought={draft.thought}
        flagged={draft.flagged}
        money={money}
      />

      <ReviewForm
        handId={hand.id}
        reviewId={review?.id ?? null}
        source={review?.source ?? null}
        initial={fromReviewRow(review)}
        ai={{
          plan: status?.plan ?? 'free',
          remaining: status?.remaining ?? null,
          locked: status?.budgetLocked ?? false,
        }}
        isMtt={session.kind === 'mtt'}
        mathHints={mathHints}
      />

      <details className="group rounded-md border border-line bg-surface">
        <summary className="flex h-12 cursor-pointer items-center px-4 font-medium">
          {t('editHand')}
        </summary>
        <div className="p-4 pt-0">
          <HandForm
            sessionId={hand.session_id}
            session={session}
            locale={locale}
            lastNum={hand.num - 1}
            previous={null}
            opponents={opponents ?? []}
            entryMode={profile?.entry_mode === 'shorthand' ? 'shorthand' : 'buttons'}
            edit={{ handId: hand.id, num: hand.num, initial: draft }}
          />
        </div>
      </details>
    </main>
  );
}
