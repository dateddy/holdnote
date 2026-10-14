import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { SampleHand } from '@/components/onboarding/sample-hand';
import { LOCALES } from '@/i18n/locales';
import { CURRENCIES, KINDS, MODES } from '@/lib/sessions/form';
import { createClient } from '@/lib/supabase/server';
import { finishOnboarding, saveBasics, savePlay } from './actions';

/** Each language in its own name, as in the language switcher. */
const LANGUAGE_NAMES: Record<string, string> = { vi: 'Tiếng Việt', en: 'English' };

const OPTION =
  'flex h-12 cursor-pointer items-center justify-center rounded-md border border-current/20 px-3 has-checked:border-foreground has-checked:bg-foreground has-checked:text-background';
const BIG = 'h-14 w-full rounded-md bg-foreground text-lg font-medium text-background';

/** Onboarding (spec 3.2): three steps, each can be skipped. */
export default async function OnboardingPage({ searchParams }: PageProps<'/onboarding'>) {
  const { step: rawStep } = await searchParams;
  const step = rawStep === '2' ? 2 : rawStep === '3' ? 3 : 1;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('currency, play_mode, play_kind')
    .single();
  const [t, tSessions, locale] = await Promise.all([
    getTranslations('onboarding'),
    getTranslations('sessions'),
    getLocale(),
  ]);

  const radio = (name: string, value: string, label: string, checked: boolean) => (
    <label key={value} className={OPTION}>
      <input type="radio" name={name} value={value} defaultChecked={checked} className="sr-only" />
      {label}
    </label>
  );

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <p className="text-sm opacity-70">{t('progress', { step, of: 3 })}</p>
        <form action={finishOnboarding}>
          <button type="submit" className="text-sm underline underline-offset-4">
            {t('skip')}
          </button>
        </form>
      </header>

      {step === 1 && (
        <form action={saveBasics} className="flex flex-col gap-6">
          <h1 className="text-2xl font-semibold">{t('step1Title')}</h1>
          <fieldset className="space-y-2">
            <legend className="mb-2 font-medium">{t('language')}</legend>
            <div className="grid grid-cols-2 gap-2">
              {LOCALES.map((l) => radio('locale', l, LANGUAGE_NAMES[l] ?? l, l === locale))}
            </div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="mb-2 font-medium">{t('currency')}</legend>
            <div className="grid grid-cols-3 gap-2">
              {CURRENCIES.map((c) =>
                radio('currency', c, t(`currency_${c}`), c === (profile?.currency ?? 'VND')),
              )}
            </div>
            <p className="text-xs opacity-70">{t('currencyHint')}</p>
          </fieldset>
          <button type="submit" className={BIG}>
            {t('next')}
          </button>
        </form>
      )}

      {step === 2 && (
        <form action={savePlay} className="flex flex-col gap-6">
          <h1 className="text-2xl font-semibold">{t('step2Title')}</h1>
          <fieldset className="space-y-2">
            <legend className="mb-2 font-medium">{t('playMode')}</legend>
            <div className="grid grid-cols-2 gap-2">
              {MODES.map((m) =>
                radio('mode', m, tSessions(m), m === (profile?.play_mode ?? 'live')),
              )}
            </div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="mb-2 font-medium">{t('playKind')}</legend>
            <div className="grid grid-cols-2 gap-2">
              {KINDS.map((k) =>
                radio('kind', k, tSessions(k), k === (profile?.play_kind ?? 'cash')),
              )}
            </div>
            <p className="text-xs opacity-70">{t('playHint')}</p>
          </fieldset>
          <button type="submit" className={BIG}>
            {t('next')}
          </button>
        </form>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-5">
          <h1 className="text-2xl font-semibold">{t('step3Title')}</h1>
          <p>{t('step3Intro')}</p>
          <SampleHand withReview />
          <Link href="/onboarding/practice" className={`${BIG} flex items-center justify-center`}>
            {t('tryIt')}
          </Link>
          <form action={finishOnboarding}>
            <button type="submit" className="h-12 w-full rounded-md border border-current/20">
              {t('finish')}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
