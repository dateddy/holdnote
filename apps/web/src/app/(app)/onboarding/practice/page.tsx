import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PracticeHand } from '@/components/onboarding/practice-hand';
import { SampleHand } from '@/components/onboarding/sample-hand';
import { createClient } from '@/lib/supabase/server';
import { finishOnboarding } from '../actions';

/** Step 3, second half: record the sample hand with guidance. Practice only, nothing is saved. */
export default async function PracticePage() {
  const supabase = await createClient();
  const { data: profile } = await supabase.from('profiles').select('entry_mode').single();
  const [t, locale] = await Promise.all([getTranslations('onboarding'), getLocale()]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-6">
      <header className="flex items-center justify-between gap-4">
        <Link href="/onboarding?step=3" className="text-sm underline underline-offset-4">
          {t('back')}
        </Link>
        <form action={finishOnboarding}>
          <Button type="submit" variant="ghost" full={false}>
            {t('skip')}
          </Button>
        </form>
      </header>
      <h1 className="text-2xl font-semibold">{t('practiceTitle')}</h1>
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        <li>{t('guide1')}</li>
        <li>{t('guide2')}</li>
        <li>{t('guide3')}</li>
        <li>{t('guide4')}</li>
      </ol>
      <details className="rounded-xl border border-line bg-surface p-3">
        <summary className="cursor-pointer text-sm font-medium">{t('showSample')}</summary>
        <div className="pt-3">
          <SampleHand withReview={false} />
        </div>
      </details>
      <p className="text-xs text-muted">{t('practiceNotSaved')}</p>
      <PracticeHand
        locale={locale}
        entryMode={profile?.entry_mode === 'shorthand' ? 'shorthand' : 'buttons'}
      />
    </main>
  );
}
