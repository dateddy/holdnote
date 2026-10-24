'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { finishOnboarding } from '@/app/(app)/onboarding/actions';
import { HandForm } from '@/components/hand/hand-form';
import {
  comparePractice,
  PRACTICE_PARTS,
  SAMPLE_SESSION,
  type PracticePart,
} from '@/lib/onboarding/sample';

/** Record the sample hand again; nothing is saved, the result is compared part by part. */
export function PracticeHand({
  locale,
  entryMode,
}: {
  locale: string;
  entryMode: 'buttons' | 'shorthand';
}) {
  const t = useTranslations('onboarding');
  const [check, setCheck] = useState<Record<PracticePart, boolean> | null>(null);
  const allRight = check && PRACTICE_PARTS.every((p) => check[p]);

  return (
    <div className="flex flex-col gap-5">
      {check && (
        <section role="status" className="space-y-2 rounded-xl border border-line bg-surface p-4">
          <p className="font-medium">{allRight ? t('practiceAllRight') : t('practiceSomeWrong')}</p>
          <ul className="space-y-1 text-sm">
            {PRACTICE_PARTS.map((p) => (
              <li key={p}>
                {check[p] ? '✓' : '✗'} {t(`part_${p}`)}
                {!check[p] && <span className="text-muted"> · {t(`hint_${p}`)}</span>}
              </li>
            ))}
          </ul>
          {allRight && (
            <form action={finishOnboarding}>
              <button
                type="submit"
                className="h-12 w-full rounded-xl bg-accent font-medium text-accent-foreground"
              >
                {t('finish')}
              </button>
            </form>
          )}
        </section>
      )}
      <HandForm
        sessionId="practice"
        session={SAMPLE_SESSION}
        locale={locale}
        lastNum={0}
        previous={null}
        opponents={[]}
        entryMode={entryMode}
        practice={{
          label: t('practiceCheck'),
          onCheck: (draft) => {
            setCheck(comparePractice(draft, draft.actions));
            window.scrollTo({ top: 0, behavior: 'smooth' });
          },
        }}
      />
    </div>
  );
}
