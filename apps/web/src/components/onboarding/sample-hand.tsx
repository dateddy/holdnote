import { useTranslations } from 'next-intl';
import { cardLabel } from '@/components/hand/card-label';
import { SAMPLE } from '@/lib/onboarding/sample';

const STREETS = ['preflop', 'flop', 'turn', 'river'] as const;

/** The sample hand as the player would read it in their journal. */
export function SampleHand({ withReview }: { withReview: boolean }) {
  const t = useTranslations('onboarding');
  const tReview = useTranslations('review');

  return (
    <section className="space-y-3 rounded-md border border-line bg-surface p-4">
      <p className="text-sm text-muted">{t('sampleGame')}</p>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <b className="text-xl">
          {SAMPLE.heroCards.map((c) => (
            <span key={c}>{cardLabel(c)}</span>
          ))}
        </b>
        <span>
          {SAMPLE.board.map((c) => (
            <span key={c}>{cardLabel(c)}</span>
          ))}
        </span>
        <span className="text-sm">{t('samplePositions')}</span>
      </p>
      <ol className="space-y-1 text-sm">
        {STREETS.map((s) => (
          <li key={s}>
            <b className="capitalize">{s}</b>: {t(`sample_${s}`)}
          </li>
        ))}
      </ol>
      <p className="text-sm">
        <span className="text-muted">{t('sampleShorthand')}</span>{' '}
        <code className="rounded bg-accent/15 px-1">{SAMPLE.line}</code>
      </p>
      <p className="font-medium">{t('sampleResult')}</p>

      {withReview && (
        <div className="space-y-2 border-t border-line bg-surface pt-3 text-sm">
          <p>
            <b>{tReview('range')}:</b> {t('sample_range')}
          </p>
          <p>
            <b>{tReview('line')}:</b> {t('sample_line')}
          </p>
          <p>
            <b>{tReview('errors')}:</b> {tReview('tag_call_too_loose')} · {tReview('ev_mistake')}
          </p>
          <p className="whitespace-pre-line">
            <b>{tReview('lesson')}:</b> {t('sample_lesson')}
          </p>
        </div>
      )}
    </section>
  );
}
